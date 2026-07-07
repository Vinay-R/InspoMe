"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCount } from "@/lib/utils";
import type { Heatmap } from "@/server/analytics/derived";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function PostingTimesHeatmap({ grid }: { grid: Heatmap }) {
  const max = React.useMemo(() => {
    let m = 0;
    for (const row of grid) for (const v of row) if (v > m) m = v;
    return m;
  }, [grid]);

  // Find the best 3-hour band for the recommendation copy.
  const recommendation = React.useMemo(() => {
    if (max === 0) return null;
    let best = { day: 0, startHour: 0, total: 0 };
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h <= 21; h++) {
        const total = grid[d][h] + grid[d][h + 1] + grid[d][h + 2];
        if (total > best.total) best = { day: d, startHour: h, total };
      }
    }
    if (best.total === 0) return null;
    return `${DAYS[best.day]} · ${formatHour(best.startHour)}–${formatHour(best.startHour + 3)}`;
  }, [grid, max]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Best posting times</CardTitle>
        <CardDescription>
          {recommendation
            ? `Your strongest posting window is ${recommendation}.`
            : "Post a few more times so we can spot a pattern."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden">
          <div className="grid grid-cols-[auto_repeat(24,minmax(0,1fr))] gap-0.5 text-[9px]">
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="text-center text-muted-foreground">
                {h % 6 === 0 ? formatHour(h) : ""}
              </div>
            ))}
            {DAYS.map((day, d) => (
              <React.Fragment key={day}>
                <div className="pr-1 text-right text-muted-foreground">{day}</div>
                {Array.from({ length: 24 }, (_, h) => {
                  const v = grid[d][h];
                  const intensity = max === 0 ? 0 : v / max;
                  return (
                    <div
                      key={h}
                      className={cn(
                        "aspect-square rounded-[2px]",
                        intensity === 0 ? "bg-muted" : "",
                      )}
                      style={
                        intensity > 0
                          ? {
                              background: `color-mix(in oklab, var(--brand) ${Math.round(intensity * 100)}%, transparent)`,
                            }
                          : undefined
                      }
                      title={`${day} ${formatHour(h)} — ${formatCount(v)} avg views`}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const am = hh < 12;
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}${am ? "a" : "p"}`;
}
