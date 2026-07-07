import type { ConnectedAccountRow } from "@/lib/supabase/types";

export type AnalyticsPlatform = "instagram" | "tiktok";

export type NormalizedPost = {
  platform_post_id: string;
  url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  media_type: "video" | "image" | "carousel";
  posted_at: string; // ISO
  duration_seconds: number | null;
  format_tag: string | null;
  pillar_tag: string | null;
  topic_tags: string[];
  hook_strength: number | null;
};

export type NormalizedMetrics = {
  platform_post_id: string;
  captured_at: string; // ISO
  views: number | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  follows: number | null;
  profile_visits: number | null;
  average_watch_time: number | null;
  completion_rate: number | null;
  engagement_rate: number | null;
  share_rate: number | null;
  save_rate: number | null;
  source:
    | "official_api"
    | "permissioned_user_connection"
    | "research_api"
    | "embed_metadata"
    | "manual"
    | "unavailable";
  confidence: "high" | "medium" | "low" | "unknown";
};

export type SyncResult = {
  posts: NormalizedPost[];
  metrics: NormalizedMetrics[];
  account: {
    platform_user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export interface AnalyticsProvider {
  readonly name: string;
  readonly platform: AnalyticsPlatform;
  /**
   * Whether this provider can actually run a real OAuth flow + sync.
   * Stubs return true (they always "work"); real providers return true only
   * when their credentials are present.
   */
  readonly canConnect: boolean;
  /**
   * Pull or regenerate posts + metrics for the given connected account.
   * For stubs, this regenerates a deterministic synthetic dataset keyed on
   * the user id so repeated syncs are stable.
   */
  syncAccount(account: ConnectedAccountRow): Promise<SyncResult>;
}
