import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings — InspoMe",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select(
      "preferred_content, niche, creator_category, creator_category_custom, content_goals, pillars, experience_level, tone",
    )
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/library"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to library
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-medium">Account</p>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-5">
          <p className="text-sm font-medium">Creator profile</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Used to personalize how Gemini frames each analysis for you.
          </p>
        </div>
        <SettingsForm
          profile={{
            preferred_content: profile?.preferred_content ?? [],
            niche: profile?.niche ?? [],
            creator_category: profile?.creator_category ?? null,
            creator_category_custom: profile?.creator_category_custom ?? null,
            content_goals: profile?.content_goals ?? [],
            pillars: profile?.pillars ?? [],
            experience_level: profile?.experience_level ?? null,
            tone: profile?.tone ?? [],
          }}
        />
      </section>
    </div>
  );
}
