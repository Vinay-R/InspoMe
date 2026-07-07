import "server-only";

import type { ConnectedAccountRow } from "@/lib/supabase/types";
import type { AnalyticsProvider, NormalizedMetrics, NormalizedPost, SyncResult } from "../types";

const FORMATS_TT = [
  "talking_head",
  "skit",
  "trend_remix",
  "tutorial",
  "voiceover",
  "behind_the_scenes",
];
const PILLARS = ["education", "personal_story", "trends", "humor", "tips"];
const HOOKS = [
  "Wait for it…",
  "Storytime: I almost gave up.",
  "Things nobody tells you.",
  "The real reason your reach dropped.",
  "Try this for 7 days.",
  "Don't post your next video before watching this.",
  "I tested this so you don't have to.",
];

export class StubTikTokProvider implements AnalyticsProvider {
  readonly name = "stub-tiktok";
  readonly platform = "tiktok" as const;
  readonly canConnect = true;

  async syncAccount(account: ConnectedAccountRow): Promise<SyncResult> {
    const rng = mulberry32(seedFromString(`tt:${account.user_id}`));

    const posts: NormalizedPost[] = [];
    const metrics: NormalizedMetrics[] = [];

    const now = Date.now();
    const count = 22;
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(rng() * 90);
      const hourOffset = Math.floor(rng() * 24);
      const postedAt = new Date(
        now - daysAgo * 86_400_000 - hourOffset * 3_600_000,
      ).toISOString();
      const id = `tt_${account.user_id.slice(0, 8)}_${i}`;
      const format = pick(FORMATS_TT, rng);
      const pillar = pick(PILLARS, rng);
      const hook = pick(HOOKS, rng);

      posts.push({
        platform_post_id: id,
        url: `https://www.tiktok.com/@you/video/stub_${i}`,
        thumbnail_url: thumbForSeed(`tt${i}${account.user_id}`),
        caption: hook,
        media_type: "video",
        posted_at: postedAt,
        duration_seconds: Math.round(8 + rng() * 50),
        format_tag: format,
        pillar_tag: pillar,
        topic_tags: [pillar, format].filter(Boolean) as string[],
        hook_strength: Math.round((4 + rng() * 6) * 10) / 10,
      });

      // TikTok tends to have higher view dispersion + no save signal
      const breakout = rng() > 0.82;
      const baseViews = breakout
        ? 30000 + Math.floor(rng() * 250000)
        : 800 + Math.floor(rng() * 9000);
      const likes = Math.floor(baseViews * (0.06 + rng() * 0.1));
      const comments = Math.floor(baseViews * (0.004 + rng() * 0.018));
      const shares = Math.floor(baseViews * (0.008 + rng() * 0.03));
      const reach = baseViews; // TT API treats views ≈ plays
      const engagement = likes + comments + shares;

      metrics.push({
        platform_post_id: id,
        captured_at: new Date().toISOString(),
        views: baseViews,
        reach,
        impressions: null,
        likes,
        comments,
        shares,
        saves: null, // TikTok official API does not surface saves
        follows: null,
        profile_visits: null,
        average_watch_time: 3 + rng() * 18,
        completion_rate: 0.22 + rng() * 0.5,
        engagement_rate: engagement / Math.max(1, reach),
        share_rate: shares / Math.max(1, reach),
        save_rate: null,
        source: "official_api",
        confidence: "medium",
      });
    }

    posts.sort((a, b) => (a.posted_at < b.posted_at ? 1 : -1));

    return {
      posts,
      metrics,
      account: {
        platform_user_id: `stub_tt_${account.user_id.slice(0, 8)}`,
        username: "you (demo)",
        display_name: "Demo TikTok",
        avatar_url: null,
      },
    };
  }
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
function thumbForSeed(seed: string): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/600`;
}
