import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getIngestionService } from "@/server/ingestion/service";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, rateLimitedResponse } from "@/lib/api-errors";

// The ingestion pipeline runs inside waitUntil past the response (worst case
// ~420s of downloads + Gemini). 300s is the safe cross-plan ceiling; Pro
// plans can raise this to 800.
export const maxDuration = 300;

// ingestion_job_status values that mean "still running". Terminal set is
// failed / complete / partial (see 20260426000000_init_inspome_schema.sql).
const NON_TERMINAL_JOB_STATUSES = [
  "queued",
  "downloading",
  "downloaded",
  "uploading_to_gemini",
  "analyzing",
];

// A pipeline that hasn't reached a terminal status within this window is
// presumed dead (waitUntil ceiling is well under it) — allow a fresh retry.
const IN_FLIGHT_WINDOW_MS = 15 * 60 * 1000;

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

  // In-flight guard: don't stack a second pipeline on an inspo whose latest
  // job is still running and recent.
  const { data: latestJob } = await supabase
    .from("ingestion_jobs")
    .select("status, created_at, attempts")
    .eq("inspo_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    latestJob &&
    NON_TERMINAL_JOB_STATUSES.includes(latestJob.status) &&
    Date.now() - new Date(latestJob.created_at).getTime() < IN_FLIGHT_WINDOW_MS
  ) {
    return apiError("analysis_in_progress");
  }

  await supabase
    .from("inspo")
    .update({ analysis_status: "queued", media_status: "queued" })
    .eq("id", id);

  let result: { jobId: string; status: "queued" };
  try {
    result = await getIngestionService().enqueue({
      inspoId: inspo.id,
      userId: user.id,
      url: inspo.url_original,
      platform: inspo.platform,
      attempt: (latestJob?.attempts ?? 0) + 1,
    });
  } catch (e) {
    // Don't strand the row in `queued` — mark it failed so the retry button
    // stays available.
    await supabase
      .from("inspo")
      .update({ analysis_status: "failed", media_status: "failed" })
      .eq("id", id);
    return apiError("enqueue_failed", { cause: e });
  }

  return NextResponse.json({
    success: true,
    data: { job_id: result.jobId, status: result.status },
  });
}
