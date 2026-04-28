"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipPicker } from "@/components/ui/chip-picker";
import {
  PREFERRED_CONTENT_OPTIONS,
  NICHE_OPTIONS,
  CREATOR_CATEGORY_OPTIONS,
  CONTENT_GOALS_OPTIONS,
  PILLARS_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  TONE_OPTIONS,
} from "@/lib/onboarding-options";

interface Profile {
  preferred_content: string[];
  niche: string[];
  creator_category: string | null;
  creator_category_custom: string | null;
  content_goals: string[];
  pillars: string[];
  experience_level: string | null;
  tone: string[];
}

interface Props {
  profile: Profile;
}

export function SettingsForm({ profile }: Props) {
  const [preferred_content, setPreferredContent] = React.useState<string[]>(
    profile.preferred_content ?? [],
  );
  const [niche, setNiche] = React.useState<string[]>(profile.niche ?? []);
  const [creator_category, setCreatorCategory] = React.useState<string>(
    profile.creator_category ?? "",
  );
  const [creator_category_custom, setCreatorCategoryCustom] =
    React.useState<string>(profile.creator_category_custom ?? "");
  const [content_goals, setContentGoals] = React.useState<string[]>(
    profile.content_goals ?? [],
  );
  const [pillars, setPillars] = React.useState<string[]>(profile.pillars ?? []);
  const [experience_level, setExperienceLevel] = React.useState<string>(
    profile.experience_level ?? "",
  );
  const [tone, setTone] = React.useState<string[]>(profile.tone ?? []);

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preferred_content,
          niche,
          creator_category,
          creator_category_custom,
          content_goals,
          pillars,
          experience_level,
          tone,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Couldn't save your profile.");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <Field
        label="Content formats"
        hint="What type of content do you prefer making? Pick up to 2."
      >
        <ChipPicker
          options={PREFERRED_CONTENT_OPTIONS}
          values={preferred_content}
          onChange={setPreferredContent}
          multi
          max={2}
          allowCustom
        />
      </Field>

      <Field label="Niche" hint="How would you describe your content?">
        <ChipPicker
          options={NICHE_OPTIONS}
          values={niche}
          onChange={setNiche}
          multi
          allowCustom
        />
      </Field>

      <Field label="Category" hint="How would you best describe yourself?">
        <ChipPicker
          options={CREATOR_CATEGORY_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          values={creator_category ? [creator_category] : []}
          onChange={(v) => {
            setCreatorCategory(v[0] ?? "");
            if (v[0] !== "other") setCreatorCategoryCustom("");
          }}
          multi={false}
          allowCustom={false}
        />
        {creator_category === "other" && (
          <input
            type="text"
            maxLength={60}
            value={creator_category_custom}
            onChange={(e) => setCreatorCategoryCustom(e.target.value)}
            placeholder="Describe yourself in a few words"
            className="mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </Field>

      <Field
        label="Content goals"
        hint="What are your content goals?"
      >
        <ChipPicker
          options={CONTENT_GOALS_OPTIONS}
          values={content_goals}
          onChange={setContentGoals}
          multi
          allowCustom
        />
      </Field>

      <Field
        label="Content pillars"
        hint="The themes you keep coming back to."
      >
        <ChipPicker
          options={PILLARS_OPTIONS}
          values={pillars}
          onChange={setPillars}
          multi
          allowCustom
        />
      </Field>

      <Field
        label="Experience level"
        hint="How comfortable are you creating content?"
      >
        <ChipPicker
          options={EXPERIENCE_LEVEL_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          values={experience_level ? [experience_level] : []}
          onChange={(v) => setExperienceLevel(v[0] ?? "")}
          multi={false}
          allowCustom={false}
        />
      </Field>

      <Field label="Vibe / Tone" hint="What kind of vibe do you want your content to have?">
        <ChipPicker
          options={TONE_OPTIONS}
          values={tone}
          onChange={setTone}
          multi
          allowCustom
        />
      </Field>

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="brand" loading={saving}>
          Save changes
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="size-4" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
