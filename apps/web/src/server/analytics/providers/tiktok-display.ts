import "server-only";

import type { AnalyticsProvider, SyncResult } from "../types";

// Skeleton for the real TikTok Display API integration. TikTok's official
// Display API is gated and exposes a narrow metric set (no saves, no
// retention curves) — when it lands, the data model handles missing metrics
// via nullable columns. Currently disabled; service.ts falls back to stub.
export class TikTokDisplayProvider implements AnalyticsProvider {
  readonly name = "tiktok-display";
  readonly platform = "tiktok" as const;
  readonly canConnect = false;

  async syncAccount(): Promise<SyncResult> {
    throw new Error(
      "TikTok Display provider is not yet wired. Real OAuth + metrics pull pending.",
    );
  }
}
