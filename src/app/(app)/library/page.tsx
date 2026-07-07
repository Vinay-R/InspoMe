import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LibraryView, type InspoCard } from "./library-view";

export const metadata: Metadata = {
  title: "Your Inspo — InspoMe",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

// video_analysis.tags is a jsonb object of grouped string arrays (AnalysisTags).
// The library only needs a flat, deduped list per item for filter chips.
// (Mirrors the same helper in /api/inspo GET — kept inline per file, no shared
// util, since both are tiny.)
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

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; platform?: string; add?: string }>;
}) {
  const params = await searchParams;
  const platform = params.platform ?? "";
  const welcome = params.welcome === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // `video_analysis` has two FKs to inspo (inspo_id, and the composite
  // (inspo_id, user_id) trust-hardening FK) — the embed must name the
  // constraint or PostgREST rejects it as ambiguous.
  let query = supabase
    .from("inspo")
    .select(
      "id, platform, url_original, url_canonical, deep_link_url, creator_handle, caption, thumbnail_url, save_reasons, analysis_status, media_status, metrics_status, created_at, last_analyzed_at, video_analysis!video_analysis_inspo_id_fkey(tags)",
    )
    .eq("user_id", user!.id)
    .eq("user_hidden", false)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (platform === "tiktok" || platform === "instagram") {
    query = query.eq("platform", platform);
  }

  const { data: inspoRows } = await query;

  const rows = (inspoRows ?? []) as Array<
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

  // A full first page implies more rows may exist beyond it.
  const initialNextCursor =
    items.length === PAGE_SIZE ? items[items.length - 1].created_at : null;

  return (
    <LibraryView
      key={platform}
      // Server rows carry every InspoCard field; the join shape above is
      // erased into `tags` before handoff.
      initialInspo={items as unknown as InspoCard[]}
      initialNextCursor={initialNextCursor}
      welcome={welcome}
    />
  );
}
