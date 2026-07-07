"use client";

import * as React from "react";
import { Lightbulb } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsInsightRow } from "@/lib/supabase/types";
import type { LiveInsight } from "@/server/analytics/insights";
import type { PostWithMetrics } from "@/server/analytics/derived";

type AnyInsight = AnalyticsInsightRow | LiveInsight;

export function InsightsList({
  insights,
  posts,
}: {
  insights: AnyInsight[];
  posts: PostWithMetrics[];
}) {
  if (insights.length === 0) return null;
  const postById = new Map(posts.map((p) => [p.id, p]));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">What this means</h2>
          <p className="text-sm text-muted-foreground">
            Plain-English takeaways from your last few posts.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {insights.map((i, idx) => (
          <InsightCard key={idx} insight={i} postById={postById} />
        ))}
      </div>
    </section>
  );
}

function InsightCard({
  insight,
  postById,
}: {
  insight: AnyInsight;
  postById: Map<string, PostWithMetrics>;
}) {
  const related = insight.related_post_ids
    .map((id) => postById.get(id))
    .filter((p): p is PostWithMetrics => !!p)
    .slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md bg-brand/15 text-brand">
            <Lightbulb className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <CardTitle>{insight.title}</CardTitle>
            <CardDescription>{insight.observation}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{insight.explanation}</p>
        {insight.recommended_action && (
          <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-sm">
            <span className="font-medium">Try this: </span>
            {insight.recommended_action}
          </p>
        )}
        {related.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Related:</span>
            <div className="flex -space-x-2">
              {related.map((p) =>
                p.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={p.thumbnail_url}
                    alt=""
                    className="size-8 rounded-md border-2 border-card object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span
                    key={p.id}
                    className="inline-block size-8 rounded-md border-2 border-card bg-muted"
                  />
                ),
              )}
            </div>
          </div>
        )}
        <Badge variant="outline" className="self-start text-[10px]">
          Confidence: {insight.confidence}
        </Badge>
      </CardContent>
    </Card>
  );
}
