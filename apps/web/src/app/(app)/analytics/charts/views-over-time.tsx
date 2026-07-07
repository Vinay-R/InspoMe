"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount } from "@/lib/utils";
import type { DailyViewsPoint } from "@/server/analytics/derived";

export function ViewsOverTimeChart({ data }: { data: DailyViewsPoint[] }) {
  const hasData = data.some((d) => d.total > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Views over time</CardTitle>
        <CardDescription>How your reach changed day-to-day.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No views in this window.
          </p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="vot-ig" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="vot-tt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(v: number) => formatCount(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => formatCount(Number(v))}
                />
                <Area
                  type="monotone"
                  dataKey="instagram"
                  stroke="var(--chart-1)"
                  fill="url(#vot-ig)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="tiktok"
                  stroke="var(--chart-2)"
                  fill="url(#vot-tt)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <Legend />
      </CardContent>
    </Card>
  );
}

function Legend() {
  return (
    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full" style={{ background: "var(--chart-1)" }} />
        Instagram
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full" style={{ background: "var(--chart-2)" }} />
        TikTok
      </span>
    </div>
  );
}
