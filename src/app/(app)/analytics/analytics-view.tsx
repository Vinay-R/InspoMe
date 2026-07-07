"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, RefreshCw, Lock, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AnalyticsInsightRow,
  ConnectedAccountClientRow,
  CreatorPostRow,
  PostMetricSnapshotRow,
} from "@/lib/supabase/types";
import { ConnectAccountsCard } from "./connect-accounts-card";
import { OverviewCards } from "./overview-cards";
import { PostsFeed } from "./posts-feed";
import { ViewsOverTimeChart } from "./charts/views-over-time";
import { EngagementMixChart } from "./charts/engagement-mix";
import { PostingTimesHeatmap } from "./charts/posting-times-heatmap";
import { FormatPerformanceChart } from "./charts/format-performance";
import { PillarPerformanceChart } from "./charts/pillar-performance";
import { RetentionChart } from "./charts/retention-chart";
import { InsightsList } from "./insights-list";
import { RecommendationsList } from "./recommendations-list";
import { CompareDrawer } from "./compare-drawer";
import {
  rollupOverview,
  dailyViews,
  engagementMix,
  postingTimeHeatmap,
  formatPerformance,
  pillarPerformance,
  type PostWithMetrics,
} from "@/server/analytics/derived";
import { generateInsights, generateRecommendations } from "@/server/analytics/insights";

const WINDOW_OPTIONS = [7, 30, 90] as const;

interface Props {
  window: 7 | 30 | 90;
  accounts: ConnectedAccountClientRow[];
  posts: CreatorPostRow[];
  snapshots: PostMetricSnapshotRow[];
  insights: AnalyticsInsightRow[];
}

export function AnalyticsView({
  window,
  accounts: initialAccounts,
  posts,
  snapshots,
  insights: initialInsights,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = React.useState(initialAccounts);
  const [compareIds, setCompareIds] = React.useState<string[]>([]);
  const [compareOpen, setCompareOpen] = React.useState(false);
  // Freeze `now` per mount so window cutoffs are stable across re-renders
  // (and so the lint purity rule is satisfied — Date.now/new Date are impure).
  const [now] = React.useState(() => new Date());

  const isAnyConnected = accounts.length > 0;
  const isAnySyncing = accounts.some((a) => a.connection_status === "syncing");

  // Poll connection status while any account is syncing.
  React.useEffect(() => {
    if (!isAnySyncing) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/analytics/status", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json.data)) {
          setAccounts(json.data);
          // If sync just completed, refresh server data.
          const stillSyncing = json.data.some(
            (a: ConnectedAccountClientRow) => a.connection_status === "syncing",
          );
          if (!stillSyncing) router.refresh();
        }
      } catch {
        // keep last good state
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isAnySyncing, router]);

  // Build the working PostWithMetrics list (latest snapshot per post).
  const postsWithMetrics = React.useMemo<PostWithMetrics[]>(() => {
    const latest = new Map<string, PostMetricSnapshotRow>();
    for (const s of snapshots) {
      const cur = latest.get(s.creator_post_id);
      if (!cur || cur.captured_at < s.captured_at) latest.set(s.creator_post_id, s);
    }
    return posts.map((p) => ({ ...p, metrics: latest.get(p.id) ?? null }));
  }, [posts, snapshots]);

  // Filter posts to the selected window for charts/cards (but the feed itself
  // shows everything so users can browse history).
  const inWindowPosts = React.useMemo(() => {
    const cutoff = now.getTime() - window * 86_400_000;
    return postsWithMetrics.filter(
      (p) => p.posted_at && new Date(p.posted_at).getTime() >= cutoff,
    );
  }, [postsWithMetrics, window, now]);

  const overview = React.useMemo(
    () => rollupOverview(postsWithMetrics, window, now),
    [postsWithMetrics, window, now],
  );
  const daily = React.useMemo(
    () => dailyViews(postsWithMetrics, window, now),
    [postsWithMetrics, window, now],
  );
  const mix = React.useMemo(() => engagementMix(inWindowPosts), [inWindowPosts]);
  const heatmap = React.useMemo(() => postingTimeHeatmap(inWindowPosts), [inWindowPosts]);
  const formats = React.useMemo(() => formatPerformance(inWindowPosts), [inWindowPosts]);
  const pillars = React.useMemo(() => pillarPerformance(inWindowPosts), [inWindowPosts]);
  const insights = React.useMemo(() => {
    if (initialInsights.length > 0) return initialInsights;
    // Fall back to live heuristics so the UI is never empty after a fresh sync
    // (we don't persist insights yet — they're cheap to compute on render).
    return generateInsights(inWindowPosts, window);
  }, [initialInsights, inWindowPosts, window]);
  const recommendations = React.useMemo(
    () => generateRecommendations(inWindowPosts),
    [inWindowPosts],
  );

  function setWindow(next: 7 | 30 | 90) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("window", String(next));
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  async function syncAll() {
    setAccounts((a) =>
      a.map((acc) => ({ ...acc, connection_status: "syncing" as const })),
    );
    try {
      await fetch("/api/analytics/sync", { method: "POST" });
    } catch {
      // status poll will reconcile
    }
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  const igError = searchParams.get("ig_error");
  const igConnected = searchParams.get("ig_connected");

  function clearOAuthParams() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ig_error");
    params.delete("ig_connected");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  if (!isAnyConnected) {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <Header />
        {igError && <ErrorBanner code={igError} onDismiss={clearOAuthParams} />}
        <ConnectAccountsCard accounts={[]} onAccountsUpdate={setAccounts} />
        <EmptyHero />
      </div>
    );
  }

  const isMock = accounts.some((a) => a.is_mock);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <Header
        right={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border p-1">
              {WINDOW_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindow(w)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    window === w
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {w}d
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={syncAll} disabled={isAnySyncing}>
              <RefreshCw className={cn("size-4", isAnySyncing && "animate-spin")} />
              {isAnySyncing ? "Syncing…" : "Sync"}
            </Button>
          </div>
        }
      />

      {igError && <ErrorBanner code={igError} onDismiss={clearOAuthParams} />}
      {igConnected && (
        <SuccessBanner
          message="Instagram connected. Pulling your latest posts…"
          onDismiss={clearOAuthParams}
        />
      )}
      {isMock && <MockBanner />}

      <ConnectAccountsCard accounts={accounts} onAccountsUpdate={setAccounts} compact />

      <OverviewCards
        window={window}
        current={overview.current}
        previous={overview.previous}
      />

      <InsightsList insights={insights} posts={postsWithMetrics} />

      <RecommendationsList recommendations={recommendations} />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ViewsOverTimeChart data={daily} />
        <EngagementMixChart mix={mix} />
        <PostingTimesHeatmap grid={heatmap} />
        <FormatPerformanceChart data={formats} />
        <PillarPerformanceChart data={pillars} />
        <RetentionChart posts={inWindowPosts} />
      </section>

      <PostsFeed
        posts={postsWithMetrics}
        compareIds={compareIds}
        onToggleCompare={toggleCompare}
        onOpenCompare={() => setCompareOpen(true)}
      />

      <CompareDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        posts={postsWithMetrics.filter((p) => compareIds.includes(p.id))}
        onClear={() => setCompareIds([])}
      />
    </div>
  );
}

function Header({ right }: { right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Understand what&apos;s working and what to post next.
        </p>
      </div>
      {right}
    </div>
  );
}

function MockBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
      <p>
        <span className="font-medium">Demo data.</span>{" "}
        <span className="text-muted-foreground">
          Real Instagram and TikTok sync are coming soon — for now you&apos;re seeing
          synthetic posts so you can preview the experience.
        </span>
      </p>
    </div>
  );
}

const IG_ERROR_COPY: Record<string, string> = {
  missing_code: "Instagram didn't return an authorization code. Please try again.",
  state_mismatch: "The connection request didn't match — try connecting again from this tab.",
  token_exchange_failed: "Instagram rejected the authorization. Double-check your Meta app's redirect URI and that you're added as a test user.",
  long_lived_exchange_failed: "We couldn't extend the short-lived token. Try connecting again.",
  persist_failed: "We couldn't save the connection. Try again in a moment.",
  unauthorized: "Sign in again and re-try connecting.",
  provider_unavailable: "Instagram isn't configured on this deployment yet.",
  network: "We couldn't reach Instagram. Try again in a moment.",
};

function ErrorBanner({ code, onDismiss }: { code: string; onDismiss: () => void }) {
  const msg = IG_ERROR_COPY[code] ?? `Connection failed (${code}).`;
  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 pr-10 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="text-foreground">{msg}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function SuccessBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 pr-10 text-sm">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p className="text-foreground">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Sparkles className="size-6" />
      </div>
      <p className="font-medium">Your coach is one click away</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Connect Instagram or TikTok to see what&apos;s working, get plain-English
        insights, and decide what to post next.
      </p>
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" />
        We only use your data to show your analytics and recommendations.
      </p>
    </div>
  );
}
