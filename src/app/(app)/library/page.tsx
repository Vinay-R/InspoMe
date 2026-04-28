import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LibraryView } from "./library-view";

export const metadata: Metadata = {
  title: "Your Inspo — InspoMe",
};

export const dynamic = "force-dynamic";

function postgrestQuoteValue(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; q?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const platform = params.platform ?? "";
  const welcome = params.welcome === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("inspo")
    .select(
      "id, platform, url_original, url_canonical, deep_link_url, creator_handle, caption, thumbnail_url, save_reasons, analysis_status, media_status, metrics_status, created_at, last_analyzed_at",
    )
    .eq("user_id", user!.id)
    .eq("user_hidden", false)
    .order("created_at", { ascending: false })
    .limit(60);

  if (platform === "tiktok" || platform === "instagram") {
    query = query.eq("platform", platform);
  }

  if (q) {
    const ilikeTerm = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const safe = postgrestQuoteValue(ilikeTerm);
    query = query.or(`caption.ilike.${safe},creator_handle.ilike.${safe}`);
  }

  const { data: inspoRows } = await query;

  return (
    <LibraryView
      key={`${q}|${platform}`}
      initialInspo={inspoRows ?? []}
      welcome={welcome}
      initialQ={q}
    />
  );
}
