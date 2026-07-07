import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");
  const isMarketingRoot = pathname === "/";
  // Legal pages must be readable before sign-up (they're linked from /login).
  const isLegalRoute = pathname === "/terms" || pathname === "/privacy";

  if (!user && !isAuthRoute && !isMarketingRoot && !isLegalRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") {
      // Keep the query string so share-target URLs (/save?url=...) survive the
      // login round-trip; the auth callback only accepts same-origin paths.
      url.searchParams.set("redirect", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(url);
  }

  return response;
}
