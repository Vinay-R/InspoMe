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

// video_analysis.tags is a jsonb object of grouped string arrays (AnalysisTags).
// The library only needs a flat, deduped list per item for filter chips.
function flattenAnalysisTags(tags: unknown): string[] {
  if (!tags || typeof tags !== "object" || Array.isArray(tags)) return [];
  const out = new Set<string>();
  for (const group of Object.values(tags as Record<string, unknown>)) {
    if (!Array.isArray(group)) continue;
    for (const t of group) {
      if (typeof t === "string" && t.trim()) out.add(t.trim());
    }
  }
  return [...out];
}

const GET_PAGE_DEFAULT = 30;
const GET_PAGE_MAX = 60;
// Legacy (no cursor/limit params) callers — the library pollers — get the
// original fixed cap so their behavior is unchanged.
const GET_LEGACY_LIMIT = 100;

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
  const cursorParam = url.searchParams.get("cursor");
  const limitParam = url.searchParams.get("limit");

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

  // Cursor pagination is opt-in: only requests carrying `cursor` or `limit`
  // get paged semantics. Legacy pollers (no params) keep the old fixed cap
  // and full response shape.
  const paginated = cursorParam !== null || limitParam !== null;
  if (cursorParam !== null && Number.isNaN(Date.parse(cursorParam))) {
    return apiError("invalid_input", {
      devDetail: { param: "cursor", value: cursorParam },
    });
  }
  let limit = GET_LEGACY_LIMIT;
  if (paginated) {
    const parsedLimit = limitParam !== null ? Number.parseInt(limitParam, 10) : NaN;
    if (limitParam !== null && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
      return apiError("invalid_input", {
        devDetail: { param: "limit", value: limitParam },
      });
    }
    limit = Number.isInteger(parsedLimit)
      ? Math.min(parsedLimit, GET_PAGE_MAX)
      : GET_PAGE_DEFAULT;
  }

  // `video_analysis` has two FKs to inspo (inspo_id, and the composite
  // (inspo_id, user_id) trust-hardening FK) — the embed must name the
  // constraint or PostgREST rejects it as ambiguous.
  let query = supabase
    .from("inspo")
    .select(
      "id, platform, url_original, url_canonical, deep_link_url, creator_handle, caption, thumbnail_url, save_reasons, analysis_status, media_status, metrics_status, created_at, last_analyzed_at, video_analysis!video_analysis_inspo_id_fkey(tags)",
    )
    .eq("user_id", user.id)
    .eq("user_hidden", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursorParam !== null) query = query.lt("created_at", cursorParam);
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

  // Replace the embedded video_analysis row with a flat `tags: string[]` so
  // clients never see the join shape. PostgREST may return the one-to-one
  // embed as an object or a single-element array depending on how it detects
  // the unique index — normalize both.
  const rows = (data ?? []) as Array<
    Record<string, unknown> & {
      created_at: string;
      video_analysis?: unknown;
    }
  >;
  const items = rows.map(({ video_analysis, ...rest }) => {
    const embedded = Array.isArray(video_analysis)
      ? (video_analysis[0] as unknown)
      : video_analysis;
    const tags =
      embedded && typeof embedded === "object"
        ? flattenAnalysisTags((embedded as { tags?: unknown }).tags)
        : [];
    return { ...rest, tags };
  });

  // A full page implies more rows may exist; the last row's created_at is
  // the cursor for the next page.
  const nextCursor =
    paginated && items.length === limit
      ? items[items.length - 1].created_at
      : null;

  return NextResponse.json({
    success: true,
    data: items,
    ...(paginated ? { next_cursor: nextCursor } : {}),
  });
}
