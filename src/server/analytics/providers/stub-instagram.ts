import "server-only";

import type { ConnectedAccountRow } from "@/lib/supabase/types";
import type { AnalyticsProvider, NormalizedMetrics, NormalizedPost, SyncResult } from "../types";

const FORMATS_IG = [
  "talking_head",
  "voiceover",
  "tutorial",
  "behind_the_scenes",
  "aesthetic_visuals",
  "trend_remix",
  "product_demo",
];
const PILLARS = ["education", "personal_story", "behind_the_scenes", "trends", "tips"];
const HOOK_SAMPLES = [
  "POV: you finally figured out…",
  "I wish someone told me this sooner.",
  "3 things I'd do differently.",
  "Watch before you post your next reel.",
  "This changed everything for my workflow.",
  "Why your videos aren't getting saves.",
  "The tiny detail that doubled my reach.",
  "You're filming this wrong.",
];

export class StubInstagramProvider implements AnalyticsProvider {
  readonly name = "stub-instagram";
  readonly platform = "instagram" as const;
  readonly canConnect = true;

  async syncAccount(account: ConnectedAccountRow): Promise<SyncResult> {
    const rng = mulberry32(seedFromString(`ig:${account.user_id}`));

    const posts: NormalizedPost[] = [];
    const metrics: NormalizedMetrics[] = [];

    const now = Date.now();
    // ~24 posts spread across the last 90 days
    const count = 24;
    for (let i = 0; i < count; i++) {
      const daysAgo = Math.floor(rng() * 90);
      const hourOffset = Math.floor(rng() * 24);
      const postedAt = new Date(
        now - daysAgo * 86_400_000 - hourOffset * 3_600_000,
      ).toISOString();
      const id = `ig_${account.user_id.slice(0, 8)}_${i}`;
      const format = pick(FORMATS_IG, rng);
      const pillar = pick(PILLARS, rng);
      const hook = pick(HOOK_SAMPLES, rng);

      posts.push({
        platform_post_id: id,
        url: `https://instagram.com/p/stub_${i}/`,
        thumbnail_url: thumbForSeed(`ig${i}${account.user_id}`),
        caption: `${hook} ${captionTail(rng)}`,
        media_type: rng() > 0.85 ? "carousel" : "video",
        posted_at: postedAt,
        duration_seconds: rng() > 0.5 ? Math.round(15 + rng() * 75) : null,
        format_tag: format,
        pillar_tag: pillar,
        topic_tags: [pillar, format].filter(Boolean) as string[],
        hook_strength: Math.round((3 + rng() * 7) * 10) / 10,
      });

      // Metric distribution: most posts moderate, a few breakouts
      const breakout = rng() > 0.85;
      const baseViews = breakout ? 12000 + Math.floor(rng() * 80000) : 600 + Math.floor(rng() * 4500);
      const likes = Math.floor(baseViews * (0.05 + rng() * 0.07));
      const comments = Math.floor(baseViews * (0.005 + rng() * 0.02));
      const shares = Math.floor(baseViews * (0.005 + rng() * 0.025));
      const saves = Math.floor(baseViews * (0.01 + rng() * 0.05));
      const reach = Math.floor(baseViews * (0.7 + rng() * 0.4));
      const engagement = likes + comments + shares + saves;

      metrics.push({
        platform_post_id: id,
        captured_at: new Date().toISOString(),
        views: baseViews,
        reach,
        impressions: Math.floor(baseViews * (1.05 + rng() * 0.4)),
        likes,
        comments,
        shares,
        saves,
        follows: Math.floor(saves * (rng() * 0.2)),
        profile_visits: Math.floor(reach * 0.04 * rng()),
        average_watch_time: 4 + rng() * 12,
        completion_rate: 0.18 + rng() * 0.55,
        engagement_rate: engagement / Math.max(1, reach),
        share_rate: shares / Math.max(1, reach),
        save_rate: saves / Math.max(1, reach),
        source: "official_api",
        confidence: "medium",
      });
    }

    posts.sort((a, b) => (a.posted_at < b.posted_at ? 1 : -1));

    return {
      posts,
      metrics,
      account: {
        platform_user_id: `stub_ig_${account.user_id.slice(0, 8)}`,
        username: "you (demo)",
        display_name: "Demo Instagram",
        avatar_url: null,
      },
    };
  }
}

// ── deterministic helpers ────────────────────────────────────────────
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
  // Deterministic placeholder thumbnails — picsum supports a `?random=` token
  // and signed seed so the image is stable per post.
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/600`;
}
function captionTail(rng: () => number): string {
  const tails = [
    "Here's what worked for me.",
    "Save this for later.",
    "Tag someone who needs this.",
    "It's the small things.",
    "Drop a 🙌 if this hits.",
  ];
  return tails[Math.floor(rng() * tails.length)];
}
