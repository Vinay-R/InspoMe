import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LibraryView } from "./library-view";

export const metadata: Metadata = {
  title: "Your Inspo — InspoMe",
};

export const dynamic = "force-dynamic";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; platform?: string }>;
}) {
  const params = await searchParams;
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

  const { data: inspoRows } = await query;

  return (
    <LibraryView
      key={platform}
      initialInspo={inspoRows ?? []}
      welcome={welcome}
    />
  );
}
