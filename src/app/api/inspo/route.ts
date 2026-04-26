import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseInspoUrl, isSupportedPlatform } from "@/lib/platform";
import { getIngestionService } from "@/server/ingestion/service";

const CreateSchema = z.object({
  url: z.string().min(1).max(2000),
  save_reasons: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
  note: z.string().max(280).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { url, save_reasons, note } = parsed.data;
  const u = parseInspoUrl(url);

  if (!isSupportedPlatform(u.platform)) {
    return NextResponse.json(
      {
        error:
          "Unsupported URL. We currently support TikTok and Instagram links.",
      },
      { status: 400 },
    );
  }

  // Save first — the spec invariant. Enrichment kicks off after.
  const { data: inspo, error } = await supabase
    .from("inspo")
    .insert({
      user_id: user.id,
      url_original: url,
      url_canonical: u.canonical,
      platform: u.platform,
      platform_content_id: u.contentId,
      creator_handle: u.creatorHandle,
      deep_link_url: u.canonical ?? url,
      save_reasons,
      note: note ?? null,
      analysis_status: "queued",
      media_status: "queued",
    })
    .select("id, platform, created_at, analysis_status")
    .single();

  if (error || !inspo) {
    return NextResponse.json(
      { error: error?.message ?? "Could not save inspo." },
      { status: 500 },
    );
  }

  try {
    await getIngestionService().enqueue({
      inspoId: inspo.id,
      userId: user.id,
      url,
      platform: u.platform,
    });
  } catch (e) {
    console.error("[api/inspo] enqueue failed", e);
    // Non-fatal — inspo is still saved. User can retry from the detail page.
  }

  return NextResponse.json({
    success: true,
    data: {
      inspo_id: inspo.id,
      platform: inspo.platform,
      created_at: inspo.created_at,
      analysis_status: inspo.analysis_status,
    },
  });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const platform = url.searchParams.get("platform");
  const analysisStatus = url.searchParams.get("analysis_status");
  const search = url.searchParams.get("search")?.trim();

  let query = supabase
    .from("inspo")
    .select(
      "id, platform, url_original, url_canonical, deep_link_url, creator_handle, caption, thumbnail_url, save_reasons, analysis_status, media_status, metrics_status, created_at, last_analyzed_at",
    )
    .eq("user_id", user.id)
    .eq("user_hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (platform) query = query.eq("platform", platform);
  if (analysisStatus) query = query.eq("analysis_status", analysisStatus);
  if (search) {
    const term = `%${search.replace(/[%_]/g, "\\$&")}%`;
    query = query.or(`caption.ilike.${term},creator_handle.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
