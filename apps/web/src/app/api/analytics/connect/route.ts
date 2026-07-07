import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { waitUntil } from "@vercel/functions";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, rateLimitedResponse } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAnalyticsService } from "@/server/analytics/service";

const Schema = z.object({
  platform: z.enum(["instagram", "tiktok"]),
});

/**
 * Connect flow:
 *  - If the real provider for the platform can connect (OAuth creds present),
 *    return an authorize_url. The client redirects there and the OAuth
 *    callback route handles the upsert + initial sync.
 *  - Otherwise we create a stub-flagged connected_account and kick off a
 *    synthetic sync so the user can preview the experience.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("unauthorized");

  const rl = await checkRateLimit(user.id);
  if (!rl.allowed) return rateLimitedResponse(rl.resetAt);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_input");
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_input", { devDetail: { issues: parsed.error.flatten() } });
  }
  const { platform } = parsed.data;

  const service = getAnalyticsService();
  if (service.canConnectReal(platform)) {
    const authorize_url =
      platform === "instagram" ? "/api/auth/instagram" : "/api/auth/tiktok";
    return NextResponse.json({
      success: true,
      data: { platform, authorize_url, is_mock: false },
    });
  }

  // Stub path — create a demo account and sync mock data inline.
  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from("connected_accounts")
    .upsert(
      {
        user_id: user.id,
        platform,
        connection_status: "syncing",
        is_mock: true,
        username: "you (demo)",
        display_name:
          platform === "instagram" ? "Demo Instagram" : "Demo TikTok",
        scopes: [],
      },
      { onConflict: "user_id,platform" },
    )
    .select("*")
    .single();

  if (error || !account) {
    return apiError("internal", { cause: error });
  }

  waitUntil(
    service
      .syncAndPersist(account)
      .catch((e) => console.error("[analytics/connect] sync failed", e)),
  );

  return NextResponse.json({
    success: true,
    data: { account_id: account.id, platform: account.platform, is_mock: true },
  });
}

/** Disconnect — soft removal that drops everything we synced. */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("unauthorized");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_input");
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return apiError("invalid_input");
  const { platform } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .from("connected_accounts")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", platform);
  if (error) return apiError("internal", { cause: error });
  return NextResponse.json({ success: true });
}
