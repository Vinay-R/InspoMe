"use client";

import * as React from "react";
import { Sparkles, Plus, Camera, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/server/analytics/insights";

const KIND_LABEL: Record<Recommendation["kind"], string> = {
  ride_winners: "Based on what's working",
  low_effort: "Low effort",
  experiment: "High-upside experiment",
  double_down: "Double down",
};

export function RecommendationsList({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  if (recommendations.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">What to post next</h2>
        <p className="text-sm text-muted-foreground">
          Ideas pulled from your top posts and saved inspo.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {recommendations.map((r) => (
          <RecommendationCard key={r.id} rec={r} />
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-7 items-center justify-center rounded-md bg-brand/15 text-brand">
            <Sparkles className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="self-start text-[10px]">
              {KIND_LABEL[rec.kind]}
            </Badge>
            <CardTitle className="text-base">{rec.hook}</CardTitle>
            <CardDescription>{rec.reason}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {rec.format && (
            <Badge variant="secondary">{humanize(rec.format)}</Badge>
          )}
          {rec.pillar && <Badge variant="outline">{humanize(rec.pillar)}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="brand">
            <Plus className="size-4" />
            Add to ideas
          </Button>
          <Button size="sm" variant="outline">
            <Camera className="size-4" />
            Film this
          </Button>
          <Button size="sm" variant="ghost">
            <Wand2 className="size-4" />
            Variations
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function humanize(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
