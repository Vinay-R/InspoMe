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
import type { EngagementMix } from "@/server/analytics/derived";

const HINTS: Record<string, string> = {
  Likes: "Quick reactions — easy to earn.",
  Comments: "Conversation — your most engaged viewers.",
  Shares: "Spread — content that reaches new people.",
  Saves: "Value — content people want to revisit.",
};

export function EngagementMixChart({ mix }: { mix: EngagementMix }) {
  const data = [
    { name: "Likes", value: mix.likes, fill: "var(--chart-1)" },
    { name: "Comments", value: mix.comments, fill: "var(--chart-2)" },
    { name: "Shares", value: mix.shares, fill: "var(--chart-3)" },
    {
      name: "Saves",
      value: mix.savesAvailable ? mix.saves : 0,
      fill: "var(--chart-4)",
      unavailable: !mix.savesAvailable,
    },
  ];
  const hasData = data.some((d) => d.value > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Engagement mix</CardTitle>
        <CardDescription>What kind of interaction your audience gives.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No engagement to break down yet.
          </p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
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
                <Bar dataKey="value" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
          {Object.entries(HINTS).map(([k, v]) => (
            <li key={k} className="flex items-baseline gap-1">
              <span className="font-medium text-foreground">{k}:</span> {v}
            </li>
          ))}
        </ul>
        {!mix.savesAvailable && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Saves aren&apos;t reported by every platform.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
