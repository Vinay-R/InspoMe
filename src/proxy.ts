import type { NextRequest } from "next/server";
import { refreshSession } from "@/lib/supabase/session";

export async function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  matcher: [
    // manifest.webmanifest must stay public: browsers fetch it without cookies,
    // so an auth redirect here breaks PWA installability.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)",
  ],
};
