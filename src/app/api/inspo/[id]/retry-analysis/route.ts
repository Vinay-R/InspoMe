import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIngestionService } from "@/server/ingestion/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, rateLimitedResponse } from "@/lib/api-errors";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("unauthorized");

  const rl = await checkRateLimit(user.id);
  if (!rl.allowed) return rateLimitedResponse(rl.resetAt);

  const { data: inspo } = await supabase
    .from("inspo")
    .select("id, user_id, url_original, platform")
    .eq("id", id)
    .maybeSingle();

  if (!inspo) return apiError("not_found");

  // Defense-in-depth: RLS already filters this query to the session user's
  // rows, so reaching here with a mismatched user_id implies a misconfigured
  // policy. Fail closed instead of silently triggering work for another user.
  if (inspo.user_id !== user.id) return apiError("forbidden");

  await supabase
    .from("inspo")
    .update({ analysis_status: "queued", media_status: "queued" })
    .eq("id", id);

  const result = await getIngestionService().enqueue({
    inspoId: inspo.id,
    userId: user.id,
    url: inspo.url_original,
    platform: inspo.platform,
  });

  return NextResponse.json({
    success: true,
    data: { job_id: result.jobId, status: result.status },
  });
}
