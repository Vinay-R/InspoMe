import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { waitUntil } from "@vercel/functions";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, rateLimitedResponse } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAnalyticsService } from "@/server/analytics/service";

// Sync work runs inside waitUntil past the response. 300s is the safe
// cross-plan ceiling; Pro plans can raise it to 800.
export const maxDuration = 300;

const Schema = z.object({
  platform: z.enum(["instagram", "tiktok"]).optional(),
});

/** Re-sync one or all of the user's connected accounts. Fire-and-forget. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("unauthorized");

  const rl = await checkRateLimit(user.id);
  if (!rl.allowed) return rateLimitedResponse(rl.resetAt);

  let body: unknown = {};
  try {
    if (request.headers.get("content-length") !== "0") body = await request.json();
  } catch {
    return apiError("invalid_input");
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return apiError("invalid_input");

  const admin = createAdminClient();
  let query = admin
    .from("connected_accounts")
    .select("*")
    .eq("user_id", user.id);
  if (parsed.data.platform) query = query.eq("platform", parsed.data.platform);

  const { data: accounts, error } = await query;
  if (error) return apiError("internal", { cause: error });
  if (!accounts || accounts.length === 0) {
    return apiError("account_not_connected");
  }

  // Mark each as syncing immediately so the UI shows the right state.
  await admin
    .from("connected_accounts")
    .update({ connection_status: "syncing" })
    .in("id", accounts.map((a) => a.id));

  const service = getAnalyticsService();
  for (const account of accounts) {
    waitUntil(
      service.syncAndPersist(account).catch((e) => {
        console.error("[analytics/sync] failed", account.platform, e);
      }),
    );
  }

  return NextResponse.json({
    success: true,
    data: { syncing: accounts.map((a) => ({ id: a.id, platform: a.platform })) },
  });
}
