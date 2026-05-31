import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsView } from "./analytics-view";
import type {
  ConnectedAccountRow,
  CreatorPostRow,
  PostMetricSnapshotRow,
  AnalyticsInsightRow,
} from "@/lib/supabase/types";

const ALLOWED_WINDOWS = [7, 30, 90] as const;
type Window = (typeof ALLOWED_WINDOWS)[number];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const winRaw = Number(params.window);
  const window: Window = (ALLOWED_WINDOWS as readonly number[]).includes(winRaw)
    ? (winRaw as Window)
    : 30;

  // RLS-scoped reads: each query is restricted to the current user.
  const [accountsRes, postsRes, snapshotsRes, insightsRes] = await Promise.all([
    supabase
      .from("connected_accounts")
      .select(
        "id, user_id, platform, platform_user_id, username, display_name, avatar_url, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, connection_status, is_mock, last_synced_at, last_sync_error, created_at, updated_at",
      )
      .order("platform"),
    supabase
      .from("creator_posts")
      .select(
        "id, user_id, connected_account_id, platform, platform_post_id, url, thumbnail_url, caption, media_type, posted_at, duration_seconds, format_tag, pillar_tag, topic_tags, hook_strength, created_at, updated_at",
      )
      .order("posted_at", { ascending: false })
      .limit(500),
    supabase
      .from("post_metric_snapshots")
      .select(
        "id, user_id, creator_post_id, captured_at, views, reach, impressions, likes, comments, shares, saves, follows, profile_visits, average_watch_time, completion_rate, engagement_rate, share_rate, save_rate, raw_metrics, source, confidence, created_at",
      )
      .order("captured_at", { ascending: false }),
    supabase
      .from("analytics_insights")
      .select(
        "id, user_id, insight_type, title, observation, explanation, recommended_action, confidence, related_post_ids, time_window_days, generated_at, expires_at, created_at",
      )
      .eq("time_window_days", window)
      .order("generated_at", { ascending: false }),
  ]);

  return (
    <AnalyticsView
      window={window}
      accounts={(accountsRes.data ?? []) as ConnectedAccountRow[]}
      posts={(postsRes.data ?? []) as CreatorPostRow[]}
      snapshots={(snapshotsRes.data ?? []) as PostMetricSnapshotRow[]}
      insights={(insightsRes.data ?? []) as AnalyticsInsightRow[]}
    />
  );
}
