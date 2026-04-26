import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIngestionService } from "@/server/ingestion/service";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: inspo } = await supabase
    .from("inspo")
    .select("id, user_id, url_original, platform")
    .eq("id", id)
    .maybeSingle();

  if (!inspo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await supabase
    .from("inspo")
    .update({ analysis_status: "queued", media_status: "queued" })
    .eq("id", id);

  const result = await getIngestionService().enqueue({
    inspoId: inspo.id,
    userId: inspo.user_id,
    url: inspo.url_original,
    platform: inspo.platform,
  });

  return NextResponse.json({
    success: true,
    data: { job_id: result.jobId, status: result.status },
  });
}
