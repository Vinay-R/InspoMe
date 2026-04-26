import "server-only";

import type {
  ContentIngestionService,
  IngestionInput,
  MediaDownloadProvider,
  VideoAnalysisProvider,
} from "./types";
import { StubCobaltProvider } from "./providers/stub-cobalt";
import { StubGeminiProvider } from "./providers/stub-gemini";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Owns the lifecycle of a single ingestion job:
 *   inspo → download → analyze → persist → update inspo statuses
 *
 * Phase 1 runs the work inline via setImmediate so we don't need a real queue.
 * Phase 2 swaps the inline runner for a queued worker (Vercel Workflow / a job
 * runner) without touching callers.
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
        attempts: 0,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      throw new Error(jobErr?.message ?? "Failed to create ingestion job.");
    }

    await admin
      .from("inspo")
      .update({
        media_status: "queued",
        analysis_status: "queued",
      })
      .eq("id", input.inspoId);

    // Fire-and-forget. In Phase 1 this runs in the same process.
    queueMicrotask(() => {
      void this.run(job.id, input).catch((e) => {
        console.error("[ingestion] unhandled error", e);
      });
    });

    return { jobId: job.id, status: "queued" };
  }

  private async run(jobId: string, input: IngestionInput): Promise<void> {
    const admin = createAdminClient();
    const startedAt = new Date().toISOString();

    await admin
      .from("ingestion_jobs")
      .update({
        status: "downloading",
        started_at: startedAt,
        attempts: 1,
      })
      .eq("id", jobId);

    await admin
      .from("inspo")
      .update({ media_status: "queued" })
      .eq("id", input.inspoId);

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
      await admin
        .from("ingestion_jobs")
        .update({
          status: "failed",
          error_code: dl.errorCode ?? "download_failed",
          error_message: dl.errorMessage ?? "Download failed.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      await admin
        .from("inspo")
        .update({
          media_status: "failed",
          analysis_status: "failed",
          metrics_status: "unavailable",
          access_status: "unavailable",
        })
        .eq("id", input.inspoId);
      return;
    }

    await admin
      .from("ingestion_jobs")
      .update({ status: "downloaded" })
      .eq("id", jobId);

    await admin
      .from("inspo")
      .update({
        media_status: "downloaded",
        thumbnail_url: dl.thumbnailUrl ?? null,
        duration_seconds: dl.durationSeconds ?? null,
        creator_handle: dl.creatorHandle ?? null,
        caption: dl.caption ?? null,
        media_storage_url: dl.mediaFileUrl ?? null,
        access_status: "accessible",
      })
      .eq("id", input.inspoId);

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
      await admin
        .from("ingestion_jobs")
        .update({
          status: "failed",
          error_code: "context_missing",
          error_message: "Could not load inspo or user context.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      await admin
        .from("inspo")
        .update({ analysis_status: "failed" })
        .eq("id", input.inspoId);
      return;
    }

    await admin
      .from("ingestion_jobs")
      .update({ status: "uploading_to_gemini" })
      .eq("id", jobId);

    await admin
      .from("ingestion_jobs")
      .update({ status: "analyzing" })
      .eq("id", jobId);

    await admin
      .from("inspo")
      .update({ analysis_status: "processing" })
      .eq("id", input.inspoId);

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
      const msg = e instanceof Error ? e.message : "Analysis failed.";
      await admin
        .from("ingestion_jobs")
        .update({
          status: "failed",
          error_code: "analysis_failed",
          error_message: msg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      await admin
        .from("inspo")
        .update({ analysis_status: "failed" })
        .eq("id", input.inspoId);
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
      await admin
        .from("ingestion_jobs")
        .update({
          status: "failed",
          error_code: "persist_failed",
          error_message: upsertErr.message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      await admin
        .from("inspo")
        .update({ analysis_status: "failed" })
        .eq("id", input.inspoId);
      return;
    }

    await admin
      .from("ingestion_jobs")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    await admin
      .from("inspo")
      .update({
        analysis_status: "complete",
        last_analyzed_at: new Date().toISOString(),
        // Phase 1 has no real metrics provider — mark unavailable so the UI
        // shows the right empty state instead of a perpetual loader.
        metrics_status: "unavailable",
      })
      .eq("id", input.inspoId);
  }
}

let cached: InlineIngestionService | null = null;

export function getIngestionService(): ContentIngestionService {
  if (!cached) {
    cached = new InlineIngestionService(
      new StubCobaltProvider(),
      new StubGeminiProvider(),
    );
  }
  return cached;
}
