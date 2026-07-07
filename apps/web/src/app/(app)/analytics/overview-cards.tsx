"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn, formatCount } from "@/lib/utils";
import type { OverviewTotals } from "@/server/analytics/derived";
import { pctChange } from "@/server/analytics/derived";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface Props {
  window: 7 | 30 | 90;
  current: OverviewTotals;
  previous: OverviewTotals;
}

export function OverviewCards({ window, current, previous }: Props) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <MetricCard
        label="Total views"
        value={formatCount(current.views)}
        delta={pctChange(current.views, previous.views)}
        copy={viewsCopy(current.views, previous.views, window)}
      />
      <MetricCard
        label="Total engagement"
        value={formatCount(current.engagement)}
        delta={pctChange(current.engagement, previous.engagement)}
        copy={engagementCopy(current.engagement, previous.engagement)}
      />
      <MetricCard
        label="Avg engagement rate"
        value={
          current.avgEngagementRate != null
            ? (current.avgEngagementRate * 100).toFixed(1) + "%"
            : "—"
        }
        delta={
          current.avgEngagementRate != null && previous.avgEngagementRate != null
            ? pctChange(current.avgEngagementRate, previous.avgEngagementRate)
            : undefined
        }
        copy="Engagement divided by reach. Higher means people are reacting to your posts more."
      />
      <MetricCard
        label="Saves"
        value={current.saves != null ? formatCount(current.saves) : "Unavailable"}
        unavailable={current.saves == null}
        delta={
          current.saves != null && previous.saves != null
            ? pctChange(current.saves, previous.saves)
            : undefined
        }
        copy={
          current.saves == null
            ? "Saves aren't available from this platform."
            : "Saves are a strong signal that people find your content useful."
        }
      />
      <MetricCard
        label="Shares"
        value={formatCount(current.shares)}
        delta={pctChange(current.shares, previous.shares)}
        copy={sharesCopy(current.shares, previous.shares)}
      />
      <MetricCard
        label="Follower growth"
        value={current.followerGrowth != null ? `+${formatCount(current.followerGrowth)}` : "Unavailable"}
        unavailable={current.followerGrowth == null}
        copy={
          current.followerGrowth == null
            ? "We'll show this once Instagram Insights is connected."
            : "New followers in this window."
        }
      />
      <MetricCard
        label="Best performing platform"
        value={
          current.bestPlatform
            ? current.bestPlatform.platform === "instagram"
              ? "Instagram"
              : "TikTok"
            : "—"
        }
        copy={
          current.bestPlatform
            ? `${formatCount(current.bestPlatform.views)} views came from ${current.bestPlatform.platform === "instagram" ? "Instagram" : "TikTok"}.`
            : "Connect both platforms to compare."
        }
      />
      <MetricCard
        label="Best posting time"
        value={
          current.bestPostingWindow
            ? `${DAYS[current.bestPostingWindow.day]} · ${formatHour(current.bestPostingWindow.hour)}`
            : "—"
        }
        copy={
          current.bestPostingWindow
            ? "Your top-viewed window in this period."
            : "Post a few more times so we can spot a pattern."
        }
      />
      <MetricCard
        label="Top format"
        value={current.topFormat ? humanizeTag(current.topFormat.format) : "—"}
        copy={
          current.topFormat
            ? `${formatCount(current.topFormat.views)} views came from this format.`
            : "Tag a few posts to see your strongest format."
        }
      />
    </section>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  delta?: ReturnType<typeof pctChange>;
  copy: string;
  unavailable?: boolean;
}
function MetricCard({ label, value, delta, copy, unavailable }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold leading-tight tabular-nums md:text-3xl",
          unavailable && "text-muted-foreground text-base font-medium md:text-base",
        )}
      >
        {value}
      </p>
      {delta && <DeltaPill delta={delta} />}
      <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{copy}</p>
    </div>
  );
}

function DeltaPill({ delta }: { delta: ReturnType<typeof pctChange> }) {
  const Icon =
    delta.direction === "up" ? ArrowUp : delta.direction === "down" ? ArrowDown : Minus;
  const color =
    delta.direction === "up"
      ? "text-success"
      : delta.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";
  if (delta.pct == null) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", color)}>
      <Icon className="size-3" />
      {Math.abs(delta.pct).toFixed(0)}%
      <span className="text-[10px] font-normal text-muted-foreground">vs prev</span>
    </span>
  );
}

function viewsCopy(cur: number, prev: number, window: number): string {
  if (cur === 0) return `Save your first post — we'll start showing trends.`;
  if (prev === 0) return `Your first ${window}-day window has views — keep going.`;
  const ch = ((cur - prev) / prev) * 100;
  if (ch > 10) return `Views are up ${ch.toFixed(0)}% — your content is reaching more people.`;
  if (ch < -10) return `Views are down ${Math.abs(ch).toFixed(0)}% — try changing your hook or posting time.`;
  return `Views are roughly flat vs the prior ${window} days.`;
}

function engagementCopy(cur: number, prev: number): string {
  if (cur === 0) return "No engagement signal yet in this window.";
  const ch = prev === 0 ? 0 : ((cur - prev) / prev) * 100;
  if (ch > 10) return `People are interacting more — likes, comments, shares, and saves are up.`;
  if (ch < -10) return `Interactions are down. Lean into what worked recently.`;
  return "Audience interaction is steady.";
}

function sharesCopy(cur: number, prev: number): string {
  if (cur === 0) return "Shares are how content spreads beyond your audience.";
  const ch = prev === 0 ? 0 : ((cur - prev) / prev) * 100;
  if (ch > 10)
    return `Your shares are up ${ch.toFixed(0)}% — more people are sending your content to others.`;
  if (ch < -10)
    return `Shares dropped ${Math.abs(ch).toFixed(0)}%. Try a more share-worthy hook or punchline.`;
  return "Shares are roughly flat vs the prior period.";
}

function formatHour(h: number): string {
  const am = h < 12;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${am ? "am" : "pm"}`;
}

function humanizeTag(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
