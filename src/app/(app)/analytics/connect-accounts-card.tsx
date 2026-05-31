"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Loader2, Plug, Plus, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ConnectedAccountRow } from "@/lib/supabase/types";

const PLATFORMS = [
  { key: "instagram" as const, label: "Instagram" },
  { key: "tiktok" as const, label: "TikTok" },
];

interface Props {
  accounts: ConnectedAccountRow[];
  onAccountsUpdate?: (next: ConnectedAccountRow[]) => void;
  compact?: boolean;
}

export function ConnectAccountsCard({ accounts, onAccountsUpdate, compact }: Props) {
  const byPlatform = React.useMemo(
    () => new Map(accounts.map((a) => [a.platform, a])),
    [accounts],
  );

  const [busy, setBusy] = React.useState<string | null>(null);

  async function connect(platform: "instagram" | "tiktok") {
    setBusy(platform);
    try {
      const res = await fetch("/api/analytics/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.code === "provider_unavailable") {
          alert(
            "Real OAuth for this platform isn't ready yet. Stay tuned.",
          );
        } else {
          alert(json.error ?? "Couldn't connect.");
        }
        return;
      }
      // Refresh accounts via the status endpoint
      const sres = await fetch("/api/analytics/status", { cache: "no-store" });
      const sjson = await sres.json();
      if (Array.isArray(sjson.data)) onAccountsUpdate?.(sjson.data);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(platform: "instagram" | "tiktok") {
    if (!confirm("Disconnect and remove this account's analytics data?")) return;
    setBusy(platform);
    try {
      await fetch("/api/analytics/connect", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      onAccountsUpdate?.(accounts.filter((a) => a.platform !== platform));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        {!compact && (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3" />
            We only use your data to show your analytics and recommendations.
          </p>
        )}
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PLATFORMS.map(({ key, label }) => {
          const acc = byPlatform.get(key);
          if (!acc) {
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-dashed border-border bg-background p-3"
              >
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">Not connected</p>
                </div>
                <Button
                  size="sm"
                  variant="brand"
                  onClick={() => connect(key)}
                  loading={busy === key}
                >
                  <Plus className="size-4" />
                  Connect
                </Button>
              </div>
            );
          }
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {acc.username ?? acc.display_name ?? "—"}
                  {acc.is_mock && " · demo"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ConnectionBadge account={acc} />
                <button
                  type="button"
                  onClick={() => disconnect(key)}
                  disabled={busy === key}
                  aria-label={`Disconnect ${label}`}
                  className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ConnectionBadge({ account }: { account: ConnectedAccountRow }) {
  if (account.connection_status === "syncing") {
    return (
      <Badge variant="secondary">
        <Loader2 className="size-3 animate-spin" />
        Syncing
      </Badge>
    );
  }
  if (account.connection_status === "needs_reauth") {
    return (
      <Badge variant="warning">
        <AlertTriangle className="size-3" />
        Reconnect
      </Badge>
    );
  }
  if (account.connection_status === "disconnected") {
    return (
      <Badge variant="outline">
        <Plug className="size-3" />
        Disconnected
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <CheckCircle2 className="size-3" />
      <span className={cn(account.last_synced_at ? "" : "hidden sm:inline")}>
        {account.last_synced_at
          ? `Synced ${formatRelativeTime(account.last_synced_at)}`
          : "Connected"}
      </span>
    </Badge>
  );
}
