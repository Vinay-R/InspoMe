import "server-only";

// Cobalt's API doesn't return thumbnails, and we want a poster frame visible
// in the library card the moment the analysis kicks off. These helpers fetch
// a thumbnail from the platform's own metadata endpoints — best-effort only.
//
// All errors are swallowed; the UI falls back to a placeholder if undefined
// is returned.

const FETCH_TIMEOUT_MS = 5_000;

export async function getTikTokThumbnail(
  url: string,
): Promise<string | undefined> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { thumbnail_url?: unknown };
    return typeof data.thumbnail_url === "string" ? data.thumbnail_url : undefined;
  } catch {
    return undefined;
  }
}

// Instagram's oembed endpoint is gated behind a Facebook Graph access token
// since 2020, so we fall back to scraping the public page's `og:image` meta tag.
// Instagram occasionally returns a login wall to non-browser user agents — when
// that happens we just return undefined and the UI shows a placeholder.
export async function getInstagramOgImage(
  url: string,
): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html",
        // A real-looking UA reduces the chance of getting a login wall.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return undefined;
    const html = await res.text();

    // Match og:image regardless of attribute order. We grab content="..."
    // from the first og:image meta and decode HTML entities Instagram uses.
    const propertyFirst =
      /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i;
    const contentFirst =
      /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i;
    const match = html.match(propertyFirst) ?? html.match(contentFirst);
    if (!match?.[1]) return undefined;

    return decodeHtmlEntities(match[1]);
  } catch {
    return undefined;
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
