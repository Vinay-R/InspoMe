import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import type { ConnectedAccountRow } from "@/lib/supabase/types";

import type { AnalyticsPlatform, AnalyticsProvider, SyncResult } from "./types";
import { StubInstagramProvider } from "./providers/stub-instagram";
import { StubTikTokProvider } from "./providers/stub-tiktok";
import { MetaInstagramProvider } from "./providers/meta-instagram";
import { TikTokDisplayProvider } from "./providers/tiktok-display";

let cached: AnalyticsService | null = null;

interface ProviderPair {
  real: AnalyticsProvider;
  stub: AnalyticsProvider;
}

/**
 * Owns the lifecycle of an analytics sync:
 *   connected_account → provider.syncAccount() → upsert posts + snapshots
 *     → bump connection_status + last_synced_at
 *
 * Provider routing is per-account: rows flagged `is_mock=true` always sync
 * via the stub (even if real OAuth creds are present), and real OAuth rows
 * sync via the real provider. This lets you preview demo data without
 * disconnecting a real account.
 */
export class AnalyticsService {
  constructor(
    private readonly providers: Record<AnalyticsPlatform, ProviderPair>,
  ) {}

  /** Returns the provider that *would* be used for a brand-new connection. */
  realProviderFor(platform: AnalyticsPlatform): AnalyticsProvider {
    return this.providers[platform].real;
  }

  /** Whether the platform has real OAuth wired and credentials in place. */
  canConnectReal(platform: AnalyticsPlatform): boolean {
    return this.providers[platform].real.canConnect;
  }

  async syncAndPersist(account: ConnectedAccountRow): Promise<{
    postCount: number;
    snapshotCount: number;
    syncedAt: string;
  }> {
    const pair = this.providers[account.platform];
    const provider = account.is_mock ? pair.stub : pair.real;
    const admin = createAdminClient();

    await admin
      .from("connected_accounts")
      .update({ connection_status: "syncing" })
      .eq("id", account.id);

    let result: SyncResult;
    try {
      result = await provider.syncAccount(account);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed.";
      await admin
        .from("connected_accounts")
        .update({
          connection_status: "needs_reauth",
          last_sync_error: msg,
        })
        .eq("id", account.id);
      throw e;
    }

    // Refresh account-identity fields if the provider gave us new info.
    await admin
      .from("connected_accounts")
      .update({
        platform_user_id: result.account.platform_user_id,
        username: result.account.username,
        display_name: result.account.display_name,
        avatar_url: result.account.avatar_url,
      })
      .eq("id", account.id);

    // Upsert posts. Returns ids so we can attach metrics.
    const postRows = result.posts.map((p) => ({
      user_id: account.user_id,
      connected_account_id: account.id,
      platform: account.platform,
      platform_post_id: p.platform_post_id,
      url: p.url,
      thumbnail_url: p.thumbnail_url,
      caption: p.caption,
      media_type: p.media_type,
      posted_at: p.posted_at,
      duration_seconds: p.duration_seconds,
      format_tag: p.format_tag,
      pillar_tag: p.pillar_tag,
      topic_tags: p.topic_tags,
      hook_strength: p.hook_strength,
    }));

    const { data: upserted, error: upErr } = await admin
      .from("creator_posts")
      .upsert(postRows, { onConflict: "connected_account_id,platform_post_id" })
      .select("id, platform_post_id");

    if (upErr) {
      await admin
        .from("connected_accounts")
        .update({
          connection_status: "needs_reauth",
          last_sync_error: upErr.message,
        })
        .eq("id", account.id);
      throw new Error(upErr.message);
    }

    const idByPlatformPostId = new Map<string, string>(
      (upserted ?? []).map((r) => [r.platform_post_id as string, r.id as string]),
    );

    const metricRows = result.metrics
      .map((m) => {
        const creatorPostId = idByPlatformPostId.get(m.platform_post_id);
        if (!creatorPostId) return null;
        return {
          user_id: account.user_id,
          creator_post_id: creatorPostId,
          captured_at: m.captured_at,
          views: m.views,
          reach: m.reach,
          impressions: m.impressions,
          likes: m.likes,
          comments: m.comments,
          shares: m.shares,
          saves: m.saves,
          follows: m.follows,
          profile_visits: m.profile_visits,
          average_watch_time: m.average_watch_time,
          completion_rate: m.completion_rate,
          engagement_rate: m.engagement_rate,
          share_rate: m.share_rate,
          save_rate: m.save_rate,
          source: m.source,
          confidence: m.confidence,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (metricRows.length > 0) {
      // Replace-the-current-snapshot semantics: nuke prior snapshots for these
      // posts and insert one fresh row each. (We're not yet storing time
      // series — just the latest — but the schema is ready when we are.)
      const postIds = metricRows.map((r) => r.creator_post_id);
      await admin.from("post_metric_snapshots").delete().in("creator_post_id", postIds);
      const { error: insErr } = await admin
        .from("post_metric_snapshots")
        .insert(metricRows);
      if (insErr) throw new Error(insErr.message);
    }

    const syncedAt = new Date().toISOString();
    await admin
      .from("connected_accounts")
      .update({
        connection_status: "connected",
        last_synced_at: syncedAt,
        last_sync_error: null,
      })
      .eq("id", account.id);

    return {
      postCount: result.posts.length,
      snapshotCount: metricRows.length,
      syncedAt,
    };
  }
}

function instagramReal(): AnalyticsProvider {
  if (serverEnv.metaAppId && serverEnv.metaAppSecret) {
    return new MetaInstagramProvider();
  }
  return new StubInstagramProvider();
}

function tiktokReal(): AnalyticsProvider {
  if (serverEnv.tiktokClientKey && serverEnv.tiktokClientSecret) {
    return new TikTokDisplayProvider();
  }
  return new StubTikTokProvider();
}

export function getAnalyticsService(): AnalyticsService {
  if (!cached) {
    cached = new AnalyticsService({
      instagram: { real: instagramReal(), stub: new StubInstagramProvider() },
      tiktok: { real: tiktokReal(), stub: new StubTikTokProvider() },
    });
  }
  return cached;
}

/** Whether we're currently serving mock data (for UI labelling). */
export function isMockAnalyticsMode(): boolean {
  return serverEnv.analyticsMockMode;
}
