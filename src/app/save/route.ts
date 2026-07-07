import { NextResponse, type NextRequest } from "next/server";

// Android share sheets put the shared link in `url`, `text`, or even `title`
// depending on the source app, often embedded in surrounding prose — scan
// each param and take the first http(s) URL found.
const HTTP_URL_PATTERN = /https?:\/\/[^\s"'<>]+/i;

function extractSharedUrl(params: URLSearchParams): string | null {
  for (const key of ["url", "text", "title"]) {
    const value = params.get(key);
    if (!value) continue;
    const match = value.match(HTTP_URL_PATTERN);
    if (match) return match[0];
  }
  return null;
}

export function GET(request: NextRequest) {
  const sharedUrl = extractSharedUrl(request.nextUrl.searchParams);
  const destination = new URL(
    sharedUrl ? `/library?add=${encodeURIComponent(sharedUrl)}` : "/library",
    request.nextUrl.origin,
  );
  return NextResponse.redirect(destination, 307);
}
