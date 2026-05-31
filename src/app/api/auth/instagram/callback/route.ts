import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { waitUntil } from "@vercel/functions";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { encryptToken } from "@/lib/crypto";
import { getAnalyticsService } from "@/server/analytics/service";

// Instagram redirects back here with `?code=...&state=...` after the user
// authorizes. We:
//   1. Verify state (CSRF).
//   2. Exchange the code for a short-lived access token + IG user id.
//   3. Exchange the short-lived token for a long-lived (~60-day) token.
//   4. Persist the connection (encrypted at rest), kick off the first sync.
//   5. Redirect back to /analytics.

const FAIL_REDIRECT = "/analytics?ig_error=";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const igError = url.searchParams.get("error");

  if (igError) {
    return NextResponse.redirect(
      new URL(`${FAIL_REDIRECT}${encodeURIComponent(igError)}`, url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL(`${FAIL_REDIRECT}missing_code`, url));
  }

  const jar = await cookies();
  const cookieState = jar.get("ig_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL(`${FAIL_REDIRECT}state_mismatch`, url));
  }
  jar.delete("ig_oauth_state");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // State is `<user_id>.<nonce>`; cross-check the state's user id matches the
  // session user so a stolen state can't attach a connection to someone else.
  const [stateUserId] = state.split(".");
  if (!user || user.id !== stateUserId) {
    return NextResponse.redirect(new URL(`${FAIL_REDIRECT}unauthorized`, url));
  }

  if (!serverEnv.metaAppId || !serverEnv.metaAppSecret) {
    return NextResponse.redirect(
      new URL(`${FAIL_REDIRECT}provider_unavailable`, url),
    );
  }

  // ── 1. Short-lived token ────────────────────────────────────────
  let shortLived: { access_token: string; user_id: string | number };
  try {
    const body = new URLSearchParams({
      client_id: serverEnv.metaAppId,
      client_secret: serverEnv.metaAppSecret,
      grant_type: "authorization_code",
      redirect_uri: serverEnv.instagramRedirectUri,
      code,
    });
    const res = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[ig-oauth] short-lived exchange failed", res.status, text);
      return NextResponse.redirect(
        new URL(`${FAIL_REDIRECT}token_exchange_failed`, url),
      );
    }
    shortLived = await res.json();
  } catch (e) {
    console.error("[ig-oauth] short-lived exchange threw", e);
    return NextResponse.redirect(new URL(`${FAIL_REDIRECT}network`, url));
  }

  // ── 2. Long-lived token (60 days, refreshable) ──────────────────
  let longLived: { access_token: string; expires_in: number };
  try {
    const params = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: serverEnv.metaAppSecret,
      access_token: shortLived.access_token,
    });
    const res = await fetch(
      `https://graph.instagram.com/access_token?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error("[ig-oauth] long-lived exchange failed", res.status, text);
      return NextResponse.redirect(
        new URL(`${FAIL_REDIRECT}long_lived_exchange_failed`, url),
      );
    }
    longLived = await res.json();
  } catch (e) {
    console.error("[ig-oauth] long-lived exchange threw", e);
    return NextResponse.redirect(new URL(`${FAIL_REDIRECT}network`, url));
  }

  // ── 3. Fetch basic profile so we can label the connection ──────
  let profile: { id: string; username?: string; account_type?: string } = {
    id: String(shortLived.user_id),
  };
  try {
    const params = new URLSearchParams({
      fields: "id,username,account_type",
      access_token: longLived.access_token,
    });
    const res = await fetch(`https://graph.instagram.com/me?${params.toString()}`);
    if (res.ok) profile = await res.json();
  } catch {
    // non-fatal — we already have the user id
  }

  // ── 4. Persist + kick off initial sync ──────────────────────────
  const admin = createAdminClient();
  const tokenExpiresAt = new Date(
    Date.now() + (longLived.expires_in ?? 60 * 86_400) * 1000,
  ).toISOString();

  const { data: account, error } = await admin
    .from("connected_accounts")
    .upsert(
      {
        user_id: user.id,
        platform: "instagram",
        platform_user_id: profile.id,
        username: profile.username ?? null,
        display_name: profile.username ?? null,
        access_token_encrypted: encryptToken(longLived.access_token),
        token_expires_at: tokenExpiresAt,
        scopes: ["instagram_business_basic", "instagram_business_manage_insights"],
        connection_status: "syncing",
        is_mock: false,
        last_sync_error: null,
      },
      { onConflict: "user_id,platform" },
    )
    .select("*")
    .single();

  if (error || !account) {
    console.error("[ig-oauth] upsert failed", error);
    return NextResponse.redirect(new URL(`${FAIL_REDIRECT}persist_failed`, url));
  }

  waitUntil(
    getAnalyticsService()
      .syncAndPersist(account)
      .catch((e) => console.error("[ig-oauth] initial sync failed", e)),
  );

  return NextResponse.redirect(new URL("/analytics?ig_connected=1", url));
}
