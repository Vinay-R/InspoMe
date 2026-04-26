import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

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
    .select("*")
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
        <p className="text-sm font-medium">Your creator profile</p>
        <dl className="mt-3 grid grid-cols-1 gap-y-3 text-sm">
          <ProfileRow label="Category" value={profile?.creator_category ?? "—"} />
          <ProfileRow label="Niche" value={(profile?.niche ?? []).join(", ") || "—"} />
          <ProfileRow label="Goals" value={(profile?.content_goals ?? []).join(", ") || "—"} />
          <ProfileRow label="Pillars" value={(profile?.pillars ?? []).join(", ") || "—"} />
          <ProfileRow label="Formats" value={(profile?.preferred_content ?? []).join(", ") || "—"} />
          <ProfileRow label="Experience" value={profile?.experience_level ?? "—"} />
          <ProfileRow label="Tone" value={(profile?.tone ?? []).join(", ") || "—"} />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Editing onboarding fields is coming next — for now this is a snapshot of
          what we use to personalize Gemini analysis.
        </p>
      </section>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{value}</dd>
    </div>
  );
}
