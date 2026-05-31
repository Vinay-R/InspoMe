"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PostWithMetrics } from "@/server/analytics/derived";

export function RetentionChart({ posts }: { posts: PostWithMetrics[] }) {
  const data = React.useMemo(() => {
    return posts
      .filter((p) => p.metrics?.completion_rate != null)
      .sort((a, b) => (b.metrics?.completion_rate ?? 0) - (a.metrics?.completion_rate ?? 0))
      .slice(0, 10)
      .map((p, i) => ({
        label: `#${i + 1}`,
        rate: Math.round((p.metrics?.completion_rate ?? 0) * 100),
        caption: p.caption?.slice(0, 60) ?? "—",
      }));
  }, [posts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention</CardTitle>
        <CardDescription>
          {data.length === 0
            ? "Retention isn't reported for these posts yet."
            : "Top posts by completion rate."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Retention data is unavailable from the connected platform.
          </p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => `${Number(v)}%`}
                  labelFormatter={(_l: unknown, payload) =>
                    (payload?.[0]?.payload as { caption?: string } | undefined)?.caption ?? ""
                  }
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.rate >= 60 ? "var(--chart-3)" : "var(--chart-1)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
