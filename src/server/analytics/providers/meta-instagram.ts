import "server-only";

import type { AnalyticsProvider, SyncResult } from "../types";

// Skeleton for the real Meta Graph API integration. Selected by service.ts
// only when META_APP_ID + META_APP_SECRET are present. The OAuth callback
// route + Insights API ingestion is deferred to a follow-up phase — for now
// this throws if called, so the service falls back to the stub.
export class MetaInstagramProvider implements AnalyticsProvider {
  readonly name = "meta-instagram";
  readonly platform = "instagram" as const;
  readonly canConnect = false;

  async syncAccount(): Promise<SyncResult> {
    throw new Error(
      "Meta Instagram provider is not yet wired. Real OAuth + Insights pull pending.",
    );
  }
}
