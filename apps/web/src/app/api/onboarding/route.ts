import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-errors";

const Schema = z.object({
  preferred_content: z.array(z.string().min(1).max(80)).max(8),
  niche: z.array(z.string().min(1).max(80)).max(20),
  creator_category: z.enum([
    "business_brand",
    "creator_personal_brand",
    "artist_musician",
    "other",
    "",
  ]),
  creator_category_custom: z.string().max(80).optional().default(""),
  content_goals: z.array(z.string().min(1).max(80)).max(20),
  pillars: z.array(z.string().min(1).max(80)).max(20),
  experience_level: z.enum(["beginner", "intermediate", "advanced", ""]),
  tone: z.array(z.string().min(1).max(80)).max(20),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError("unauthorized");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_input");
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_input", {
      devDetail: { issues: parsed.error.flatten() },
    });
  }
  const v = parsed.data;

  // Only formats + niche are required; category, goals, pillars, experience,
  // and tone are skippable and save as empty/null.
  if (v.preferred_content.length === 0 || v.niche.length === 0) {
    return apiError("invalid_input");
  }

  // "other" without a description counts as skipped, not invalid.
  const creatorCategory =
    v.creator_category === "other" &&
    v.creator_category_custom.trim().length === 0
      ? ""
      : v.creator_category;

  const { error } = await supabase
    .from("users")
    .update({
      preferred_content: v.preferred_content,
      niche: v.niche,
      // Postgres enum columns reject "" — skipped selections persist as null.
      creator_category: creatorCategory || null,
      creator_category_custom:
        creatorCategory === "other" ? v.creator_category_custom.trim() : null,
      content_goals: v.content_goals,
      pillars: v.pillars,
      experience_level: v.experience_level || null,
      tone: v.tone,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return apiError("internal", { cause: error });

  return NextResponse.json({ success: true });
}
