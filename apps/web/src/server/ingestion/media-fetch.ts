import "server-only";

import { serverEnv } from "@/lib/env";

// Shared header builder for fetching platform media/thumbnail bytes.
// Extracted from providers/gemini.ts so the thumbnail-persistence path in
// service.ts authenticates Apify KV-store URLs the exact same way.

export function buildMediaFetchHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = {
    // Send a real-looking UA — Instagram's CDN occasionally 403s default fetch.
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  };

  // Apify-hosted media lives in private Key-Value Store records by default.
  // Keep stored URLs token-free and authenticate only at fetch time.
  if (isApifyKeyValueStoreRecord(url)) {
    const token = serverEnv.apifyApiToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export function isApifyKeyValueStoreRecord(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.hostname === "api.apify.com" &&
      url.pathname.startsWith("/v2/key-value-stores/") &&
      url.pathname.includes("/records/")
    );
  } catch {
    return false;
  }
}
