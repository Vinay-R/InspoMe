import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-errors";
import { serverEnv } from "@/lib/env";

// Build the Instagram OAuth authorize URL and redirect the user. We stash a
// random `state` in an httpOnly cookie so the callback can verify the request
// is ours (CSRF defense) — also wrap the user id so the callback can attach
// the connection to the right account even if the session cookie thrashes
// during the IG redirect.
//
// Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login

const SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("unauthorized");

  if (!serverEnv.metaAppId || !serverEnv.metaAppSecret) {
    return apiError("provider_unavailable");
  }

  const state = `${user.id}.${randomBytes(16).toString("hex")}`;

  const authorizeUrl = new URL("https://www.instagram.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", serverEnv.metaAppId);
  authorizeUrl.searchParams.set("redirect_uri", serverEnv.instagramRedirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", SCOPES.join(","));
  authorizeUrl.searchParams.set("state", state);

  const jar = await cookies();
  jar.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  return NextResponse.redirect(authorizeUrl.toString());
}
