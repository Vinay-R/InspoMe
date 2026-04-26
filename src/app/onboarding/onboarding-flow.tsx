"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipPicker } from "@/components/ui/chip-picker";
import { cn } from "@/lib/utils";
import {
  PREFERRED_CONTENT_OPTIONS,
  NICHE_OPTIONS,
  CREATOR_CATEGORY_OPTIONS,
  CONTENT_GOALS_OPTIONS,
  PILLARS_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  TONE_OPTIONS,
} from "@/lib/onboarding-options";

type StepKey =
  | "formats"
  | "niche"
  | "category"
  | "goals"
  | "pillars"
  | "experience"
  | "tone";

interface State {
  preferred_content: string[];
  niche: string[];
  creator_category: string;
  creator_category_custom: string;
  content_goals: string[];
  pillars: string[];
  experience_level: string;
  tone: string[];
}

const INITIAL: State = {
  preferred_content: [],
  niche: [],
  creator_category: "",
  creator_category_custom: "",
  content_goals: [],
  pillars: [],
  experience_level: "",
  tone: [],
};

const STEPS: ReadonlyArray<{
  key: StepKey;
  title: string;
  subtitle: string;
  prompt: string;
  helper?: string;
  skippable?: boolean;
}> = [
  {
    key: "formats",
    title: "Your style",
    subtitle: "Step 1 of 7",
    prompt: "What type of content do you prefer making?",
    helper: "Pick up to 2. We'll analyze inspo through your style.",
  },
  {
    key: "niche",
    title: "Your niche",
    subtitle: "Step 2 of 7",
    prompt: "How would you describe your content?",
    helper: "Choose any that fit. Add your own if we missed it.",
  },
  {
    key: "category",
    title: "About you",
    subtitle: "Step 3 of 7",
    prompt: "How would you best describe yourself?",
    helper: "We'll frame insights to match.",
  },
  {
    key: "goals",
    title: "Your goals",
    subtitle: "Step 4 of 7",
    prompt: "What are your content goals?",
    helper: "We'll highlight content patterns that match your goals.",
  },
  {
    key: "pillars",
    title: "Your content pillars",
    subtitle: "Step 5 of 7",
    prompt: "What are your content pillars?",
    helper: "The themes you keep coming back to.",
  },
  {
    key: "experience",
    title: "Your experience",
    subtitle: "Step 6 of 7",
    prompt: "How comfortable are you creating content?",
    helper: "We'll adjust how deep our analysis goes.",
  },
  {
    key: "tone",
    title: "Your vibe",
    subtitle: "Step 7 of 7",
    prompt: "What kind of vibe would you like your content to have?",
    helper: "Optional — you can skip and add this later.",
    skippable: true,
  },
];

export function OnboardingFlow() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [state, setState] = React.useState<State>(INITIAL);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showGoalToast, setShowGoalToast] = React.useState(false);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  const stepIsValid = (): boolean => {
    switch (step.key) {
      case "formats":
        return state.preferred_content.length > 0;
      case "niche":
        return state.niche.length > 0;
      case "category":
        if (!state.creator_category) return false;
        if (state.creator_category === "other") {
          return state.creator_category_custom.trim().length > 0;
        }
        return true;
      case "goals":
        return state.content_goals.length > 0;
      case "pillars":
        return state.pillars.length > 0;
      case "experience":
        return !!state.experience_level;
      case "tone":
        return true;
    }
  };

  const goNext = async () => {
    setError(null);

    if (step.key === "goals" && !showGoalToast) {
      setShowGoalToast(true);
      window.setTimeout(() => setShowGoalToast(false), 1800);
    }

    if (isLast) {
      await submit();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    setError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Couldn't save onboarding.");
      }
      router.replace("/library?welcome=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-4">
          <span className="inline-block size-6 rounded-md bg-brand" />
          <span className="font-semibold tracking-tight">InspoMe</span>
        </div>
        <div className="h-1 w-full bg-secondary">
          <div
            className="h-full bg-brand transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
          />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 md:py-12">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {step.subtitle}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {step.prompt}
          </h1>
          {step.helper && (
            <p className="text-sm text-muted-foreground">{step.helper}</p>
          )}
        </div>

        <div className="mt-8">
          <StepBody step={step.key} state={state} setState={setState} />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
          >
            {error}
          </p>
        )}

        <div className="mt-auto pt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={goBack}
              disabled={submitting}
              className="sm:w-auto"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <span className="hidden sm:block" aria-hidden />
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            {step.skippable && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={goNext}
                disabled={submitting}
              >
                Skip
              </Button>
            )}
            <Button
              type="button"
              variant="brand"
              size="lg"
              onClick={goNext}
              disabled={!stepIsValid() || submitting}
              loading={submitting}
              className="sm:w-auto"
            >
              {isLast ? "Finish" : "Continue"}
              {!isLast && <ArrowRight className="size-4" />}
              {isLast && <Check className="size-4" />}
            </Button>
          </div>
        </div>
      </div>

      <ToastBanner
        show={showGoalToast}
        message="Nice — we'll highlight content patterns that match your goals."
      />
    </main>
  );
}

function StepBody({
  step,
  state,
  setState,
}: {
  step: StepKey;
  state: State;
  setState: React.Dispatch<React.SetStateAction<State>>;
}) {
  switch (step) {
    case "formats":
      return (
        <ChipPicker
          options={PREFERRED_CONTENT_OPTIONS}
          values={state.preferred_content}
          onChange={(v) => setState((s) => ({ ...s, preferred_content: v }))}
          multi
          max={2}
          allowCustom
        />
      );
    case "niche":
      return (
        <ChipPicker
          options={NICHE_OPTIONS}
          values={state.niche}
          onChange={(v) => setState((s) => ({ ...s, niche: v }))}
          multi
          allowCustom
        />
      );
    case "category":
      return (
        <div className="flex flex-col gap-3">
          <ChipPicker
            options={CREATOR_CATEGORY_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            values={state.creator_category ? [state.creator_category] : []}
            onChange={(v) =>
              setState((s) => ({
                ...s,
                creator_category: v[0] ?? "",
                // clear custom text if they switched away from "other"
                creator_category_custom:
                  v[0] === "other" ? s.creator_category_custom : "",
              }))
            }
            multi={false}
            allowCustom={false}
          />
          {state.creator_category === "other" && (
            <input
              type="text"
              autoFocus
              maxLength={60}
              value={state.creator_category_custom}
              onChange={(e) =>
                setState((s) => ({ ...s, creator_category_custom: e.target.value }))
              }
              placeholder="Describe yourself in a few words"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
        </div>
      );
    case "goals":
      return (
        <ChipPicker
          options={CONTENT_GOALS_OPTIONS}
          values={state.content_goals}
          onChange={(v) => setState((s) => ({ ...s, content_goals: v }))}
          multi
          allowCustom
        />
      );
    case "pillars":
      return (
        <ChipPicker
          options={PILLARS_OPTIONS}
          values={state.pillars}
          onChange={(v) => setState((s) => ({ ...s, pillars: v }))}
          multi
          allowCustom
        />
      );
    case "experience":
      return (
        <ChipPicker
          options={EXPERIENCE_LEVEL_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          values={state.experience_level ? [state.experience_level] : []}
          onChange={(v) =>
            setState((s) => ({ ...s, experience_level: v[0] ?? "" }))
          }
          multi={false}
          allowCustom={false}
        />
      );
    case "tone":
      return (
        <ChipPicker
          options={TONE_OPTIONS}
          values={state.tone}
          onChange={(v) => setState((s) => ({ ...s, tone: v }))}
          multi
          allowCustom
        />
      );
  }
}

function ToastBanner({ show, message }: { show: boolean; message: string }) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-5 transition-all duration-300",
        show ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg">
        <Sparkles className="size-4" />
        {message}
      </div>
    </div>
  );
}
