import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Handles three callback shapes from Supabase Auth:
//   1. OAuth (Google):       ?code=<exchange_code>
//   2. Magic link (PKCE):    ?code=<exchange_code>
//   3. Magic link (OTP):     ?token_hash=<hash>&type=<magiclink|recovery|...>
//
// PKCE requires the code verifier cookie set during signInWithOtp; OTP does
// not, so it survives "open the link in a different browser" cleanly.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type") as EmailOtpType | null;
  const redirectTo = url.searchParams.get("redirect") ?? "/";
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return redirectToLoginWithError(url, errorDescription);
  }

  const supabase = await createClient();

  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (error) return redirectToLoginWithError(url, error.message);
    return NextResponse.redirect(new URL(redirectTo, url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return redirectToLoginWithError(url, error.message);
    return NextResponse.redirect(new URL(redirectTo, url.origin));
  }

  return NextResponse.redirect(new URL("/login", url.origin));
}

function redirectToLoginWithError(url: URL, message: string) {
  const next = new URL("/login", url.origin);
  next.searchParams.set("error", message);
  return NextResponse.redirect(next);
}
