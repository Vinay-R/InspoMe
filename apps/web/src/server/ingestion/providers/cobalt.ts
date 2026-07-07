import "server-only";

import type {
  MediaDownloadProvider,
  MediaDownloadResult,
} from "../types";
import type { Platform } from "@/lib/supabase/types";
import { parseInspoUrl } from "@/lib/platform";
import { serverEnv } from "@/lib/env";
import { getTikTokThumbnail, getInstagramOgImage } from "../oembed";

// Production downloader. Talks to a self-hosted Cobalt instance over HTTP.
// API contract: POST `/` with `{ url }` returns one of:
//   - { status: "tunnel" | "redirect", url, filename }   ← success
//   - { status: "local-processing", ... }                ← unsupported in v1
//   - { status: "picker", ... }                          ← image slideshows; v1 punts
//   - { status: "error", error: { code, context? } }
//
// User-agent must match the `userAgents` allowlist in keys.json on the Cobalt
// side. We send "InspoMe/1.0" to fit the gist-deployed allowlist.

const COBALT_USER_AGENT = "InspoMe/1.0";
const COBALT_TIMEOUT_MS = 30_000;

type CobaltSuccess = {
  status: "tunnel" | "redirect";
  url: string;
  filename: string;
};

type CobaltError = {
  status: "error";
  error: {
    code: string;
    context?: { service?: string; limit?: number };
  };
  critical?: boolean;
};

type CobaltLocalProcessing = {
  status: "local-processing";
  type: string;
  service: string;
  tunnel: string[];
  output: { type?: string; filename?: string };
};

type CobaltPicker = {
  status: "picker";
  picker: Array<{ type: "photo" | "video" | "gif"; url: string; thumb?: string }>;
};

type CobaltResponse =
  | CobaltSuccess
  | CobaltError
  | CobaltLocalProcessing
  | CobaltPicker;

export class CobaltProvider implements MediaDownloadProvider {
  readonly name = "cobalt";

  canHandle(url: string): boolean {
    const { platform } = parseInspoUrl(url);
    return platform === "tiktok" || platform === "instagram";
  }

  async download(url: string): Promise<MediaDownloadResult> {
    const parsed = parseInspoUrl(url);
    if (parsed.platform === "unknown") {
      return failure(
        parsed.platform,
        url,
        "unsupported_platform",
        "Only TikTok and Instagram URLs are supported.",
      );
    }

    const apiUrl = serverEnv.cobaltApiUrl;
    const apiKey = serverEnv.cobaltApiKey;
    if (!apiUrl || !apiKey) {
      return failure(
        parsed.platform,
        url,
        "cobalt_not_configured",
        "Media download service is not configured.",
      );
    }

    const cobaltRes = await callCobalt(apiUrl, apiKey, parsed.canonical ?? url);
    if (cobaltRes.kind === "exception") {
      return failure(
        parsed.platform,
        url,
        "cobalt_request_failed",
        // Cobalt and network errors stay generic for end users; the raw
        // message is logged via `console.error` from the service layer.
        "Couldn't reach the download service. Try again in a minute.",
      );
    }

    const body = cobaltRes.body;

    if (body.status === "error") {
      return failure(
        parsed.platform,
        url,
        body.error.code,
        humanizeCobaltError(body.error.code, body.error.context?.service),
      );
    }

    if (body.status === "picker") {
      return failure(
        parsed.platform,
        url,
        "slideshow_unsupported",
        "Image slideshows aren't supported yet — only video posts.",
      );
    }

    if (body.status === "local-processing") {
      // Cobalt wants us to remux/transcode client-side. We don't run ffmpeg
      // in the ingestion path, so we surface this as unsupported. Only hits
      // for niche services and codec combinations — not TikTok/IG video.
      return failure(
        parsed.platform,
        url,
        "local_processing_unsupported",
        "This content needs client-side processing, which isn't supported.",
      );
    }

    // body.status is "tunnel" | "redirect" — both give us a URL to fetch.
    // tunnel = proxied through cobalt (90s lifespan by default).
    // redirect = direct platform CDN URL (lifespan varies).
    const thumbnailUrl = await fetchThumbnail(parsed.platform, url);

    return {
      success: true,
      platform: parsed.platform,
      sourceUrl: url,
      mediaFileUrl: body.url,
      thumbnailUrl,
      creatorHandle: parsed.creatorHandle ?? undefined,
      // duration / fileSize / mimeType / caption arrive later from the analyzer
      // or post-download metadata extraction. Cobalt's response doesn't include them.
    };
  }
}

type CobaltCallResult =
  | { kind: "ok"; body: CobaltResponse }
  | { kind: "exception"; error: unknown };

async function callCobalt(
  apiUrl: string,
  apiKey: string,
  url: string,
): Promise<CobaltCallResult> {
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Api-Key ${apiKey}`,
        "User-Agent": COBALT_USER_AGENT,
      },
      body: JSON.stringify({
        url,
        downloadMode: "auto",
        videoQuality: "1080",
        filenameStyle: "basic",
      }),
      signal: AbortSignal.timeout(COBALT_TIMEOUT_MS),
    });

    // Cobalt always replies JSON (even on error). If we get HTML or empty
    // body, that's a Railway/proxy-level failure — treat it as exception.
    const text = await res.text();
    try {
      const body = JSON.parse(text) as CobaltResponse;
      return { kind: "ok", body };
    } catch {
      console.error("[cobalt] non-JSON response", res.status, text.slice(0, 200));
      return { kind: "exception", error: new Error(`HTTP ${res.status} non-JSON`) };
    }
  } catch (e) {
    console.error("[cobalt] fetch failed", e);
    return { kind: "exception", error: e };
  }
}

async function fetchThumbnail(
  platform: Exclude<Platform, "unknown">,
  url: string,
): Promise<string | undefined> {
  if (platform === "tiktok") return getTikTokThumbnail(url);
  if (platform === "instagram") return getInstagramOgImage(url);
  return undefined;
}

function failure(
  platform: Platform,
  sourceUrl: string,
  errorCode: string,
  errorMessage: string,
): MediaDownloadResult {
  return {
    success: false,
    platform,
    sourceUrl,
    errorCode,
    errorMessage,
  };
}

// Cobalt's error codes are dotted strings (e.g. "error.api.content.post.unavailable").
// Map the common ones to product-friendly text. Unknown codes fall through verbatim
// so we keep diagnostic value when something new breaks upstream.
function humanizeCobaltError(code: string, service?: string): string {
  const map: Record<string, string> = {
    "error.api.content.post.unavailable":
      "This video isn't available — it may be deleted, private, or region-locked.",
    "error.api.content.post.private": "This account is private.",
    "error.api.content.post.age": "This video is age-restricted.",
    "error.api.fetch.empty": "The platform returned no content for this URL.",
    "error.api.fetch.short_link": "Couldn't resolve the short URL.",
    "error.api.rate_exceeded":
      "Too many downloads at once — try again shortly.",
    "error.api.timed_out": "Platform took too long to respond.",
    "error.api.unsupported": "This URL pattern isn't supported yet.",
    "error.api.auth.key.invalid": "Internal: download service key is invalid.",
    "error.api.auth.key.ua_not_allowed":
      "Internal: download service rejected the request.",
  };

  if (code === "error.api.fetch.critical.core") {
    return service === "tiktok"
      ? "TikTok blocked the download. This often resolves on its own — try again in a few minutes."
      : "The platform blocked the download. Try again later.";
  }

  return map[code] ?? `Download failed (${code}).`;
}
