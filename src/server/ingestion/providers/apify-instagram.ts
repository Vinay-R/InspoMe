import "server-only";

import type {
  MediaDownloadProvider,
  MediaDownloadResult,
} from "../types";
import { parseInspoUrl } from "@/lib/platform";
import { serverEnv } from "@/lib/env";

// Instagram downloads via Apify — replaces the self-hosted Cobalt instance.
//
// Two actors, tried in order:
//   1. apify/instagram-reel-scraper (primary) — for reels/clips. Uniquely
//      returns `downloadedVideo` (an Apify-hosted MP4 with ~7-day retention,
//      so no fighting IG CDN signed-URL expiry for media bytes) plus a
//      `transcript`. Returns empty for non-reel video posts.
//   2. apify/instagram-post-scraper (fallback) — for feed videos / carousels
//      the reel actor skips. Returns `videoUrl` (raw IG CDN) but no hosted MP4
//      or transcript.
//
// Both actors take the post URL inside the `username` array (which despite the
// name accepts direct post/reel URLs). The include* flags on the reel actor
// default OFF — we must set them to get the hosted MP4 + transcript, the same
// way the TikTok actor needs shouldDownloadVideos.
//
// gemini.ts:fetchVideoBytes already attaches the Apify bearer token for
// api.apify.com hosts, so the hosted `downloadedVideo` URL drops straight in.

const APIFY_TIMEOUT_MS = 90_000;

type ApifyIgItem = {
  type?: string; // "Image" | "Video" | "Sidecar"
  productType?: string; // "clips" for reels
  shortCode?: string;
  url?: string;
  caption?: string;
  ownerUsername?: string;
  // Media
  downloadedVideo?: string; // Apify-hosted MP4 (reel actor only)
  videoUrl?: string; // raw IG CDN
  videoDuration?: number;
  displayUrl?: string; // full-res cover
  images?: string[]; // pre-sized cover variants (reel actor)
  // Enrichment (reel actor, flag-gated) — captured for follow-up use.
  transcript?: string;
  sharesCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  likesCount?: number;
  commentsCount?: number;
  timestamp?: string;
  // Empty/error signal
  error?: string;
};

export class ApifyInstagramProvider implements MediaDownloadProvider {
  readonly name = "apify-instagram";

  canHandle(url: string): boolean {
    return parseInspoUrl(url).platform === "instagram";
  }

  async download(url: string): Promise<MediaDownloadResult> {
    const parsed = parseInspoUrl(url);
    if (parsed.platform !== "instagram") {
      return failure(
        parsed.platform,
        url,
        "wrong_platform",
        "Apify Instagram provider only handles Instagram URLs.",
      );
    }

    const token = serverEnv.apifyApiToken;
    if (!token) {
      return failure(
        parsed.platform,
        url,
        "apify_not_configured",
        "Instagram download service is not configured.",
      );
    }

    const target = parsed.canonical ?? url;

    // 1. Reel actor first — it's the only one that returns the hosted MP4 +
    //    transcript. It returns an empty dataset for non-reel video posts.
    const reel = await runActor(
      serverEnv.apifyInstagramReelActor,
      token,
      {
        username: [target],
        resultsLimit: 1,
        includeDownloadedVideo: true,
        includeTranscript: true,
        includeSharesCount: true,
      },
      url,
      parsed.platform,
    );
    if (reel.kind === "item" && pickMediaUrl(reel.item)) {
      return toResult(reel.item, url, parsed);
    }
    if (reel.kind === "failure" && reel.hard) {
      return reel.result;
    }

    // 2. Post actor fallback — feed videos / carousels the reel actor skipped.
    const post = await runActor(
      serverEnv.apifyInstagramPostActor,
      token,
      {
        username: [target],
        resultsLimit: 1,
        dataDetailLevel: "detailedData",
      },
      url,
      parsed.platform,
    );
    if (post.kind === "item" && pickMediaUrl(post.item)) {
      return toResult(post.item, url, parsed);
    }
    if (post.kind === "failure" && post.hard) {
      return post.result;
    }

    // Both actors ran but neither yielded a video — most likely an image-only
    // post or carousel with no video. Honest failure; the save is still kept.
    return failure(
      parsed.platform,
      url,
      "instagram_no_video",
      "This Instagram post doesn't have a video to analyze — only photos.",
    );
  }
}

type ActorOutcome =
  | { kind: "item"; item: ApifyIgItem }
  | { kind: "empty" }
  | { kind: "failure"; result: MediaDownloadResult; hard: boolean };

// hard=true failures (auth, deleted post) short-circuit the fallback chain;
// soft failures (empty dataset, transient) let the next actor try.
async function runActor(
  actor: string,
  token: string,
  input: Record<string, unknown>,
  sourceUrl: string,
  platform: ReturnType<typeof parseInspoUrl>["platform"],
): Promise<ActorOutcome> {
  const actorPath = actor.replace("/", "~");
  const endpoint = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`[apify-instagram] ${actor} fetch failed`, e);
    return {
      kind: "failure",
      hard: false,
      result: failure(
        platform,
        sourceUrl,
        "apify_request_failed",
        "Couldn't reach the Instagram download service. Try again in a minute.",
      ),
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[apify-instagram] ${actor} non-OK`, res.status, text.slice(0, 200));
    const isAuth = res.status === 401 || res.status === 403;
    return {
      kind: "failure",
      hard: isAuth,
      result: failure(
        platform,
        sourceUrl,
        "apify_http_error",
        isAuth
          ? "Instagram download service rejected the request."
          : "Instagram download service had a hiccup. Try again later.",
      ),
    };
  }

  let items: ApifyIgItem[];
  try {
    items = (await res.json()) as ApifyIgItem[];
  } catch {
    return {
      kind: "failure",
      hard: false,
      result: failure(
        platform,
        sourceUrl,
        "apify_invalid_response",
        "Instagram download service returned an unexpected response.",
      ),
    };
  }

  const item = items[0];
  if (!item || item.error) {
    if (item?.error) {
      console.error(`[apify-instagram] ${actor} error item`, item.error);
    }
    return { kind: "empty" };
  }
  return { kind: "item", item };
}

function toResult(
  item: ApifyIgItem,
  sourceUrl: string,
  parsed: ReturnType<typeof parseInspoUrl>,
): MediaDownloadResult {
  return {
    success: true,
    platform: "instagram",
    sourceUrl,
    // Prefer the Apify-hosted MP4 (stable, bearer-authed) over the raw IG CDN.
    mediaFileUrl: pickMediaUrl(item),
    thumbnailUrl: pickThumbnail(item),
    durationSeconds: item.videoDuration ?? undefined,
    creatorHandle: item.ownerUsername ?? parsed.creatorHandle ?? undefined,
    caption: item.caption ?? undefined,
  };
}

function pickMediaUrl(item: ApifyIgItem): string | undefined {
  return item.downloadedVideo || item.videoUrl || undefined;
}

function pickThumbnail(item: ApifyIgItem): string | undefined {
  // images[] are pre-sized cover variants (lighter than full-res displayUrl).
  return item.images?.[0] || item.displayUrl || undefined;
}

function failure(
  platform: ReturnType<typeof parseInspoUrl>["platform"],
  sourceUrl: string,
  errorCode: string,
  errorMessage: string,
): MediaDownloadResult {
  return { success: false, platform, sourceUrl, errorCode, errorMessage };
}
