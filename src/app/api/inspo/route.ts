import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseInspoUrl, isSupportedPlatform } from "@/lib/platform";
import { getIngestionService } from "@/server/ingestion/service";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  apiError,
  rateLimitedResponse,
  userMessageFor,
} from "@/lib/api-errors";

// The ingestion pipeline runs inside waitUntil past the response (worst case
// ~420s of downloads + Gemini). 300s is the safe cross-plan ceiling; Pro
// plans can raise this to 800.
export const maxDuration = 300;

const CreateSchema = z.object({
  url: z.string().min(1).max(2000),
  save_reasons: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  note: z.string().max(280).optional().nullable(),
});

// Wraps a value for PostgREST's `.or()` filter so reserved characters
// (`,`, `.`, `:`, `(`, `)`) inside the value don't break the filter syntax.
function postgrestQuoteValue(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("unauthorized");

  const rl = await checkRateLimit(user.id);
  if (!rl.allowed) return rateLimitedResponse(rl.resetAt);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_input");
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_input", {
      devDetail: { issues: parsed.error.flatten() },
    });
  }

  const { url, save_reasons, note } = parsed.data;
  const u = parseInspoUrl(url);

  if (!isSupportedPlatform(u.platform)) return apiError("unsupported_url");

  // Save first — the spec invariant. Enrichment kicks off after.
  const { data: inspo, error } = await supabase
    .from("inspo")
    .insert({
      user_id: user.id,
      url_original: url,
      url_canonical: u.canonical,
      platform: u.platform,
      platform_content_id: u.contentId,
      creator_handle: u.creatorHandle,
      deep_link_url: u.canonical ?? url,
      save_reasons,
      note: note ?? null,
      analysis_status: "queued",
      media_status: "queued",
    })
    .select("id, platform, created_at, analysis_status")
    .single();

  if (error || !inspo) {
    // 23505 = unique_violation on inspo_user_url_uniq (user_id, url_canonical
    // where not hidden). Idempotent save: hand back the existing row instead
    // of erroring so the client can navigate straight to it.
    if (error?.code === "23505" && u.canonical) {
      const { data: existing } = await supabase
        .from("inspo")
        .select("id, platform, created_at, analysis_status")
        .eq("user_id", user.id)
        .eq("url_canonical", u.canonical)
        .eq("user_hidden", false)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({
          success: true,
          data: {
            inspo_id: existing.id,
            platform: existing.platform,
            created_at: existing.created_at,
            analysis_status: existing.analysis_status,
            duplicate: true,
          },
        });
      }
    }
    return apiError("save_failed", { cause: error });
  }

  try {
    await getIngestionService().enqueue({
      inspoId: inspo.id,
      userId: user.id,
      url,
      platform: u.platform,
    });
  } catch (e) {
    console.error("[api/inspo] enqueue failed", e);
    // Non-fatal — the inspo is saved. But a row stranded in `queued` never
    // shows the retry button (retry UI keys off `failed`), so mark the
    // statuses honestly and tell the client the real state.
    const { error: failErr } = await supabase
      .from("inspo")
      .update({ analysis_status: "failed", media_status: "failed" })
      .eq("id", inspo.id);
    if (failErr) {
      console.error(
        "[api/inspo] could not mark inspo failed after enqueue error",
        failErr,
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        inspo_id: inspo.id,
        platform: inspo.platform,
        created_at: inspo.created_at,
        analysis_status: "failed",
        error_code: "enqueue_failed",
        message: userMessageFor("enqueue_failed"),
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      inspo_id: inspo.id,
      platform: inspo.platform,
      created_at: inspo.created_at,
      analysis_status: inspo.analysis_status,
    },
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("unauthorized");

  const url = new URL(request.url);
  const platform = url.searchParams.get("platform");
  const analysisStatus = url.searchParams.get("analysis_status");
  const search = url.searchParams.get("search")?.trim();

  // Validate enum-typed params up front — Postgres throws a 500-producing
  // enum cast error on garbage values like `?platform=<script>`.
  const PLATFORM_VALUES = ["tiktok", "instagram", "unknown"];
  const ANALYSIS_STATUS_VALUES = [
    "not_started",
    "queued",
    "processing",
    "complete",
    "partial",
    "failed",
  ];
  if (platform && !PLATFORM_VALUES.includes(platform)) {
    return apiError("invalid_input", {
      devDetail: { param: "platform", value: platform },
    });
  }
  if (analysisStatus && !ANALYSIS_STATUS_VALUES.includes(analysisStatus)) {
    return apiError("invalid_input", {
      devDetail: { param: "analysis_status", value: analysisStatus },
    });
  }

  let query = supabase
    .from("inspo")
    .select(
      "id, platform, url_original, url_canonical, deep_link_url, creator_handle, caption, thumbnail_url, save_reasons, analysis_status, media_status, metrics_status, created_at, last_analyzed_at",
    )
    .eq("user_id", user.id)
    .eq("user_hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (platform) query = query.eq("platform", platform);
  if (analysisStatus) query = query.eq("analysis_status", analysisStatus);
  if (search) {
    // Escape ILIKE wildcards in the term, then wrap the whole value in
    // double quotes so PostgREST's `.or()` parser treats it as a single
    // value even if it contains commas, periods, or parens. Without this
    // wrap, a search like `,id.eq.<uuid>` would inject extra filters.
    const ilikeTerm = `%${search.replace(/[%_]/g, "\\$&")}%`;
    const safe = postgrestQuoteValue(ilikeTerm);
    query = query.or(`caption.ilike.${safe},creator_handle.ilike.${safe}`);
  }

  const { data, error } = await query;
  if (error) {
    return apiError("internal", { cause: error });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
