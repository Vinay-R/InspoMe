import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { waitUntil } from "@vercel/functions";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, rateLimitedResponse } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAnalyticsService, isMockAnalyticsMode } from "@/server/analytics/service";

const Schema = z.object({
  platform: z.enum(["instagram", "tiktok"]),
});

/**
 * In mock mode this creates a stub-flagged connected_account row and kicks
 * off an immediate sync. When real OAuth ships, this route returns an
 * authorize URL instead and the callback route does the upsert.
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

  if (!isMockAnalyticsMode()) {
    // Real OAuth not yet wired — see meta-instagram.ts / tiktok-display.ts.
    return apiError("provider_unavailable");
  }

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

  // Fire-and-forget the sync so the response returns fast and the UI can poll.
  waitUntil(
    getAnalyticsService()
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
