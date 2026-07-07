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
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCount } from "@/lib/utils";
import type { TagPerformance } from "@/server/analytics/derived";

export function FormatPerformanceChart({ data }: { data: TagPerformance[] }) {
  const top = data.slice(0, 8).map((d) => ({
    ...d,
    label: humanize(d.tag),
  }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Format performance</CardTitle>
        <CardDescription>Which formats earned the most views.</CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Tag posts with formats to see this.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(v: number) => formatCount(v)}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={110}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
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
                <Bar dataKey="totalViews" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function humanize(t: string): string {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
