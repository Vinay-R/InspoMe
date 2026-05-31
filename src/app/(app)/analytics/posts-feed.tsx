"use client";

import * as React from "react";
import {
  ArrowDownUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCount, formatRelativeTime } from "@/lib/utils";
import type { PostWithMetrics } from "@/server/analytics/derived";

const SORT_OPTIONS = [
  { key: "posted_at", label: "Date posted" },
  { key: "views", label: "Views" },
  { key: "engagement_rate", label: "Engagement rate" },
  { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

interface Props {
  posts: PostWithMetrics[];
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onOpenCompare: () => void;
}

export function PostsFeed({ posts, compareIds, onToggleCompare, onOpenCompare }: Props) {
  const [search, setSearch] = React.useState("");
  const [platform, setPlatform] = React.useState<"" | "instagram" | "tiktok">("");
  const [pillar, setPillar] = React.useState<string>("");
  const [format, setFormat] = React.useState<string>("");
  const [sortKey, setSortKey] = React.useState<SortKey>("posted_at");
  const [sortDesc, setSortDesc] = React.useState(true);
  const [compareMode, setCompareMode] = React.useState(false);

  const allPillars = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) if (p.pillar_tag) set.add(p.pillar_tag);
    return [...set].sort();
  }, [posts]);
  const allFormats = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of posts) if (p.format_tag) set.add(p.format_tag);
    return [...set].sort();
  }, [posts]);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (term) {
        const inCaption = p.caption?.toLowerCase().includes(term) ?? false;
        if (!inCaption) return false;
      }
      if (platform && p.platform !== platform) return false;
      if (pillar && p.pillar_tag !== pillar) return false;
      if (format && p.format_tag !== format) return false;
      return true;
    });
  }, [posts, search, platform, pillar, format]);

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDesc ? (bv > av ? 1 : -1) : av > bv ? 1 : -1;
    });
    return arr;
  }, [filtered, sortKey, sortDesc]);

  const isFiltering = !!(search || platform || pillar || format);

  function clear() {
    setSearch("");
    setPlatform("");
    setPillar("");
    setFormat("");
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Your posts</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={compareMode ? "brand" : "outline"}
            onClick={() => {
              const next = !compareMode;
              setCompareMode(next);
              if (next && compareIds.length >= 2) onOpenCompare();
            }}
          >
            {compareMode ? "Done" : "Compare"}
            {compareIds.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {compareIds.length}
              </Badge>
            )}
          </Button>
          {compareMode && compareIds.length >= 2 && (
            <Button size="sm" variant="brand" onClick={onOpenCompare}>
              Compare {compareIds.length}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder="Search captions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            className="flex-1"
          />
          <div className="flex items-center gap-1.5">
            {(["", "instagram", "tiktok"] as const).map((p) => (
              <button
                key={p || "all"}
                type="button"
                onClick={() => setPlatform(p)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  platform === p
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {p === "" ? "All" : p === "instagram" ? "Instagram" : "TikTok"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {allPillars.length > 0 && (
            <FilterSelect
              label="Pillar"
              value={pillar}
              options={allPillars}
              onChange={setPillar}
            />
          )}
          {allFormats.length > 0 && (
            <FilterSelect
              label="Format"
              value={format}
              options={allFormats}
              onChange={setFormat}
            />
          )}
          <SortControl
            sortKey={sortKey}
            sortDesc={sortDesc}
            onChange={(k, d) => {
              setSortKey(k);
              setSortDesc(d);
            }}
          />
          {isFiltering && (
            <button
              type="button"
              onClick={clear}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <X className="size-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No posts match your filters.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sorted.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              compareMode={compareMode}
              selected={compareIds.includes(p.id)}
              onToggleCompare={() => onToggleCompare(p.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 py-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-foreground focus:outline-none"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {humanize(opt)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortControl({
  sortKey,
  sortDesc,
  onChange,
}: {
  sortKey: SortKey;
  sortDesc: boolean;
  onChange: (k: SortKey, d: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 py-1 text-xs text-muted-foreground">
      <ArrowDownUp className="size-3" />
      <select
        value={sortKey}
        onChange={(e) => onChange(e.target.value as SortKey, sortDesc)}
        className="bg-transparent text-foreground focus:outline-none"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange(sortKey, !sortDesc)}
        className="text-foreground"
        aria-label={sortDesc ? "Sort ascending" : "Sort descending"}
      >
        {sortDesc ? "↓" : "↑"}
      </button>
    </label>
  );
}

function PostCard({
  post,
  compareMode,
  selected,
  onToggleCompare,
}: {
  post: PostWithMetrics;
  compareMode: boolean;
  selected: boolean;
  onToggleCompare: () => void;
}) {
  const m = post.metrics;
  return (
    <li>
      <div
        className={cn(
          "group block overflow-hidden rounded-xl border border-border bg-card transition-colors",
          selected && "border-brand ring-2 ring-brand/30",
        )}
      >
        <div className="relative aspect-[9/12] w-full overflow-hidden bg-secondary">
          {post.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.thumbnail_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <span className="text-xs">No thumbnail</span>
            </div>
          )}
          <div className="absolute left-2 top-2">
            <Badge variant="secondary" className="bg-background/85 backdrop-blur">
              {post.platform === "instagram" ? "Instagram" : "TikTok"}
            </Badge>
          </div>
          {compareMode && (
            <button
              type="button"
              onClick={onToggleCompare}
              aria-pressed={selected}
              className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-background/85 text-foreground backdrop-blur"
            >
              {selected ? (
                <CheckSquare className="size-4 text-brand" />
              ) : (
                <Square className="size-4" />
              )}
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {post.posted_at
                ? formatRelativeTime(post.posted_at)
                : "Not posted yet"}
            </span>
            {post.format_tag && (
              <>
                <span aria-hidden>·</span>
                <span className="truncate">{humanize(post.format_tag)}</span>
              </>
            )}
          </div>
          <p className="text-sm line-clamp-2 min-h-[2.5em]">{post.caption}</p>
          <MetricsRow metrics={m} />
        </div>
      </div>
    </li>
  );
}

function MetricsRow({
  metrics,
}: {
  metrics: PostWithMetrics["metrics"];
}) {
  if (!metrics) {
    return (
      <p className="text-xs text-muted-foreground">No metrics available yet.</p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3" />
        {formatCount(metrics.views)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Heart className="size-3" />
        {formatCount(metrics.likes)}
      </span>
      <span className="inline-flex items-center gap-1">
        <MessageCircle className="size-3" />
        {formatCount(metrics.comments)}
      </span>
      <span className="inline-flex items-center gap-1">
        <Share2 className="size-3" />
        {formatCount(metrics.shares)}
      </span>
      {metrics.saves != null && (
        <span className="inline-flex items-center gap-1">
          <Bookmark className="size-3" />
          {formatCount(metrics.saves)}
        </span>
      )}
      {metrics.engagement_rate != null && (
        <span className="ml-auto font-medium text-foreground">
          {(metrics.engagement_rate * 100).toFixed(1)}% ER
        </span>
      )}
    </div>
  );
}

function sortValue(p: PostWithMetrics, key: SortKey): number | null {
  const m = p.metrics;
  switch (key) {
    case "posted_at":
      return p.posted_at ? new Date(p.posted_at).getTime() : null;
    case "views":
      return m?.views ?? null;
    case "engagement_rate":
      return m?.engagement_rate ?? null;
    case "shares":
      return m?.shares ?? null;
    case "saves":
      return m?.saves ?? null;
  }
}

function humanize(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
