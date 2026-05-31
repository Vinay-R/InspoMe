import type { AnalyticsInsightRow } from "@/lib/supabase/types";
import type { PostWithMetrics, WindowDays } from "./derived";
import { engagementMix, formatPerformance, pillarPerformance, postingTimeHeatmap } from "./derived";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type LiveInsight = Omit<AnalyticsInsightRow, "id" | "user_id" | "created_at">;

/**
 * Generate plain-English insights from windowed posts. These are NOT persisted
 * here — the caller decides whether to upsert. Heuristic-only on purpose;
 * LLM-flavored insights are a follow-up.
 */
export function generateInsights(
  posts: PostWithMetrics[],
  window: WindowDays,
): LiveInsight[] {
  const out: LiveInsight[] = [];
  const now = new Date().toISOString();

  if (posts.length === 0) return out;

  // ── 1. Save magnet by pillar ────────────────────────────────────
  const pillars = pillarPerformance(posts);
  const totalSaves = pillars.reduce((a, b) => a + b.totalSaves, 0);
  const totalPosts = posts.length;
  if (totalSaves > 0) {
    const champion = [...pillars]
      .sort((a, b) => b.totalSaves - a.totalSaves)[0];
    const sharePosts = champion.postCount / totalPosts;
    const shareSaves = champion.totalSaves / totalSaves;
    if (shareSaves > 0.4 && sharePosts < 0.3 && champion.totalSaves > 5) {
      out.push({
        insight_type: "save_magnet_pillar",
        title: `Your saves are coming from ${humanize(champion.tag)} content`,
        observation: `${humanize(champion.tag)} drove ${Math.round(shareSaves * 100)}% of saves with only ${Math.round(sharePosts * 100)}% of your posts.`,
        explanation: "Saves are a strong signal that people find your content useful — it's content they want to come back to.",
        recommended_action: `Make 2 more posts this week using your best ${humanize(champion.tag).toLowerCase()} format.`,
        confidence: "high",
        related_post_ids: posts
          .filter((p) => p.pillar_tag === champion.tag)
          .slice(0, 4)
          .map((p) => p.id),
        time_window_days: window,
        generated_at: now,
        expires_at: null,
      });
    }
  }

  // ── 2. Best posting window ──────────────────────────────────────
  const heatmap = postingTimeHeatmap(posts);
  let best = { day: 0, hour: 0, val: 0 };
  let totalCells = 0;
  let totalSum = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (heatmap[d][h] > 0) {
        totalCells++;
        totalSum += heatmap[d][h];
      }
      if (heatmap[d][h] > best.val) best = { day: d, hour: h, val: heatmap[d][h] };
    }
  }
  if (totalCells > 6 && best.val > 0) {
    const avg = totalSum / totalCells;
    if (best.val > avg * 1.5) {
      out.push({
        insight_type: "best_posting_window",
        title: `Your strongest posting window is ${DAYS[best.day]} ${formatHour(best.hour)}–${formatHour(best.hour + 3)}`,
        observation: `Posts published in this window average ${Math.round(best.val).toLocaleString()} views — well above your typical post.`,
        explanation: "Posting when your audience is most active gives videos a head start. Many algorithms reward early engagement.",
        recommended_action: `Try scheduling your next post for ${DAYS[best.day]} between ${formatHour(best.hour)} and ${formatHour(best.hour + 3)}.`,
        confidence: "medium",
        related_post_ids: [],
        time_window_days: window,
        generated_at: now,
        expires_at: null,
      });
    }
  }

  // ── 3. Format outlier ───────────────────────────────────────────
  const formats = formatPerformance(posts);
  if (formats.length >= 2) {
    const sortedByER = [...formats]
      .filter((f) => f.avgEngagementRate != null && f.postCount >= 2)
      .sort(
        (a, b) =>
          (b.avgEngagementRate ?? 0) - (a.avgEngagementRate ?? 0),
      );
    if (sortedByER.length >= 2) {
      const top = sortedByER[0];
      const others = sortedByER.slice(1);
      const othersAvg =
        others.reduce((a, b) => a + (b.avgEngagementRate ?? 0), 0) /
        Math.max(1, others.length);
      const ratio = (top.avgEngagementRate ?? 0) / Math.max(0.0001, othersAvg);
      if (ratio > 1.5) {
        out.push({
          insight_type: "format_outlier",
          title: `Your ${humanize(top.tag).toLowerCase()} posts are pulling ahead`,
          observation: `${humanize(top.tag)} posts have ${Math.round((ratio - 1) * 100)}% higher engagement rate than your other formats.`,
          explanation: "When a format consistently outperforms, double down — your audience is telling you what they prefer.",
          recommended_action: `Plan another ${humanize(top.tag).toLowerCase()} for next week and watch the engagement lift.`,
          confidence: "high",
          related_post_ids: posts
            .filter((p) => p.format_tag === top.tag)
            .slice(0, 4)
            .map((p) => p.id),
          time_window_days: window,
          generated_at: now,
          expires_at: null,
        });
      }
    }
  }

  // ── 4. Hook strength → retention ────────────────────────────────
  const strong = posts.filter((p) => (p.hook_strength ?? 0) >= 7);
  const weak = posts.filter((p) => (p.hook_strength ?? 0) > 0 && (p.hook_strength ?? 0) < 5);
  if (strong.length >= 3 && weak.length >= 3) {
    const strongER = avg(strong.map((p) => p.metrics?.engagement_rate ?? 0));
    const weakER = avg(weak.map((p) => p.metrics?.engagement_rate ?? 0));
    if (strongER > weakER * 1.2 && strongER > 0) {
      out.push({
        insight_type: "hook_strength",
        title: "Strong hooks pay off",
        observation: `Your posts with stronger hooks earn ${Math.round((strongER / Math.max(0.0001, weakER) - 1) * 100)}% more engagement.`,
        explanation: "The first 3 seconds decide whether someone stays. A clear, specific hook beats an aesthetic intro almost every time.",
        recommended_action: "Tighten your next intro: lead with a question, a bold claim, or a curiosity gap.",
        confidence: "medium",
        related_post_ids: strong.slice(0, 4).map((p) => p.id),
        time_window_days: window,
        generated_at: now,
        expires_at: null,
      });
    }
  }

  // ── 5. Cross-platform mismatch ──────────────────────────────────
  const igPosts = posts.filter((p) => p.platform === "instagram");
  const ttPosts = posts.filter((p) => p.platform === "tiktok");
  if (igPosts.length >= 3 && ttPosts.length >= 3) {
    const igER = avg(igPosts.map((p) => p.metrics?.engagement_rate ?? 0));
    const ttER = avg(ttPosts.map((p) => p.metrics?.engagement_rate ?? 0));
    const ratio = igER / Math.max(0.0001, ttER);
    if (ratio > 1.4 || ratio < 0.7) {
      const winner = ratio > 1 ? "Instagram" : "TikTok";
      const loser = ratio > 1 ? "TikTok" : "Instagram";
      const liftPct = ratio > 1 ? Math.round((ratio - 1) * 100) : Math.round((1 / ratio - 1) * 100);
      out.push({
        insight_type: "cross_platform",
        title: `Your audience is more engaged on ${winner}`,
        observation: `Engagement rate on ${winner} is ${liftPct}% higher than on ${loser}.`,
        explanation: "Each platform has its own remix. Content that works on one rarely works one-to-one on the other — adjust the hook, length, and pacing.",
        recommended_action: `Optimize your ${loser} version: shorter hook, faster pace, platform-native captions.`,
        confidence: "medium",
        related_post_ids: [],
        time_window_days: window,
        generated_at: now,
        expires_at: null,
      });
    }
  }

  // ── 6. Engagement mix call-out ──────────────────────────────────
  const mix = engagementMix(posts);
  const total = mix.likes + mix.comments + mix.shares + mix.saves;
  if (total > 0 && mix.shares / total > 0.15) {
    out.push({
      insight_type: "share_heavy",
      title: "Your content is being shared",
      observation: `Shares make up ${Math.round((mix.shares / total) * 100)}% of your engagement — well above the typical 5–10%.`,
      explanation: "Shares are how content escapes your follower base. This is the engagement type that grows accounts.",
      recommended_action: "Look at your most-shared posts — what made them shareable? Lean into that pattern.",
      confidence: "high",
      related_post_ids: posts
        .filter((p) => (p.metrics?.shares ?? 0) > 0)
        .sort((a, b) => (b.metrics?.shares ?? 0) - (a.metrics?.shares ?? 0))
        .slice(0, 4)
        .map((p) => p.id),
      time_window_days: window,
      generated_at: now,
      expires_at: null,
    });
  }

  return out.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────
// Recommendations — "What to post next"
// ─────────────────────────────────────────────────────────────────

export interface Recommendation {
  id: string;
  kind: "ride_winners" | "low_effort" | "experiment" | "double_down";
  hook: string;
  format: string | null;
  pillar: string | null;
  reason: string;
  reference_post_id: string | null;
}

export function generateRecommendations(posts: PostWithMetrics[]): Recommendation[] {
  if (posts.length === 0) return [];
  const out: Recommendation[] = [];

  const sortedByViews = [...posts]
    .filter((p) => p.metrics?.views != null)
    .sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0));
  const sortedBySaves = [...posts]
    .filter((p) => p.metrics?.saves != null && (p.metrics.saves ?? 0) > 0)
    .sort((a, b) => (b.metrics?.saves ?? 0) - (a.metrics?.saves ?? 0));

  // 3 recs based on top performers
  for (let i = 0; i < Math.min(3, sortedByViews.length); i++) {
    const p = sortedByViews[i];
    out.push({
      id: `winner_${p.id}`,
      kind: "ride_winners",
      hook: variateHook(p.caption ?? "Try a follow-up to your top post"),
      format: p.format_tag,
      pillar: p.pillar_tag,
      reason: `Builds on your top-viewed post${p.format_tag ? ` (${humanize(p.format_tag)})` : ""}.`,
      reference_post_id: p.id,
    });
  }

  // Low-effort: shortest top-saver, or shortest format duplicate
  if (sortedBySaves.length > 0) {
    const p = sortedBySaves[0];
    out.push({
      id: `low_${p.id}`,
      kind: "low_effort",
      hook: `Quick remix: "${shorten(p.caption ?? "your top save")}"`,
      format: p.format_tag,
      pillar: p.pillar_tag,
      reason: "Same hook structure, different angle. Low-lift, high-saves.",
      reference_post_id: p.id,
    });
  }

  // High-upside experiment: try a format you've used <2 times
  const formatCounts = new Map<string, number>();
  for (const p of posts) {
    if (p.format_tag) formatCounts.set(p.format_tag, (formatCounts.get(p.format_tag) ?? 0) + 1);
  }
  const allFormats = ["talking_head", "voiceover", "skit", "tutorial", "trend_remix", "behind_the_scenes"];
  const experimentFormat = allFormats.find((f) => (formatCounts.get(f) ?? 0) === 0);
  if (experimentFormat) {
    out.push({
      id: `exp_${experimentFormat}`,
      kind: "experiment",
      hook: `Try a ${humanize(experimentFormat).toLowerCase()} version of your most-viewed topic`,
      format: experimentFormat,
      pillar: posts[0].pillar_tag,
      reason: `You haven't tried ${humanize(experimentFormat).toLowerCase()} yet. High upside if it lands with your audience.`,
      reference_post_id: sortedByViews[0]?.id ?? null,
    });
  }

  // Double down: format you use most & that performs well
  const formats = formatPerformance(posts);
  if (formats.length > 0) {
    const top = formats[0];
    out.push({
      id: `double_${top.tag}`,
      kind: "double_down",
      hook: `Series idea: another ${humanize(top.tag).toLowerCase()}, same audience`,
      format: top.tag,
      pillar: null,
      reason: `${humanize(top.tag)} is your highest-volume format and brought ${Math.round(top.totalViews).toLocaleString()} views in this window.`,
      reference_post_id: null,
    });
  }

  return out.slice(0, 5);
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function humanize(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function formatHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const am = hh < 12;
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}${am ? "am" : "pm"}`;
}
function shorten(s: string, n = 40): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}
function variateHook(caption: string): string {
  const variants = [
    `What I'd change about "${shorten(caption, 30)}"`,
    `Part 2: "${shorten(caption, 35)}"`,
    `The follow-up to "${shorten(caption, 30)}"`,
  ];
  // Deterministic pick keyed on caption so SSR and client agree.
  let h = 0;
  for (let i = 0; i < caption.length; i++) h = (h * 31 + caption.charCodeAt(i)) >>> 0;
  return variants[h % variants.length];
}
