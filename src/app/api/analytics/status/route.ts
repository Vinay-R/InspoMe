import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-errors";

/**
 * Minimal polling endpoint — returns the user's connected accounts (RLS
 * scopes the read) so the UI can stop showing "Syncing…" once the row flips
 * back to `connected`.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("unauthorized");

  const { data, error } = await supabase
    .from("connected_accounts")
    .select(
      "id, platform, username, display_name, avatar_url, connection_status, is_mock, last_synced_at, last_sync_error",
    )
    .order("platform");

  if (error) return apiError("internal", { cause: error });
  return NextResponse.json({ success: true, data: data ?? [] });
}
