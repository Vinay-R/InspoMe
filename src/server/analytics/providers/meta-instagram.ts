import "server-only";

import { decryptToken } from "@/lib/crypto";
import type { ConnectedAccountRow } from "@/lib/supabase/types";
import type {
  AnalyticsProvider,
  NormalizedMetrics,
  NormalizedPost,
  SyncResult,
} from "../types";

// Instagram API with Instagram Login provider.
//
// Pulls the connected user's media + per-media insights and normalizes into
// our shape. The Insights API doesn't have a batch endpoint — we N+1 — but
// IG rate-limits at 200 calls/hour/token, well above what we need at our
// initial cap of 50 media.
//
// Docs:
//   /me/media     https://developers.facebook.com/docs/instagram-platform/reference/instagram-user/media
//   /{id}/insights https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights

const API = "https://graph.instagram.com";
const MEDIA_LIMIT = 50;

// Metrics requested vary by media_type — IG returns an error if you ask for a
// metric that doesn't apply (e.g. `plays` on an image). Map media_type → list.
const METRICS_BY_TYPE: Record<string, string[]> = {
  REELS: [
    "reach",
    "likes",
    "comments",
    "shares",
    "saved",
    "total_interactions",
    "views",
    "ig_reels_avg_watch_time",
    "ig_reels_video_view_total_time",
  ],
  VIDEO: ["reach", "likes", "comments", "shares", "saved", "total_interactions", "views"],
  IMAGE: ["reach", "likes", "comments", "shares", "saved", "total_interactions"],
  CAROUSEL_ALBUM: ["reach", "likes", "comments", "shares", "saved", "total_interactions"],
};

type IgMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "REELS" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
};

type IgInsightsResponse = {
  data: Array<{ name: string; values: Array<{ value: number }> }>;
  error?: { message: string };
};

export class MetaInstagramProvider implements AnalyticsProvider {
  readonly name = "meta-instagram";
  readonly platform = "instagram" as const;
  readonly canConnect = true;

  async syncAccount(account: ConnectedAccountRow): Promise<SyncResult> {
    if (!account.access_token_encrypted) {
      throw new Error("Connected account has no access token.");
    }
    const token = decryptToken(account.access_token_encrypted);

    // ── 1. Profile (so we keep username/display_name fresh) ────────
    const profile = await fetchJson<{
      id: string;
      username?: string;
      account_type?: string;
      profile_picture_url?: string;
    }>(`${API}/me?fields=id,username,account_type,profile_picture_url&access_token=${token}`);

    // ── 2. Media (paginated; we cap at MEDIA_LIMIT) ────────────────
    const mediaFields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
    const mediaRes = await fetchJson<{ data: IgMedia[]; paging?: { next?: string } }>(
      `${API}/me/media?fields=${mediaFields}&limit=${MEDIA_LIMIT}&access_token=${token}`,
    );
    const media = mediaRes.data ?? [];

    // ── 3. Insights per media (concurrency capped to be polite) ────
    const posts: NormalizedPost[] = [];
    const metrics: NormalizedMetrics[] = [];
    await mapWithConcurrency(media, 5, async (m) => {
      const metricList = METRICS_BY_TYPE[m.media_type] ?? METRICS_BY_TYPE.IMAGE;
      let insights: Record<string, number> = {};
      try {
        const ins = await fetchJson<IgInsightsResponse>(
          `${API}/${m.id}/insights?metric=${metricList.join(",")}&access_token=${token}`,
        );
        for (const row of ins.data ?? []) {
          insights[row.name] = row.values?.[0]?.value ?? 0;
        }
      } catch (e) {
        // A single failing media shouldn't kill the whole sync — skip metrics
        // but still record the post itself so it appears in the feed.
        console.warn("[meta-instagram] insights failed for", m.id, e);
        insights = {};
      }

      posts.push({
        platform_post_id: m.id,
        url: m.permalink ?? null,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
        caption: m.caption ?? null,
        media_type:
          m.media_type === "IMAGE"
            ? "image"
            : m.media_type === "CAROUSEL_ALBUM"
              ? "carousel"
              : "video",
        posted_at: m.timestamp,
        duration_seconds: null,
        format_tag: m.media_type === "REELS" ? "reel" : m.media_type.toLowerCase(),
        pillar_tag: null,
        topic_tags: [],
        hook_strength: null,
      });

      const reach = insights.reach ?? 0;
      const likes = insights.likes ?? 0;
      const comments = insights.comments ?? 0;
      const shares = insights.shares ?? 0;
      const saves = insights.saved ?? 0;
      const totalInter = insights.total_interactions ?? likes + comments + shares + saves;
      const views = insights.views ?? null;
      const avgWatch = insights.ig_reels_avg_watch_time ?? null;
      const totalWatch = insights.ig_reels_video_view_total_time ?? null;

      // Completion rate is not directly reported. We can approximate for reels
      // when both avg watch time and total time are available, but it's an
      // estimate — leave null rather than fabricate.
      metrics.push({
        platform_post_id: m.id,
        captured_at: new Date().toISOString(),
        views,
        reach: reach || null,
        impressions: null,
        likes,
        comments,
        shares,
        saves,
        follows: null,
        profile_visits: null,
        average_watch_time: avgWatch != null ? avgWatch / 1000 : null, // ms → s
        completion_rate:
          avgWatch != null && totalWatch != null && totalWatch > 0
            ? Math.min(1, avgWatch / totalWatch)
            : null,
        engagement_rate: reach > 0 ? totalInter / reach : null,
        share_rate: reach > 0 ? shares / reach : null,
        save_rate: reach > 0 ? saves / reach : null,
        source: "permissioned_user_connection",
        confidence: "high",
      });
    });

    posts.sort((a, b) => (a.posted_at < b.posted_at ? 1 : -1));

    return {
      posts,
      metrics,
      account: {
        platform_user_id: profile.id,
        username: profile.username ?? "instagram_user",
        display_name: profile.username ?? null,
        avatar_url: profile.profile_picture_url ?? null,
      },
    };
  }
}

/**
 * Thrown when Instagram rejects our credentials (expired/revoked token).
 * The sync service uses this to distinguish "user must reconnect" from
 * transient failures that should NOT flip the account to needs_reauth.
 */
export class InstagramAuthError extends Error {}

async function fetchJson<T>(url: string): Promise<T> {
  // One hung Graph call inside the concurrency pool would stall the whole
  // sync until the function is killed — always bound it.
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    // OAuthException code 190 = invalid/expired token; 401/403 likewise.
    const isAuth =
      res.status === 401 ||
      res.status === 403 ||
      text.includes("OAuthException") ||
      text.includes('"code":190');
    const message = `Instagram API ${res.status}: ${text.slice(0, 300)}`;
    throw isAuth ? new InstagramAuthError(message) : new Error(message);
  }
  return (await res.json()) as T;
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      await fn(item);
    }
  });
  await Promise.all(workers);
}
