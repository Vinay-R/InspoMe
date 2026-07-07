import "server-only";

import { waitUntil } from "@vercel/functions";

import type {
  ContentIngestionService,
  IngestionInput,
  MediaDownloadProvider,
  MediaDownloadResult,
  VideoAnalysisProvider,
} from "./types";
import { ApifyTikTokProvider } from "./providers/apify-tiktok";
import { CobaltProvider } from "./providers/cobalt";
import { GeminiProvider } from "./providers/gemini";
import { StubCobaltProvider } from "./providers/stub-cobalt";
import { StubGeminiProvider } from "./providers/stub-gemini";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { parseInspoUrl } from "@/lib/platform";
import { userSafeJobError } from "./job-errors";
import { buildMediaFetchHeaders } from "./media-fetch";

type AdminClient = ReturnType<typeof createAdminClient>;

// Status writes previously ignored the returned `error`, so a failed update
// (RLS drift, network blip) silently left rows in stale states. These helpers
// log every failure with enough context to trace the job.
async function updateJob(
  admin: AdminClient,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin
    .from("ingestion_jobs")
    .update(patch)
    .eq("id", jobId);
  if (error) {
    console.error("[ingestion] ingestion_jobs update failed", {
      jobId,
      patch,
      error,
    });
  }
}

async function updateInspo(
  admin: AdminClient,
  inspoId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("inspo").update(patch).eq("id", inspoId);
  if (error) {
    console.error("[ingestion] inspo update failed", { inspoId, patch, error });
  }
}

const THUMBNAIL_FETCH_TIMEOUT_MS = 10_000;
const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;

// Platform CDN thumbnail URLs are signed and expire within ~24h, rotting the
// library tiles. Copy the bytes into our public `thumbnails` bucket and store
// that stable URL instead. Never fatal — on any failure we keep the original.
async function persistThumbnail(
  admin: AdminClient,
  userId: string,
  inspoId: string,
  sourceUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(THUMBNAIL_FETCH_TIMEOUT_MS),
      headers: buildMediaFetchHeaders(sourceUrl),
    });
    if (!res.ok) {
      throw new Error(`thumbnail fetch failed: HTTP ${res.status}`);
    }

    const bytes = await res.arrayBuffer();
    if (bytes.byteLength > THUMBNAIL_MAX_BYTES) {
      throw new Error(
        `thumbnail exceeds size cap (${bytes.byteLength} > ${THUMBNAIL_MAX_BYTES} bytes)`,
      );
    }

    const contentType =
      res.headers.get("content-type")?.split(";")[0].trim() || "image/jpeg";
    const path = `${userId}/${inspoId}.jpg`;

    const { error } = await admin.storage
      .from("thumbnails")
      .upload(path, bytes, { contentType, upsert: true });
    if (error) throw error;

    return admin.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error(
      "[ingestion] thumbnail persist failed — keeping original URL",
      { inspoId },
      e,
    );
    return null;
  }
}

/**
 * Owns the lifecycle of a single ingestion job:
 *   inspo → download → analyze → persist → update inspo statuses
 *
 * Runs the work inline within the request's lifetime via Vercel's `waitUntil`,
 * which extends the serverless function past the response so the analyze step
 * isn't killed by cold-start function termination. Locally `waitUntil` simply
 * resolves the promise normally, so dev behavior is unchanged.
 */
export class InlineIngestionService implements ContentIngestionService {
  constructor(
    private readonly downloader: MediaDownloadProvider,
    private readonly analyzer: VideoAnalysisProvider,
  ) {}

  async enqueue(
    input: IngestionInput,
  ): Promise<{ jobId: string; status: "queued" }> {
    const admin = createAdminClient();

    const { data: job, error: jobErr } = await admin
      .from("ingestion_jobs")
      .insert({
        user_id: input.userId,
        inspo_id: input.inspoId,
        provider: this.downloader.name,
        status: "queued",
        attempts: input.attempt ?? 1,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      throw new Error(jobErr?.message ?? "Failed to create ingestion job.");
    }

    await updateInspo(admin, input.inspoId, {
      media_status: "queued",
      analysis_status: "queued",
    });

    // Fire-and-forget the analyze step. `waitUntil` keeps the serverless
    // function alive past the response so the work isn't killed mid-flight.
    waitUntil(
      this.run(job.id, input).catch((e) => {
        console.error("[ingestion] unhandled error", e);
      }),
    );

    return { jobId: job.id, status: "queued" };
  }

  private async run(jobId: string, input: IngestionInput): Promise<void> {
    const admin = createAdminClient();
    const startedAt = new Date().toISOString();

    // `attempts` is set once at insert time in enqueue() — don't reset it here.
    await updateJob(admin, jobId, {
      status: "downloading",
      started_at: startedAt,
    });

    await updateInspo(admin, input.inspoId, { media_status: "queued" });

    // 1. Download
    const dl = this.downloader.canHandle(input.url)
      ? await this.downloader.download(input.url)
      : {
          success: false,
          platform: input.platform,
          sourceUrl: input.url,
          errorCode: "no_provider",
          errorMessage: "No provider can handle this URL.",
        };

    if (!dl.success) {
      // Providers own user-safe humanization of download failures (see
      // humanizeCobaltError); the mapper supplies the fallback and the raw
      // details are logged either way.
      const fallback = userSafeJobError("download", jobId, {
        errorCode: dl.errorCode,
        errorMessage: dl.errorMessage,
      });
      await updateJob(admin, jobId, {
        status: "failed",
        error_code: dl.errorCode ?? "download_failed",
        error_message: dl.errorMessage ?? fallback,
        completed_at: new Date().toISOString(),
      });

      await updateInspo(admin, input.inspoId, {
        media_status: "failed",
        analysis_status: "failed",
        metrics_status: "unavailable",
        access_status: "unavailable",
      });
      return;
    }

    await updateJob(admin, jobId, { status: "downloaded" });

    // Copy the (expiring) platform CDN thumbnail into Supabase Storage and
    // store the stable public URL. Falls back to the original on any failure.
    let thumbnailUrl = dl.thumbnailUrl ?? null;
    if (thumbnailUrl) {
      const stored = await persistThumbnail(
        admin,
        input.userId,
        input.inspoId,
        thumbnailUrl,
      );
      if (stored) thumbnailUrl = stored;
    }

    await updateInspo(admin, input.inspoId, {
      media_status: "downloaded",
      thumbnail_url: thumbnailUrl,
      duration_seconds: dl.durationSeconds ?? null,
      creator_handle: dl.creatorHandle ?? null,
      caption: dl.caption ?? null,
      media_storage_url: dl.mediaFileUrl ?? null,
      access_status: "accessible",
    });

    // 2. Look up the inspo + user context for personalization
    const [{ data: inspoRow }, { data: userRow }] = await Promise.all([
      admin
        .from("inspo")
        .select("id, save_reasons, caption, creator_handle")
        .eq("id", input.inspoId)
        .single(),
      admin
        .from("users")
        .select(
          "creator_category, creator_category_custom, niche, content_goals, preferred_content, pillars, experience_level, tone",
        )
        .eq("id", input.userId)
        .single(),
    ]);

    if (!inspoRow || !userRow) {
      await updateJob(admin, jobId, {
        status: "failed",
        error_code: "context_missing",
        error_message: "Could not load inspo or user context.",
        completed_at: new Date().toISOString(),
      });
      await updateInspo(admin, input.inspoId, { analysis_status: "failed" });
      return;
    }

    await updateJob(admin, jobId, { status: "uploading_to_gemini" });

    await updateJob(admin, jobId, { status: "analyzing" });

    await updateInspo(admin, input.inspoId, { analysis_status: "processing" });

    // 3. Analyze
    let analysis;
    try {
      analysis = await this.analyzer.analyze({
        inspoId: input.inspoId,
        userId: input.userId,
        sourceUrl: input.url,
        platform: dl.platform,
        mediaFileUrl: dl.mediaFileUrl,
        thumbnailUrl: dl.thumbnailUrl,
        caption: inspoRow.caption ?? dl.caption,
        creatorHandle: inspoRow.creator_handle ?? dl.creatorHandle,
        saveReasons: inspoRow.save_reasons ?? [],
        userContext: {
          creator_category: userRow.creator_category,
          creator_category_custom: userRow.creator_category_custom,
          niche: userRow.niche ?? [],
          content_goals: userRow.content_goals ?? [],
          preferred_content: userRow.preferred_content ?? [],
          pillars: userRow.pillars ?? [],
          experience_level: userRow.experience_level,
          tone: userRow.tone ?? [],
        },
      });
    } catch (e) {
      await updateJob(admin, jobId, {
        status: "failed",
        error_code: "analysis_failed",
        // Raw exception text (Zod dumps, HTTP codes) is logged, not stored.
        error_message: userSafeJobError("analysis", jobId, e),
        completed_at: new Date().toISOString(),
      });
      await updateInspo(admin, input.inspoId, { analysis_status: "failed" });
      return;
    }

    // 4. Persist analysis (upsert by inspo_id — replaces on retry)
    const { error: upsertErr } = await admin
      .from("video_analysis")
      .upsert(
        {
          user_id: input.userId,
          inspo_id: input.inspoId,
          summary: analysis.data.summary,
          content_category: analysis.data.content_category,
          primary_topic: analysis.data.primary_topic,
          target_audience: analysis.data.target_audience,
          why_it_worked: analysis.data.why_it_worked,
          hook: analysis.data.hook,
          structure: analysis.data.structure,
          visuals: analysis.data.visuals,
          audio: analysis.data.audio,
          editing: analysis.data.editing,
          reusable_pattern: analysis.data.reusable_pattern,
          tags: analysis.data.tags,
          search_summary: analysis.data.search_summary,
          model_provider: analysis.modelProvider,
          model_name: analysis.modelName,
          prompt_version: analysis.promptVersion,
          schema_version: analysis.schemaVersion,
        },
        { onConflict: "inspo_id" },
      );

    if (upsertErr) {
      await updateJob(admin, jobId, {
        status: "failed",
        error_code: "persist_failed",
        // Raw Postgres error is logged, not stored.
        error_message: userSafeJobError("persist", jobId, upsertErr),
        completed_at: new Date().toISOString(),
      });
      await updateInspo(admin, input.inspoId, { analysis_status: "failed" });
      return;
    }

    await updateJob(admin, jobId, {
      status: "complete",
      completed_at: new Date().toISOString(),
    });

    await updateInspo(admin, input.inspoId, {
      analysis_status: "complete",
      last_analyzed_at: new Date().toISOString(),
      // Phase 1 has no real metrics provider — mark unavailable so the UI
      // shows the right empty state instead of a perpetual loader.
      metrics_status: "unavailable",
    });
  }
}

let cached: InlineIngestionService | null = null;

// Provider selection follows env presence: if the production credential is
// set, use the real provider; otherwise fall back to a stub. This keeps
// `npm run dev` workable on a fresh clone without external services, while
// production (env set in Vercel) automatically goes live.
//
// TikTok and Instagram have different reliability profiles, so we route by
// platform: TikTok → Apify (Cobalt's datacenter IPs are blocked by TikTok),
// Instagram → Cobalt. Both fall back to the stub when their credentials are
// absent.
class RoutingDownloadProvider implements MediaDownloadProvider {
  readonly name = "routing";

  constructor(
    private readonly tiktok: MediaDownloadProvider,
    private readonly instagram: MediaDownloadProvider,
  ) {}

  canHandle(url: string): boolean {
    const platform = parseInspoUrl(url).platform;
    return platform === "tiktok" || platform === "instagram";
  }

  async download(url: string): Promise<MediaDownloadResult> {
    const parsed = parseInspoUrl(url);
    if (parsed.platform === "tiktok") return this.tiktok.download(url);
    if (parsed.platform === "instagram") return this.instagram.download(url);
    return {
      success: false,
      platform: parsed.platform,
      sourceUrl: url,
      errorCode: "unsupported_platform",
      errorMessage: "Only TikTok and Instagram URLs are supported.",
    };
  }
}

function selectDownloader(): MediaDownloadProvider {
  const tiktok: MediaDownloadProvider = serverEnv.apifyApiToken
    ? new ApifyTikTokProvider()
    : new StubCobaltProvider();

  const instagram: MediaDownloadProvider =
    serverEnv.cobaltApiUrl && serverEnv.cobaltApiKey
      ? new CobaltProvider()
      : new StubCobaltProvider();

  return new RoutingDownloadProvider(tiktok, instagram);
}

function selectAnalyzer(): VideoAnalysisProvider {
  const key = serverEnv.geminiApiKey;
  if (key) {
    return new GeminiProvider(key);
  }
  return new StubGeminiProvider();
}

export function getIngestionService(): ContentIngestionService {
  if (!cached) {
    cached = new InlineIngestionService(selectDownloader(), selectAnalyzer());
  }
  return cached;
}
