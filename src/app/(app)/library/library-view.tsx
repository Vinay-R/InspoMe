"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Sparkles,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChipPicker } from "@/components/ui/chip-picker";
import { SAVE_REASONS } from "@/components/inspo/save-reasons";
import { parseInspoUrl, isSupportedPlatform, platformLabel } from "@/lib/platform";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { AnalysisStatus, MetricsStatus, Platform } from "@/lib/supabase/types";

type InspoCard = {
  id: string;
  platform: Platform;
  url_original: string;
  url_canonical: string | null;
  deep_link_url: string;
  creator_handle: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  save_reasons: string[];
  analysis_status: AnalysisStatus;
  media_status: string;
  metrics_status: MetricsStatus;
  created_at: string;
  last_analyzed_at: string | null;
};

interface Props {
  initialInspo: InspoCard[];
  welcome: boolean;
}

export function LibraryView({ initialInspo, welcome }: Props) {
  const router = useRouter();
  const [inspo, setInspo] = React.useState<InspoCard[]>(initialInspo);
  const [showAdd, setShowAdd] = React.useState(initialInspo.length === 0 && welcome);
  const [showWelcome, setShowWelcome] = React.useState(welcome);

  // Poll while any card is mid-enrichment so the user sees progressive updates
  // without having to refresh.
  React.useEffect(() => {
    const hasPending = inspo.some(
      (i) =>
        i.analysis_status === "queued" || i.analysis_status === "processing",
    );
    if (!hasPending) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/inspo", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json.data)) setInspo(json.data);
      } catch {
        // keep last good state
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [inspo]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      {showWelcome && (
        <WelcomeBanner onDismiss={() => setShowWelcome(false)} />
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Your Inspo
          </h1>
          <p className="text-sm text-muted-foreground">
            {inspo.length === 0
              ? "Save TikTok and Instagram links to start your library."
              : `${inspo.length} saved · understand why each one works`}
          </p>
        </div>
        {!showAdd && (
          <Button
            variant="brand"
            size="lg"
            onClick={() => setShowAdd(true)}
            className="shrink-0"
          >
            <Plus className="size-4" />
            Add inspo
          </Button>
        )}
      </div>

      {showAdd && (
        <AddInspoPanel
          onClose={() => setShowAdd(false)}
          onSaved={(card) => {
            setInspo((prev) => [card, ...prev]);
            setShowAdd(false);
            router.push(`/inspo/${card.id}`);
          }}
        />
      )}

      {inspo.length === 0 && !showAdd ? (
        <EmptyState onClickAdd={() => setShowAdd(true)} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {inspo.map((i) => (
            <InspoCardItem key={i.id} inspo={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

function WelcomeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative rounded-xl border border-brand/20 bg-brand/5 p-4 pr-10">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          <Sparkles className="size-5" />
        </div>
        <div>
          <p className="font-medium">Welcome to InspoMe</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Paste a TikTok or Instagram link below. We&apos;ll break down the hook,
            structure, visuals, and the reusable pattern behind it.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onClickAdd }: { onClickAdd: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
        <Sparkles className="size-6" />
      </div>
      <div className="max-w-xs">
        <p className="font-medium">No inspo yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Save a TikTok or Instagram link to start building your content
          inspo library.
        </p>
      </div>
      <Button variant="brand" size="lg" onClick={onClickAdd}>
        <Plus className="size-4" />
        Add your first inspo
      </Button>
    </div>
  );
}

function AddInspoPanel({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (card: InspoCard) => void;
}) {
  const [url, setUrl] = React.useState("");
  const [reasons, setReasons] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parsed = url.trim() ? parseInspoUrl(url.trim()) : null;
  const supportable = parsed ? isSupportedPlatform(parsed.platform) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!url.trim()) return;
    if (parsed && !isSupportedPlatform(parsed.platform)) {
      setError("Only TikTok and Instagram links are supported right now.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/inspo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          save_reasons: reasons,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Couldn't save your inspo.");
      }
      // The detail-page fetch will load all the missing fields. The card
      // shown locally just needs enough to render placeholder.
      onSaved({
        id: json.data.inspo_id,
        platform: json.data.platform,
        url_original: url.trim(),
        url_canonical: parsed?.canonical ?? null,
        deep_link_url: parsed?.canonical ?? url.trim(),
        creator_handle: parsed?.creatorHandle ?? null,
        caption: null,
        thumbnail_url: null,
        save_reasons: reasons,
        analysis_status: json.data.analysis_status,
        media_status: "queued",
        metrics_status: "not_started",
        created_at: json.data.created_at,
        last_analyzed_at: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="font-medium">Add inspo</p>
          <p className="text-xs text-muted-foreground">
            Paste a TikTok or Instagram link.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Input
            type="url"
            inputMode="url"
            autoFocus
            placeholder="https://www.tiktok.com/@creator/video/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={supportable === false}
          />
          {parsed && (
            <p
              className={cn(
                "text-xs",
                supportable === false
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {supportable === false
                ? "We only support TikTok and Instagram for now."
                : `Detected: ${platformLabel(parsed.platform)}`}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Why did you save this? <span className="font-normal text-muted-foreground">Optional</span></p>
          <ChipPicker
            options={SAVE_REASONS}
            values={reasons}
            onChange={setReasons}
            multi
            allowCustom={false}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="brand"
            disabled={!url.trim() || supportable === false}
            loading={submitting}
          >
            Save inspo
          </Button>
        </div>
      </form>
    </div>
  );
}

function InspoCardItem({ inspo }: { inspo: InspoCard }) {
  return (
    <li>
      <Link
        href={`/inspo/${inspo.id}`}
        className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30"
      >
        <div className="relative aspect-[9/12] w-full overflow-hidden bg-secondary">
          {inspo.thumbnail_url ? (
            <img
              src={inspo.thumbnail_url}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <span className="text-xs">No thumbnail yet</span>
            </div>
          )}
          <div className="absolute left-2 top-2 flex items-center gap-1.5">
            <Badge variant="secondary" className="bg-background/85 backdrop-blur">
              {platformLabel(inspo.platform)}
            </Badge>
          </div>
          <div className="absolute right-2 top-2">
            <AnalysisStatusBadge status={inspo.analysis_status} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {inspo.creator_handle ? `@${inspo.creator_handle}` : "Unknown creator"}
            </span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{formatRelativeTime(inspo.created_at)}</span>
          </div>
          <p className="text-sm line-clamp-2 min-h-[2.5em]">
            {inspo.caption || (
              <span className="text-muted-foreground italic">
                Caption pending…
              </span>
            )}
          </p>
          {inspo.save_reasons.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {inspo.save_reasons.slice(0, 3).map((r) => (
                <Badge key={r} variant="outline" className="text-[10px] py-0">
                  {r}
                </Badge>
              ))}
              {inspo.save_reasons.length > 3 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{inspo.save_reasons.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  if (status === "complete") {
    return (
      <Badge variant="success" className="bg-emerald-500/15 backdrop-blur">
        <CheckCircle2 className="size-3" />
        Analyzed
      </Badge>
    );
  }
  if (status === "queued" || status === "processing") {
    return (
      <Badge variant="secondary" className="bg-background/85 backdrop-blur">
        <Loader2 className="size-3 animate-spin" />
        Analyzing…
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="danger" className="bg-destructive/15 backdrop-blur">
        <AlertTriangle className="size-3" />
        Retry
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="warning" className="bg-amber-500/15 backdrop-blur">
        Partial
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-background/85 backdrop-blur">
      <ExternalLink className="size-3" />
      Saved
    </Badge>
  );
}
