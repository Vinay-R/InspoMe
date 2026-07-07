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

export function PillarPerformanceChart({ data }: { data: TagPerformance[] }) {
  const top = data.slice(0, 8).map((d) => ({ ...d, label: humanize(d.tag) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pillar performance</CardTitle>
        <CardDescription>Which themes drive your audience.</CardDescription>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Set content pillars in your settings to see this.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={50}
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
                  formatter={(v, key) => {
                    const n = Number(v);
                    if (key === "totalViews") return [formatCount(n), "Views"];
                    if (key === "totalSaves") return [formatCount(n), "Saves"];
                    if (key === "totalShares") return [formatCount(n), "Shares"];
                    return [String(v), String(key)];
                  }}
                />
                <Bar dataKey="totalViews" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="totalShares" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="totalSaves" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
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
