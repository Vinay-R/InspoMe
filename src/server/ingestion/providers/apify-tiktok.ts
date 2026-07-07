import "server-only";

import type {
  MediaDownloadProvider,
  MediaDownloadResult,
} from "../types";
import { parseInspoUrl } from "@/lib/platform";
import { serverEnv } from "@/lib/env";

// TikTok blocks datacenter IPs (the reason Cobalt fails for TikTok URLs), so
// we route TikTok through Apify instead. Apify actors run on residential-IP
// infrastructure and are maintained against TikTok's anti-bot updates — at
// our volume (~$1-2/mo) it's a much better tradeoff than running our own
// residential proxies.
//
// API: run-sync-get-dataset-items returns the scraped data inline. We pass
// the post URL, the actor scrapes one post, returns metadata + the no-watermark
// MP4 URL we hand to Gemini for analysis.
//
// Default actor: clockworks/tiktok-scraper. Override via APIFY_TIKTOK_ACTOR.

const APIFY_TIMEOUT_MS = 90_000;

// Defensive type for the dataset items — actor schemas vary across versions
// and forks, so we read fields by multiple known paths and fall back gracefully.
// Optional everywhere; we narrow at parse time.
type ApifyTikTokItem = {
  id?: string;
  text?: string;
  webVideoUrl?: string;
  isSlideshow?: boolean;
  authorMeta?: {
    name?: string;
    nickName?: string;
    uniqueId?: string;
  };
  videoMeta?: {
    duration?: number;
    cover?: string;
    coverUrl?: string;
    originalCoverUrl?: string;
    downloadAddr?: string;
    playAddr?: string;
  };
  // clockworks/tiktok-scraper returns Apify-hosted KV store URLs here when
  // shouldDownloadVideos is true. Other forks may use videoMeta.* paths.
  mediaUrls?: string[];
  videoUrl?: string;
  // Error/empty signals — the actor returns an item with `error` when the
  // post is unavailable instead of an empty array.
  error?: string;
};

export class ApifyTikTokProvider implements MediaDownloadProvider {
  readonly name = "apify-tiktok";

  canHandle(url: string): boolean {
    return parseInspoUrl(url).platform === "tiktok";
  }

  async download(url: string): Promise<MediaDownloadResult> {
    const parsed = parseInspoUrl(url);
    if (parsed.platform !== "tiktok") {
      return failure(
        parsed.platform,
        url,
        "wrong_platform",
        "Apify TikTok provider only handles TikTok URLs.",
      );
    }

    const token = serverEnv.apifyApiToken;
    if (!token) {
      return failure(
        parsed.platform,
        url,
        "apify_not_configured",
        "TikTok download service is not configured.",
      );
    }

    // Apify actor IDs are "username/actor-name" but the URL form uses "~"
    // as the separator. Both forms are accepted by the API; we normalize here.
    const actorPath = serverEnv.apifyTikTokActor.replace("/", "~");
    const endpoint = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          postURLs: [parsed.canonical ?? url],
          resultsPerPage: 1,
          // clockworks/tiktok-scraper only populates mediaUrls when this is
          // true — it downloads the video to Apify's KV store and returns
          // public URLs we can fetch. Without this flag, mediaUrls is empty.
          shouldDownloadVideos: true,
          shouldDownloadCovers: false,
          proxyCountryCode: "US",
        }),
        signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
      });
    } catch (e) {
      console.error("[apify-tiktok] fetch failed", e);
      return failure(
        parsed.platform,
        url,
        "apify_request_failed",
        "Couldn't reach the TikTok download service. Try again in a minute.",
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[apify-tiktok] non-OK", res.status, text.slice(0, 200));
      return failure(
        parsed.platform,
        url,
        "apify_http_error",
        res.status === 401 || res.status === 403
          ? "TikTok download service rejected the request."
          : "TikTok download service had a hiccup. Try again later.",
      );
    }

    let items: ApifyTikTokItem[];
    try {
      items = (await res.json()) as ApifyTikTokItem[];
    } catch {
      return failure(
        parsed.platform,
        url,
        "apify_invalid_response",
        "TikTok download service returned an unexpected response.",
      );
    }

    const item = items[0];
    if (!item || item.error) {
      // Apify's `error` string is a raw internal message — log it for
      // diagnosis, but never surface it to the user verbatim.
      if (item?.error) {
        console.error("[apify-tiktok] actor returned error item", item.error);
      }
      return failure(
        parsed.platform,
        url,
        "tiktok_post_unavailable",
        "This TikTok video isn't available — it may be deleted, private, or region-locked.",
      );
    }

    if (item.isSlideshow) {
      return failure(
        parsed.platform,
        url,
        "tiktok_slideshow",
        "TikTok slideshows aren't supported yet — only video posts.",
      );
    }

    const mediaUrl = pickMediaUrl(item);
    if (!mediaUrl) {
      // The actor returned a video post but our parser didn't find a URL at
      // any known field path. Log the shape so we can extend pickMediaUrl.
      console.error(
        "[apify-tiktok] no media URL in response. top-level keys:",
        Object.keys(item),
        "videoMeta keys:",
        item.videoMeta ? Object.keys(item.videoMeta) : "(none)",
        "sample:",
        JSON.stringify(item).slice(0, 800),
      );
      return failure(
        parsed.platform,
        url,
        "tiktok_no_media",
        "Couldn't extract a video file from this TikTok post.",
      );
    }

    return {
      success: true,
      platform: parsed.platform,
      sourceUrl: url,
      mediaFileUrl: mediaUrl,
      thumbnailUrl: pickThumbnail(item),
      durationSeconds: item.videoMeta?.duration ?? undefined,
      creatorHandle:
        item.authorMeta?.uniqueId ??
        item.authorMeta?.name ??
        parsed.creatorHandle ??
        undefined,
      caption: item.text ?? undefined,
    };
  }
}

function pickMediaUrl(item: ApifyTikTokItem): string | undefined {
  return (
    item.mediaUrls?.[0] ||
    item.videoMeta?.downloadAddr ||
    item.videoMeta?.playAddr ||
    item.videoUrl ||
    undefined
  );
}

function pickThumbnail(item: ApifyTikTokItem): string | undefined {
  return (
    item.videoMeta?.cover ||
    item.videoMeta?.coverUrl ||
    item.videoMeta?.originalCoverUrl ||
    undefined
  );
}

function failure(
  platform: ReturnType<typeof parseInspoUrl>["platform"],
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
