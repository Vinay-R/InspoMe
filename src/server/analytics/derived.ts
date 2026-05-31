import type {
  CreatorPostRow,
  PostMetricSnapshotRow,
} from "@/lib/supabase/types";

// ────────────────────────────────────────────────────────────────────
// Joined post + latest snapshot (the working unit for the UI/charts)
// ────────────────────────────────────────────────────────────────────
export type PostWithMetrics = CreatorPostRow & {
  metrics: PostMetricSnapshotRow | null;
};

export type WindowDays = 7 | 30 | 90;

// ────────────────────────────────────────────────────────────────────
// Pure utilities
// ────────────────────────────────────────────────────────────────────

export function ratioOrNull(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den === 0) return null;
  return num / den;
}

export function pctChange(
  current: number,
  previous: number,
): { abs: number; pct: number | null; direction: "up" | "down" | "flat" } {
  const abs = current - previous;
  if (previous === 0) {
    return { abs, pct: current === 0 ? 0 : null, direction: abs > 0 ? "up" : abs < 0 ? "down" : "flat" };
  }
  const pct = ((current - previous) / previous) * 100;
  const direction: "up" | "down" | "flat" =
    Math.abs(pct) < 0.5 ? "flat" : pct > 0 ? "up" : "down";
  return { abs, pct, direction };
}

export function windowMs(window: WindowDays): number {
  return window * 24 * 60 * 60 * 1000;
}

export function inWindow(
  iso: string | null,
  endMs: number,
  spanMs: number,
): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= endMs - spanMs && t <= endMs;
}

// ────────────────────────────────────────────────────────────────────
// Window-rollup metrics
// ────────────────────────────────────────────────────────────────────

export interface OverviewTotals {
  views: number;
  engagement: number;
  saves: number | null;
  shares: number;
  avgEngagementRate: number | null;
  followerGrowth: number | null;
  bestPlatform: { platform: "instagram" | "tiktok"; views: number } | null;
  bestPostingWindow: { day: number; hour: number; score: number } | null; // day 0=Sun
  topFormat: { format: string; views: number } | null;
  postCount: number;
}

const ZERO_TOTALS: OverviewTotals = {
  views: 0,
  engagement: 0,
  saves: null,
  shares: 0,
  avgEngagementRate: null,
  followerGrowth: null,
  bestPlatform: null,
  bestPostingWindow: null,
  topFormat: null,
  postCount: 0,
};

export function rollupOverview(
  posts: PostWithMetrics[],
  window: WindowDays,
  now = new Date(),
): { current: OverviewTotals; previous: OverviewTotals } {
  const endMs = now.getTime();
  const span = windowMs(window);
  const cur = posts.filter((p) => inWindow(p.posted_at, endMs, span));
  const prev = posts.filter((p) =>
    inWindow(p.posted_at, endMs - span, span),
  );
  return {
    current: rollupOne(cur),
    previous: rollupOne(prev),
  };
}

function rollupOne(posts: PostWithMetrics[]): OverviewTotals {
  if (posts.length === 0) return { ...ZERO_TOTALS };

  let views = 0;
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let saves = 0;
  let savesSeen = 0;
  const erValues: number[] = [];

  const platformViews: Record<"instagram" | "tiktok", number> = {
    instagram: 0,
    tiktok: 0,
  };
  const formatViews = new Map<string, number>();
  // 7×24 grid of summed views (heatmap basis)
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

  for (const p of posts) {
    const m = p.metrics;
    if (!m) continue;
    views += m.views ?? 0;
    likes += m.likes ?? 0;
    comments += m.comments ?? 0;
    shares += m.shares ?? 0;
    if (m.saves != null) {
      saves += m.saves;
      savesSeen += 1;
    }
    if (m.engagement_rate != null) erValues.push(m.engagement_rate);
    platformViews[p.platform] += m.views ?? 0;
    if (p.format_tag) {
      formatViews.set(p.format_tag, (formatViews.get(p.format_tag) ?? 0) + (m.views ?? 0));
    }
    if (p.posted_at) {
      const d = new Date(p.posted_at);
      grid[d.getUTCDay()][d.getUTCHours()] += m.views ?? 0;
    }
  }

  const engagement = likes + comments + shares + saves;
  const avgEngagementRate =
    erValues.length > 0
      ? erValues.reduce((a, b) => a + b, 0) / erValues.length
      : null;

  let bestPlatform: OverviewTotals["bestPlatform"] = null;
  if (platformViews.instagram > 0 || platformViews.tiktok > 0) {
    bestPlatform =
      platformViews.instagram >= platformViews.tiktok
        ? { platform: "instagram", views: platformViews.instagram }
        : { platform: "tiktok", views: platformViews.tiktok };
  }

  let topFormat: OverviewTotals["topFormat"] = null;
  for (const [format, v] of formatViews) {
    if (!topFormat || v > topFormat.views) topFormat = { format, views: v };
  }

  // Best 3-hour posting window — find (day, hour) cell with highest sum
  let best: OverviewTotals["bestPostingWindow"] = null;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const score = grid[d][h];
      if (score > 0 && (!best || score > best.score)) {
        best = { day: d, hour: h, score };
      }
    }
  }

  return {
    views,
    engagement,
    saves: savesSeen > 0 ? saves : null,
    shares,
    avgEngagementRate,
    followerGrowth: null, // populated only when IG insights are available
    bestPlatform,
    bestPostingWindow: best,
    topFormat,
    postCount: posts.length,
  };
}

// ────────────────────────────────────────────────────────────────────
// Time series — daily views
// ────────────────────────────────────────────────────────────────────

export interface DailyViewsPoint {
  date: string; // YYYY-MM-DD (UTC)
  instagram: number;
  tiktok: number;
  total: number;
}

export function dailyViews(
  posts: PostWithMetrics[],
  window: WindowDays,
  now = new Date(),
): DailyViewsPoint[] {
  const endMs = now.getTime();
  const span = windowMs(window);
  const startMs = endMs - span;

  const buckets = new Map<string, { instagram: number; tiktok: number }>();
  for (let t = startMs; t <= endMs; t += 24 * 60 * 60 * 1000) {
    const key = new Date(t).toISOString().slice(0, 10);
    buckets.set(key, { instagram: 0, tiktok: 0 });
  }

  for (const p of posts) {
    if (!p.posted_at) continue;
    const t = new Date(p.posted_at).getTime();
    if (t < startMs || t > endMs) continue;
    const key = new Date(t).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket[p.platform] += p.metrics?.views ?? 0;
  }

  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    instagram: v.instagram,
    tiktok: v.tiktok,
    total: v.instagram + v.tiktok,
  }));
}

// ────────────────────────────────────────────────────────────────────
// Engagement mix
// ────────────────────────────────────────────────────────────────────
export interface EngagementMix {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  savesAvailable: boolean;
}

export function engagementMix(posts: PostWithMetrics[]): EngagementMix {
  let likes = 0;
  let comments = 0;
  let shares = 0;
  let saves = 0;
  let savesAvailable = false;
  for (const p of posts) {
    const m = p.metrics;
    if (!m) continue;
    likes += m.likes ?? 0;
    comments += m.comments ?? 0;
    shares += m.shares ?? 0;
    if (m.saves != null) {
      savesAvailable = true;
      saves += m.saves;
    }
  }
  return { likes, comments, shares, saves, savesAvailable };
}

// ────────────────────────────────────────────────────────────────────
// Posting-time heatmap grid (7×24 of avg views per post)
// ────────────────────────────────────────────────────────────────────
export type Heatmap = number[][]; // [day][hour] = avg views per post in that cell

export function postingTimeHeatmap(posts: PostWithMetrics[]): Heatmap {
  const sums: Heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const counts = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const p of posts) {
    if (!p.posted_at || !p.metrics) continue;
    const d = new Date(p.posted_at);
    const day = d.getUTCDay();
    const hour = d.getUTCHours();
    sums[day][hour] += p.metrics.views ?? 0;
    counts[day][hour] += 1;
  }
  return sums.map((row, d) => row.map((v, h) => (counts[d][h] === 0 ? 0 : v / counts[d][h])));
}

// ────────────────────────────────────────────────────────────────────
// Format / pillar performance — by views and by save rate
// ────────────────────────────────────────────────────────────────────
export interface TagPerformance {
  tag: string;
  postCount: number;
  totalViews: number;
  avgEngagementRate: number | null;
  totalSaves: number;
  totalShares: number;
}

function rollupByTag(
  posts: PostWithMetrics[],
  pick: (p: PostWithMetrics) => string | null,
): TagPerformance[] {
  const map = new Map<string, TagPerformance>();
  for (const p of posts) {
    const tag = pick(p);
    if (!tag) continue;
    const m = p.metrics;
    const cur = map.get(tag) ?? {
      tag,
      postCount: 0,
      totalViews: 0,
      avgEngagementRate: null,
      totalSaves: 0,
      totalShares: 0,
    };
    cur.postCount += 1;
    cur.totalViews += m?.views ?? 0;
    cur.totalSaves += m?.saves ?? 0;
    cur.totalShares += m?.shares ?? 0;
    map.set(tag, cur);
  }
  // Compute avgEngagementRate as a second pass
  for (const [tag, perf] of map) {
    const ers: number[] = [];
    for (const p of posts) {
      if (pick(p) === tag && p.metrics?.engagement_rate != null) {
        ers.push(p.metrics.engagement_rate);
      }
    }
    perf.avgEngagementRate =
      ers.length > 0 ? ers.reduce((a, b) => a + b, 0) / ers.length : null;
  }
  return [...map.values()].sort((a, b) => b.totalViews - a.totalViews);
}

export function formatPerformance(posts: PostWithMetrics[]): TagPerformance[] {
  return rollupByTag(posts, (p) => p.format_tag);
}

export function pillarPerformance(posts: PostWithMetrics[]): TagPerformance[] {
  return rollupByTag(posts, (p) => p.pillar_tag);
}

// ────────────────────────────────────────────────────────────────────
// Compare-posts plain-English summary
// ────────────────────────────────────────────────────────────────────
export function compareSummary(a: PostWithMetrics, b: PostWithMetrics): string {
  const va = a.metrics?.views ?? 0;
  const vb = b.metrics?.views ?? 0;
  const sa = a.metrics?.saves ?? 0;
  const sb = b.metrics?.saves ?? 0;
  const ca = a.metrics?.comments ?? 0;
  const cb = b.metrics?.comments ?? 0;

  if (va === 0 && vb === 0) return "Not enough data to compare these yet.";

  const aLabel = a.format_tag ?? "Post A";
  const bLabel = b.format_tag ?? "Post B";

  if (va > vb && sb + cb > sa + ca) {
    return `Your ${aLabel} reached more people, but your ${bLabel} was more valuable to your audience — it earned more saves and comments.`;
  }
  if (vb > va && sa + ca > sb + cb) {
    return `Your ${bLabel} reached more people, but your ${aLabel} earned more saves and comments — that's a stronger signal that people found it useful.`;
  }
  if (va > vb) return `Your ${aLabel} reached and engaged more people overall.`;
  return `Your ${bLabel} reached and engaged more people overall.`;
}
