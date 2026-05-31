"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCount, formatRelativeTime } from "@/lib/utils";
import { compareSummary, type PostWithMetrics } from "@/server/analytics/derived";

interface Props {
  open: boolean;
  onClose: () => void;
  posts: PostWithMetrics[];
  onClear: () => void;
}

export function CompareDrawer({ open, onClose, posts, onClear }: Props) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const summary =
    posts.length === 2 ? compareSummary(posts[0], posts[1]) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center">
      <div
        role="presentation"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare posts"
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl",
          "md:max-w-4xl md:rounded-2xl",
        )}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <p className="text-base font-semibold">Compare posts</p>
            <p className="text-xs text-muted-foreground">
              {posts.length === 0
                ? "Pick at least 2 posts to compare."
                : `${posts.length} post${posts.length === 1 ? "" : "s"} selected`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {posts.length > 0 && (
              <Button size="sm" variant="ghost" onClick={onClear}>
                Clear
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {posts.length < 2 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Select 2–4 posts in the feed to compare them side-by-side.
            </p>
          ) : (
            <>
              {summary && (
                <p className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  {summary}
                </p>
              )}
              <div
                className={cn(
                  "grid gap-3",
                  posts.length === 2 && "grid-cols-2",
                  posts.length === 3 && "grid-cols-3",
                  posts.length === 4 && "grid-cols-2 md:grid-cols-4",
                )}
              >
                {posts.map((p) => (
                  <CompareColumn key={p.id} post={p} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareColumn({ post }: { post: PostWithMetrics }) {
  const m = post.metrics;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-2">
      <div className="aspect-[9/12] w-full overflow-hidden rounded-md bg-secondary">
        {post.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>
      <Badge variant="secondary" className="self-start">
        {post.platform === "instagram" ? "Instagram" : "TikTok"}
      </Badge>
      <p className="line-clamp-3 text-xs">{post.caption}</p>
      <div className="text-[11px] text-muted-foreground">
        {post.posted_at ? formatRelativeTime(post.posted_at) : "—"}
        {post.format_tag && ` · ${humanize(post.format_tag)}`}
      </div>
      <dl className="grid grid-cols-2 gap-1 text-xs">
        <Stat label="Views" value={formatCount(m?.views ?? null)} />
        <Stat
          label="ER"
          value={m?.engagement_rate != null ? (m.engagement_rate * 100).toFixed(1) + "%" : "—"}
        />
        <Stat label="Shares" value={formatCount(m?.shares ?? null)} />
        <Stat label="Saves" value={formatCount(m?.saves ?? null)} />
        <Stat
          label="Completion"
          value={
            m?.completion_rate != null
              ? Math.round(m.completion_rate * 100) + "%"
              : "—"
          }
        />
        <Stat label="Comments" value={formatCount(m?.comments ?? null)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded border border-border bg-card p-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function humanize(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
