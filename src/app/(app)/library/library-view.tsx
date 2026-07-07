"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  Sparkles,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
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

export type InspoCard = {
  id: string;
  platform: Platform;
  url_original: string;
  url_canonical: string | null;
  deep_link_url: string;
  creator_handle: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  save_reasons: string[];
  /** Flattened video_analysis tags — empty until analysis completes. */
  tags: string[];
  analysis_status: AnalysisStatus;
  media_status: string;
  metrics_status: MetricsStatus;
  created_at: string;
  last_analyzed_at: string | null;
};

interface Props {
  initialInspo: InspoCard[];
  initialNextCursor: string | null;
  welcome: boolean;
}

const POLL_FAST_MS = 2500;
const POLL_SLOW_MS = 10_000;
const POLL_SLOW_AFTER_MS = 90_000;
const POLL_STOP_AFTER_MS = 10 * 60_000;

type PollPhase = "fast" | "slow" | "stopped";

const LOAD_MORE_PAGE_SIZE = 30;

// Stable no-op subscribe for useSyncExternalStore-based hydration detection.
const subscribeNoop = () => () => {};

// Newest-first merge: `fresh` is the head of the list (a poll of the first
// page); keep any older rows we already loaded past it, deduped by id.
function mergeById(fresh: InspoCard[], prev: InspoCard[]): InspoCard[] {
  const freshIds = new Set(fresh.map((i) => i.id));
  return [...fresh, ...prev.filter((i) => !freshIds.has(i.id))];
}

export function LibraryView({ initialInspo, initialNextCursor, welcome }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPlatform = searchParams.get("platform") ?? "";

  // ?add=<url> comes from the /save share-target redirect. Consume it once
  // (lazy initializer, so a later router.replace can't re-trigger it) and
  // open the Add panel prefilled.
  const [addPrefill] = React.useState<string | null>(() =>
    searchParams.get("add"),
  );

  const [inspo, setInspo] = React.useState<InspoCard[]>(initialInspo);
  const [showAdd, setShowAdd] = React.useState(
    (initialInspo.length === 0 && welcome) || Boolean(addPrefill),
  );
  const [showWelcome, setShowWelcome] = React.useState(welcome);
  const [searchInput, setSearchInput] = React.useState("");
  const [activeReasons, setActiveReasons] = React.useState<string[]>([]);
  const [activeTags, setActiveTags] = React.useState<string[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(
    initialNextCursor,
  );
  const [loadingMore, setLoadingMore] = React.useState(false);

  // Strip the consumed ?add= param from the URL (welcome=1 is left in place
  // by the existing flow, but a stale add= would re-open the panel on reload).
  React.useEffect(() => {
    if (searchParams.get("add") === null) return;
    const params = new URLSearchParams(searchParams);
    params.delete("add");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [searchParams, router]);

  function setPlatform(p: string) {
    const params = new URLSearchParams();
    if (p) params.set("platform", p);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  function clearFilters() {
    setSearchInput("");
    setActiveReasons([]);
    setActiveTags([]);
    router.replace("?", { scroll: false });
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (currentPlatform) params.set("platform", currentPlatform);
      params.set("cursor", nextCursor);
      params.set("limit", String(LOAD_MORE_PAGE_SIZE));
      const res = await fetch(`/api/inspo?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!Array.isArray(json.data)) return;
      const page = json.data as InspoCard[];
      // Poll updates and load-more can overlap — dedupe appended rows by id.
      setInspo((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.filter((i) => !seen.has(i.id))];
      });
      setNextCursor(
        typeof json.next_cursor === "string" ? json.next_cursor : null,
      );
    } catch {
      // keep last good state; the button stays available for another try
    } finally {
      setLoadingMore(false);
    }
  }

  const [pollPhase, setPollPhase] = React.useState<PollPhase>("fast");
  const pollingSinceRef = React.useRef<number | null>(null);

  // Poll while any card is mid-enrichment so the user sees progressive updates.
  // After 90s of continuous pending we back off to a slow interval; after
  // 10 minutes we stop entirely (the server-side reaper will have failed the
  // job by then — a manual refresh picks that up).
  React.useEffect(() => {
    const hasPending = inspo.some(
      (i) => i.analysis_status === "queued" || i.analysis_status === "processing",
    );
    if (!hasPending) {
      pollingSinceRef.current = null;
      return;
    }
    if (pollPhase === "stopped") return;
    if (pollingSinceRef.current === null) {
      pollingSinceRef.current = Date.now();
    }
    const startedAt = pollingSinceRef.current;
    const interval = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= POLL_STOP_AFTER_MS) {
        setPollPhase("stopped");
        return;
      }
      if (elapsed >= POLL_SLOW_AFTER_MS) {
        setPollPhase((p) => (p === "fast" ? "slow" : p));
      }
      try {
        const params = new URLSearchParams();
        if (currentPlatform) params.set("platform", currentPlatform);
        const qs = params.toString();
        const res = await fetch(qs ? `/api/inspo?${qs}` : "/api/inspo", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        // The poll returns the newest page only — merge (not replace) so
        // rows fetched via "Load more" survive the refresh.
        if (Array.isArray(json.data)) {
          setInspo((prev) => mergeById(json.data as InspoCard[], prev));
        }
      } catch {
        // keep last good state
      }
    }, pollPhase === "slow" ? POLL_SLOW_MS : POLL_FAST_MS);
    return () => clearInterval(interval);
  }, [inspo, currentPlatform, pollPhase]);

  // Distinct tag vocabulary across loaded items, for the filter chips.
  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const i of inspo) {
      for (const t of i.tags ?? []) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [inspo]);

  // All filtering is client-side: instant text match + reason/tag
  // intersection. Note: search and filters only cover rows loaded so far —
  // items beyond the current cursor won't match until "Load more" pulls them.
  const term = searchInput.trim().toLowerCase();
  const filteredInspo = inspo.filter((i) => {
    if (term) {
      const inCaption = i.caption?.toLowerCase().includes(term) ?? false;
      const inHandle = i.creator_handle?.toLowerCase().includes(term) ?? false;
      if (!inCaption && !inHandle) return false;
    }
    if (activeReasons.length > 0) {
      if (!activeReasons.every((r) => i.save_reasons.includes(r))) return false;
    }
    if (activeTags.length > 0) {
      if (!activeTags.every((t) => (i.tags ?? []).includes(t))) return false;
    }
    return true;
  });

  const isFiltering =
    searchInput !== "" ||
    currentPlatform !== "" ||
    activeReasons.length > 0 ||
    activeTags.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-5">
      {showWelcome && <WelcomeBanner onDismiss={() => setShowWelcome(false)} />}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="h-page">Your Inspo</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {inspo.length === 0 && !isFiltering
              ? "Save TikTok and Instagram links to start your library."
              : isFiltering
                ? `${filteredInspo.length} result${filteredInspo.length !== 1 ? "s" : ""}`
                : `${inspo.length} saved · understand why each one works`}
          </p>
        </div>
        {!showAdd && (
          <Button
            variant="brand"
            onClick={() => setShowAdd(true)}
            className="shrink-0"
          >
            <Plus className="size-4" />
            Add
          </Button>
        )}
      </div>

      {showAdd && (
        <AddInspoPanel
          initialUrl={addPrefill}
          onClose={() => setShowAdd(false)}
          onSaved={(card) => {
            setInspo((prev) => [card, ...prev]);
            // New pending item — restart the polling clock from scratch.
            pollingSinceRef.current = null;
            setPollPhase("fast");
            setShowAdd(false);
            router.push(`/inspo/${card.id}`);
          }}
          onDuplicate={(id) => {
            // URL was already saved — just go to the existing item.
            setShowAdd(false);
            router.push(`/inspo/${id}`);
          }}
        />
      )}

      {/* Filter bar — only show when library has content or filters are active */}
      {(inspo.length > 0 || isFiltering) && (
        <FilterBar
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          currentPlatform={currentPlatform}
          onPlatformChange={setPlatform}
          activeReasons={activeReasons}
          onReasonsChange={setActiveReasons}
          allTags={allTags}
          activeTags={activeTags}
          onTagsChange={setActiveTags}
          isFiltering={isFiltering}
          onClear={clearFilters}
        />
      )}

      {filteredInspo.length === 0 && !showAdd ? (
        isFiltering ? (
          <FilterEmptyState onClear={clearFilters} />
        ) : (
          <EmptyState onClickAdd={() => setShowAdd(true)} />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filteredInspo.map((i) => (
            <InspoCardItem key={i.id} inspo={i} />
          ))}
        </ul>
      )}

      {nextCursor && inspo.length > 0 && (
        <div className="flex justify-center pt-1">
          <Button variant="outline" onClick={loadMore} loading={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

interface FilterBarProps {
  searchInput: string;
  onSearchChange: (v: string) => void;
  currentPlatform: string;
  onPlatformChange: (p: string) => void;
  activeReasons: string[];
  onReasonsChange: (r: string[]) => void;
  allTags: string[];
  activeTags: string[];
  onTagsChange: (t: string[]) => void;
  isFiltering: boolean;
  onClear: () => void;
}

function FilterBar({
  searchInput,
  onSearchChange,
  currentPlatform,
  onPlatformChange,
  activeReasons,
  onReasonsChange,
  allTags,
  activeTags,
  onTagsChange,
  isFiltering,
  onClear,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Search + platform row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by caption or creator…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["", "tiktok", "instagram"] as const).map((p) => (
            <button
              key={p || "all"}
              type="button"
              onClick={() => onPlatformChange(p)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                currentPlatform === p
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {p === "" ? "All" : platformLabel(p)}
            </button>
          ))}
          {isFiltering && (
            <button
              type="button"
              onClick={onClear}
              className="ml-1 flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <X className="size-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Save reason chips */}
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">Filter by reason</p>
        <ChipPicker
          options={[...SAVE_REASONS]}
          values={activeReasons}
          onChange={onReasonsChange}
          multi
          allowCustom={false}
        />
      </div>

      {/* AI tag chips — vocabulary comes from the loaded items' analyses */}
      {allTags.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">Filter by tag</p>
          <ChipPicker
            options={allTags}
            values={activeTags}
            onChange={onTagsChange}
            multi
            allowCustom={false}
          />
        </div>
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
          Save a TikTok or Instagram link to start building your content inspo library.
        </p>
      </div>
      <Button variant="brand" size="lg" onClick={onClickAdd}>
        <Plus className="size-4" />
        Add your first inspo
      </Button>
    </div>
  );
}

function FilterEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Search className="size-6" />
      </div>
      <div className="max-w-xs">
        <p className="font-medium">No results</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No inspo matches your current filters. Try adjusting or clearing them.
        </p>
      </div>
      <Button variant="outline" onClick={onClear}>
        <X className="size-4" />
        Clear filters
      </Button>
    </div>
  );
}

function AddInspoPanel({
  initialUrl,
  onClose,
  onSaved,
  onDuplicate,
}: {
  initialUrl?: string | null;
  onClose: () => void;
  onSaved: (card: InspoCard) => void;
  onDuplicate: (id: string) => void;
}) {
  const [url, setUrl] = React.useState(initialUrl ?? "");
  const [reasons, setReasons] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [clipboardHint, setClipboardHint] = React.useState<string | null>(null);

  // SSR renders "unsupported" and the real value takes over post-hydration —
  // the no-effect-safe way to feature-detect a browser-only API.
  const hydrated = React.useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
  const clipboardReadable =
    hydrated &&
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.readText === "function";

  const parsed = url.trim() ? parseInspoUrl(url.trim()) : null;
  const supportable = parsed ? isSupportedPlatform(parsed.platform) : null;

  async function pasteFromClipboard() {
    setClipboardHint(null);
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        // Setting the input runs the URL detection above on re-render.
        setUrl(text);
      } else {
        setClipboardHint("Clipboard is empty — paste manually.");
      }
    } catch {
      // NotAllowedError (permission denied) or unsupported context.
      setClipboardHint("Paste manually.");
    }
  }

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
        body: JSON.stringify({ url: url.trim(), save_reasons: reasons }),
      });
      const json = await res.json();
      // Already saved before — the API returns `duplicate: true` with the
      // existing inspo id. Navigate there instead of adding a second card.
      if (res.ok && (json?.duplicate === true || json?.data?.duplicate === true)) {
        const existingId =
          json?.data?.inspo_id ?? json?.data?.id ?? json?.inspo_id ?? json?.id;
        if (typeof existingId === "string" && existingId) {
          onDuplicate(existingId);
          return;
        }
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Couldn't save your inspo.");
      }
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
        tags: [],
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
          <p className="text-xs text-muted-foreground">Paste a TikTok or Instagram link.</p>
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
          <div className="flex items-center gap-2">
            <Input
              type="url"
              inputMode="url"
              autoFocus
              placeholder="https://www.tiktok.com/@creator/video/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={supportable === false}
              className="flex-1"
            />
            {clipboardReadable && (
              <Button
                type="button"
                variant="outline"
                onClick={pasteFromClipboard}
                className="shrink-0"
                aria-label="Paste link from clipboard"
              >
                <ClipboardPaste className="size-4" />
                Paste
              </Button>
            )}
          </div>
          {clipboardHint && (
            <p className="text-xs text-muted-foreground">{clipboardHint}</p>
          )}
          {parsed && (
            <p
              className={cn(
                "text-xs",
                supportable === false ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {supportable === false
                ? "We only support TikTok and Instagram for now."
                : `Detected: ${platformLabel(parsed.platform)}`}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Why did you save this?{" "}
            <span className="font-normal text-muted-foreground">Optional</span>
          </p>
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
  // Expired CDN thumbnails fail to load — fall back to the placeholder instead
  // of a broken black box. Tracking the failed URL (not a boolean) lets a
  // fresh URL from a later poll get another chance.
  const [failedThumbUrl, setFailedThumbUrl] = React.useState<string | null>(null);
  const thumbnailUrl =
    inspo.thumbnail_url && inspo.thumbnail_url !== failedThumbUrl
      ? inspo.thumbnail_url
      : null;
  return (
    <li>
      <Link
        href={`/inspo/${inspo.id}`}
        className="group block overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/30"
      >
        <div className="relative aspect-[9/12] w-full overflow-hidden bg-secondary">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              onError={() => setFailedThumbUrl(thumbnailUrl)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <span className="text-xs">No thumbnail yet</span>
            </div>
          )}
          <div className="absolute left-2 top-2 flex items-center gap-1.5">
            <Badge variant="glass">{platformLabel(inspo.platform)}</Badge>
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
              <span className="text-muted-foreground italic">Caption pending…</span>
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

// Thumbnail overlays use the glass badge (per the design) with a status-colored
// icon so state stays legible over any artwork.
function AnalysisStatusBadge({ status }: { status: AnalysisStatus }) {
  if (status === "complete") {
    return (
      <Badge variant="glass">
        <CheckCircle2 className="size-3 text-success" />
        Analyzed
      </Badge>
    );
  }
  if (status === "queued" || status === "processing") {
    return (
      <Badge variant="glass">
        <Loader2 className="size-3 animate-spin" />
        Analyzing…
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="glass">
        <AlertTriangle className="size-3 text-destructive" />
        Retry
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="glass">
        <AlertTriangle className="size-3 text-warning" />
        Partial
      </Badge>
    );
  }
  return (
    <Badge variant="glass">
      <ExternalLink className="size-3" />
      Saved
    </Badge>
  );
}
