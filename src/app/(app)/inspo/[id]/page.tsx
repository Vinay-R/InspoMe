import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InspoDetailView } from "./inspo-detail-view";
import type {
  InspoRow,
  PlatformMetricsRow,
  VideoAnalysisRow,
  IngestionJobRow,
} from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Inspo — InspoMe",
};

export const dynamic = "force-dynamic";

export default async function InspoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: inspo } = await supabase
    .from("inspo")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!inspo) notFound();

  const [{ data: analysis }, { data: metrics }, { data: job }] =
    await Promise.all([
      supabase
        .from("video_analysis")
        .select("*")
        .eq("inspo_id", id)
        .maybeSingle(),
      supabase
        .from("platform_metrics")
        .select("*")
        .eq("inspo_id", id)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("ingestion_jobs")
        .select("*")
        .eq("inspo_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return (
    <InspoDetailView
      initialInspo={inspo as InspoRow}
      initialAnalysis={analysis as VideoAnalysisRow | null}
      initialMetrics={metrics as PlatformMetricsRow | null}
      initialJob={job as IngestionJobRow | null}
    />
  );
}
