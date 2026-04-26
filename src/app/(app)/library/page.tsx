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
  searchParams: Promise<{ welcome?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inspoRows } = await supabase
    .from("inspo")
    .select(
      "id, platform, url_original, url_canonical, deep_link_url, creator_handle, caption, thumbnail_url, save_reasons, analysis_status, media_status, metrics_status, created_at, last_analyzed_at",
    )
    .eq("user_id", user!.id)
    .eq("user_hidden", false)
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <LibraryView
      initialInspo={inspoRows ?? []}
      welcome={params.welcome === "1"}
    />
  );
}
