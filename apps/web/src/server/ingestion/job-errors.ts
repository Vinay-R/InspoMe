import "server-only";

// ingestion_jobs.error_message renders verbatim on the detail page, so raw
// exception text (Zod dumps, "HTTP 403", Postgres errors) must never be
// written there. This mapper logs the raw error server-side (keyed by job id)
// and returns a short user-safe message per pipeline stage — same tone as
// humanizeCobaltError in providers/cobalt.ts.

export type JobFailureStage = "download" | "analysis" | "persist";

const STAGE_MESSAGES: Record<JobFailureStage, string> = {
  download: "We couldn't download this video. It may be private or removed.",
  analysis:
    "The analysis model returned an unexpected response. Retry usually fixes this.",
  persist: "Something went wrong while saving the analysis.",
};

/**
 * Log the raw error with the job id and return the user-safe message to
 * store in ingestion_jobs.error_message.
 */
export function userSafeJobError(
  stage: JobFailureStage,
  jobId: string,
  rawError: unknown,
): string {
  console.error(`[ingestion] job ${jobId} failed at stage=${stage}`, rawError);
  return STAGE_MESSAGES[stage];
}
