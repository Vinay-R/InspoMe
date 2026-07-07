"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  Copy,
  Loader2,
  RefreshCcw,
  AlertTriangle,
  Lightbulb,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn, formatCount, formatRelativeTime } from "@/lib/utils";
import { platformLabel } from "@/lib/platform";
import type {
  AnalysisTags,
  AudioAnalysis,
  Editing,
  Hook,
  IngestionJobRow,
  InspoRow,
  NotableFrame,
  PlatformMetricsRow,
  ReusablePattern,
  Structure,
  StructureBeat,
  VideoAnalysisRow,
  Visuals,
  WhyItWorked,
} from "@/lib/supabase/types";

interface Props {
  initialInspo: InspoRow;
  initialAnalysis: VideoAnalysisRow | null;
  initialMetrics: PlatformMetricsRow | null;
  initialJob: IngestionJobRow | null;
}

const COPY_FEEDBACK_MS = 1500;

/**
 * Small ghost icon button that copies plain text and flips to a checkmark
 * for a moment. Reused on the hook quote, reusable-pattern template, and
 * transcript blocks.
 */
function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const resetTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // clipboard unavailable/denied — leave the button as-is
    }
    setCopied(true);
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(
      () => setCopied(false),
      COPY_FEEDBACK_MS,
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:border-foreground/40 hover:text-foreground",
        copied && "text-success hover:text-success",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="size-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5" />
          Copy
        </>
      )}
    </button>
  );
}

/**
 * The uniform section shell used across the analysis: a card with 18px
 * padding, a header row (optional brand-tinted icon + title) and an optional
 * muted subtitle, then the section body. `brand` tints the whole card.
 */
function SectionCard({
  title,
  description,
  icon,
  brand,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  brand?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "p-[18px]",
        brand && "border-brand/30 bg-brand/5",
        className,
      )}
    >
      <div className="mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>{title}</CardTitle>
        </div>
        {description && (
          <CardDescription className="mt-1 text-[13px] leading-normal">
            {description}
          </CardDescription>
        )}
      </div>
      {children}
    </Card>
  );
}

function KV({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-[3px] text-[13.5px]">{value || "—"}</dd>
    </div>
  );
}

const POLL_FAST_MS = 2000;
const POLL_SLOW_MS = 10_000;
const POLL_SLOW_AFTER_MS = 90_000;
const POLL_STOP_AFTER_MS = 10 * 60_000;

type PollPhase = "fast" | "slow" | "stopped";

export function InspoDetailView({
  initialInspo,
  initialAnalysis,
  initialMetrics,
  initialJob,
}: Props) {
  const router = useRouter();
  const [inspo, setInspo] = React.useState(initialInspo);
  const [analysis, setAnalysis] = React.useState(initialAnalysis);
  const [metrics, setMetrics] = React.useState(initialMetrics);
  const [job, setJob] = React.useState(initialJob);
  const [retrying, setRetrying] = React.useState(false);
  const [retryError, setRetryError] = React.useState<string | null>(null);
  const [archiving, setArchiving] = React.useState(false);
  const [pollPhase, setPollPhase] = React.useState<PollPhase>("fast");
  const pollingSinceRef = React.useRef<number | null>(null);

  const isPending =
    inspo.analysis_status === "queued" || inspo.analysis_status === "processing";
  const analysisDelayed = isPending && pollPhase !== "fast";

  // Poll while pending so the user sees sections fill in live. After 90s of
  // continuous pending we back off to a slow interval; after 10 minutes we
  // stop entirely (the server-side reaper will have failed the job by then).
  React.useEffect(() => {
    if (!isPending) {
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
        const res = await fetch(`/api/inspo/${inspo.id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success) {
          setInspo(json.data.inspo);
          setAnalysis(json.data.analysis);
          setMetrics(json.data.metrics);
          setJob(json.data.ingestion_job);
        }
      } catch {
        // keep last good state
      }
    }, pollPhase === "slow" ? POLL_SLOW_MS : POLL_FAST_MS);
    return () => clearInterval(interval);
  }, [isPending, inspo.id, pollPhase]);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/inspo/${inspo.id}/retry-analysis`, {
        method: "POST",
      });
      if (!res.ok) {
        // The API returns a user-safe `error` message (429 rate limit,
        // 409 already running, …) — surface it instead of lying with a
        // fake "queued" state.
        let message = "Couldn't restart the analysis. Please try again.";
        try {
          const json = await res.json();
          if (typeof json?.error === "string" && json.error) {
            message = json.error;
          }
        } catch {
          // non-JSON body — keep the generic message
        }
        setRetryError(message);
        return;
      }
      pollingSinceRef.current = null;
      setPollPhase("fast");
      setInspo((s) => ({
        ...s,
        analysis_status: "queued",
        media_status: "queued",
      }));
    } catch {
      setRetryError("Network error. Check your connection and try again.");
    } finally {
      setRetrying(false);
    }
  }

  async function archive() {
    if (!confirm("Archive this inspo? You can restore it from settings later.")) {
      return;
    }
    setArchiving(true);
    await fetch(`/api/inspo/${inspo.id}`, { method: "DELETE" });
    router.push("/library");
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Link
        href="/library"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Library
      </Link>

      {/* A. Media Header */}
      <MediaHeader
        inspo={inspo}
        onRetry={retry}
        onArchive={archive}
        retrying={retrying}
        retryError={retryError}
        archiving={archiving}
      />

      {/* If everything failed, lead with a clear retry path */}
      {inspo.analysis_status === "failed" && !analysis && (
        <FailedBanner onRetry={retry} retrying={retrying} job={job} />
      )}

      {/* B. Performance Snapshot */}
      <PerformanceSection
        metrics={metrics}
        metricsStatus={inspo.metrics_status}
      />

      {/* While we wait for the first analysis, show progress + skeletons */}
      {isPending && !analysis && (
        <PendingAnalysisCard
          job={job}
          delayed={analysisDelayed}
          onRetry={retry}
          retrying={retrying}
        />
      )}

      {/* C. AI Executive Summary */}
      {analysis && <SummarySection analysis={analysis} />}

      {/* D. Why It Worked */}
      {analysis?.why_it_worked && (
        <WhyItWorkedSection data={analysis.why_it_worked as WhyItWorked} />
      )}

      {/* E. Hook */}
      {analysis?.hook && (
        <HookSection data={analysis.hook as Hook} />
      )}

      {/* F. Structure */}
      {analysis?.structure && (
        <StructureSection data={analysis.structure as Structure} />
      )}

      {/* G. Visuals */}
      {analysis?.visuals && (
        <VisualsSection data={analysis.visuals as Visuals} />
      )}

      {/* H. Audio */}
      {analysis?.audio && (
        <AudioSection data={analysis.audio as AudioAnalysis} />
      )}

      {/* I. Editing */}
      {analysis?.editing && (
        <EditingSection data={analysis.editing as Editing} />
      )}

      {/* K. Reusable Pattern */}
      {analysis?.reusable_pattern && (
        <ReusablePatternSection
          data={analysis.reusable_pattern as ReusablePattern}
        />
      )}

      {/* J. Tags */}
      {analysis?.tags && <TagsSection data={analysis.tags as AnalysisTags} />}
    </div>
  );
}

function MediaHeader({
  inspo,
  onRetry,
  onArchive,
  retrying,
  retryError,
  archiving,
}: {
  inspo: InspoRow;
  onRetry: () => void;
  onArchive: () => void;
  retrying: boolean;
  retryError: string | null;
  archiving: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[140px_1fr]">
        <a
          href={inspo.deep_link_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open original on ${platformLabel(inspo.platform)}`}
          className="group relative block overflow-hidden bg-secondary"
        >
          {inspo.thumbnail_url ? (
            <img
              src={inspo.thumbnail_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full min-h-[160px] items-center justify-center p-6 text-center text-xs text-muted-foreground">
              {inspo.media_status === "queued"
                ? "Fetching media…"
                : "No thumbnail available"}
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/30" />
        </a>
        <div className="flex flex-col gap-2.5 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{platformLabel(inspo.platform)}</Badge>
            <AnalysisPill status={inspo.analysis_status} />
            <span className="text-xs text-muted-foreground">
              Saved {formatRelativeTime(inspo.created_at)}
            </span>
          </div>

          <div>
            <p className="text-[14px] font-medium">
              {inspo.creator_handle ? `@${inspo.creator_handle}` : "Unknown creator"}
            </p>
            {inspo.caption && (
              <p className="mt-1 line-clamp-3 text-[13px] leading-normal text-muted-foreground">
                {inspo.caption}
              </p>
            )}
          </div>

          {inspo.save_reasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {inspo.save_reasons.map((r) => (
                <Badge key={r} variant="outline">
                  {r}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-auto flex flex-col gap-1.5 pt-1">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
              >
                <RefreshCcw
                  className={cn("size-3.5", retrying && "animate-spin")}
                />
                {inspo.analysis_status === "complete"
                  ? "Re-analyze"
                  : "Retry analysis"}
              </button>
              <button
                type="button"
                onClick={onArchive}
                disabled={archiving}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
              >
                <Trash2 className="size-3.5" />
                Archive
              </button>
            </div>
            {retryError && (
              <p role="alert" className="text-xs text-destructive">
                {retryError}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function AnalysisPill({ status }: { status: InspoRow["analysis_status"] }) {
  if (status === "complete")
    return <Badge variant="success">Analysis ready</Badge>;
  if (status === "queued" || status === "processing")
    return (
      <Badge variant="secondary">
        <Loader2 className="size-3 animate-spin" />
        Analyzing
      </Badge>
    );
  if (status === "failed")
    return <Badge variant="danger">Analysis failed</Badge>;
  if (status === "partial") return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="secondary">Saved</Badge>;
}

function PendingAnalysisCard({
  job,
  delayed,
  onRetry,
  retrying,
}: {
  job: IngestionJobRow | null;
  delayed: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <Card className="flex items-start gap-3 p-[18px]">
      <Loader2 className="mt-0.5 size-5 animate-spin text-brand" />
      <div className="flex-1">
        <p className="font-medium">Analyzing this inspo</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {job?.status === "downloading" && "Downloading the video…"}
          {job?.status === "downloaded" && "Preparing for analysis…"}
          {job?.status === "uploading_to_gemini" &&
            "Sending to the analysis model…"}
          {job?.status === "analyzing" &&
            "Breaking down hook, structure, visuals, and audio…"}
          {!job?.status &&
            "Hook, structure, visuals, and reusable pattern coming up."}
        </p>
        {delayed && (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">
              This is taking longer than usual. You can keep waiting or retry.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={onRetry}
              loading={retrying}
            >
              <RefreshCcw className="size-4" />
              Retry analysis
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function FailedBanner({
  onRetry,
  retrying,
  job,
}: {
  onRetry: () => void;
  retrying: boolean;
  job: IngestionJobRow | null;
}) {
  return (
    <Card className="flex flex-col gap-3 border-destructive/30 bg-destructive/5 p-[18px] sm:flex-row sm:items-start">
      <AlertTriangle className="mt-0.5 size-5 text-destructive" />
      <div className="flex-1">
        <p className="font-medium">Saved, but analysis failed</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {job?.error_message ??
            "Something went wrong while breaking this video down."}{" "}
          The link is still saved in your library.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={onRetry}
          loading={retrying}
        >
          <RefreshCcw className="size-4" />
          Retry analysis
        </Button>
      </div>
    </Card>
  );
}

function PerformanceSection({
  metrics,
  metricsStatus,
}: {
  metrics: PlatformMetricsRow | null;
  metricsStatus: InspoRow["metrics_status"];
}) {
  if (!metrics && metricsStatus === "unavailable") {
    return (
      <SectionCard
        title="Performance"
        description="Metrics aren't available for this video. We'll surface them when we connect TikTok / Instagram metrics in a future update."
      />
    );
  }
  if (!metrics) {
    return <SectionCard title="Performance" description="Loading metrics…" />;
  }

  return (
    <SectionCard
      title="Performance"
      description={`Source: ${metrics.source} · Confidence: ${metrics.confidence} · Updated ${formatRelativeTime(metrics.fetched_at)}`}
    >
      <div className="grid grid-cols-3 gap-2">
        <StatCell
          icon={<Eye className="size-3.5" />}
          label="Views"
          value={formatCount(metrics.views)}
        />
        <StatCell
          icon={<Heart className="size-3.5" />}
          label="Likes"
          value={formatCount(metrics.likes)}
        />
        <StatCell
          icon={<MessageCircle className="size-3.5" />}
          label="Comments"
          value={formatCount(metrics.comments)}
        />
        <StatCell
          icon={<Share2 className="size-3.5" />}
          label="Shares"
          value={formatCount(metrics.shares)}
        />
        <StatCell
          icon={<Bookmark className="size-3.5" />}
          label="Saves"
          value={formatCount(metrics.saves)}
        />
        <StatCell
          icon={<Zap className="size-3.5" />}
          label="Eng. rate"
          value={
            metrics.engagement_rate !== null
              ? `${(metrics.engagement_rate * 100).toFixed(1)}%`
              : "—"
          }
        />
      </div>
    </SectionCard>
  );
}

function StatCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-[5px] text-[18px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SummarySection({ analysis }: { analysis: VideoAnalysisRow }) {
  return (
    <SectionCard title="Executive summary">
      <p className="text-[13.5px] leading-relaxed">{analysis.summary}</p>
      <dl className="mt-3.5 grid grid-cols-3 gap-3">
        <KV label="Category" value={analysis.content_category} />
        <KV label="Topic" value={analysis.primary_topic} />
        <KV label="Audience" value={analysis.target_audience} />
      </dl>
    </SectionCard>
  );
}

function WhyItWorkedSection({ data }: { data: WhyItWorked }) {
  return (
    <SectionCard title="Why it worked">
      <p className="text-[15px] font-medium leading-snug">
        {data.primary_reason}
      </p>
      {data.secondary_reasons?.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-[18px] text-[13px] leading-normal text-muted-foreground">
          {data.secondary_reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <Badge variant="secondary">Platform fit: {data.platform_fit}</Badge>
        <Badge variant="secondary">Audience fit: {data.audience_fit}</Badge>
      </div>
      {data.creative_strengths?.length > 0 && (
        <div className="mt-3.5">
          <p className="eyebrow">Creative strengths</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.creative_strengths.map((s, i) => (
              <Badge key={i} variant="success">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {data.performance_risks?.length > 0 && (
        <div className="mt-3">
          <p className="eyebrow">Performance risks</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.performance_risks.map((s, i) => (
              <Badge key={i} variant="warning">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function HookSection({ data }: { data: Hook }) {
  return (
    <SectionCard title="Hook" description="The first 1–3 seconds.">
      {data.text && (
        <div className="relative">
          <blockquote className="rounded-lg border-l-4 border-brand bg-brand/5 px-4 py-3 pr-20 text-base font-medium leading-snug">
            “{data.text}”
          </blockquote>
          <CopyButton
            text={data.text}
            label="Copy hook text"
            className="absolute right-2 top-2"
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.type && <Badge variant="brand">{data.type}</Badge>}
        {data.modality && <Badge variant="secondary">{data.modality}</Badge>}
        {typeof data.strength_score === "number" && (
          <Badge variant="outline">Strength: {data.strength_score}/10</Badge>
        )}
      </div>
      {data.notes && (
        <p className="mt-3 text-[13px] leading-normal text-muted-foreground">
          {data.notes}
        </p>
      )}
    </SectionCard>
  );
}

function StructureSection({ data }: { data: Structure }) {
  return (
    <SectionCard title="Structure" description={data.retention_arc ?? undefined}>
      <div className="flex flex-wrap gap-1.5">
        {data.type && <Badge variant="brand">{data.type}</Badge>}
        {data.pacing && <Badge variant="secondary">Pacing: {data.pacing}</Badge>}
        {data.loopability && (
          <Badge variant="secondary">Loopability: {data.loopability}</Badge>
        )}
      </div>
      {data.beats?.length > 0 && (
        <ol className="ml-1.5 mt-3.5 border-l border-border pl-[18px]">
          {data.beats.map((b: StructureBeat, i: number) => (
            <li key={i} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[24px] top-1 size-2.5 rounded-full bg-brand ring-4 ring-background" />
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {b.timestamp_start}s–{b.timestamp_end}s
                </span>
                <span className="text-[14px] font-medium">{b.label}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-normal text-muted-foreground">
                {b.description}
              </p>
              {b.purpose && (
                <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                  Purpose: {b.purpose}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function VisualsSection({ data }: { data: Visuals }) {
  return (
    <SectionCard title="Visuals">
      <dl className="grid grid-cols-2 gap-3">
        <KV label="Style" value={data.style} />
        <KV label="Framing" value={data.camera_framing} />
        <KV label="Setting" value={data.setting} />
        <KV label="Lighting" value={data.lighting} />
        <KV label="Motion" value={data.motion} />
        <KV label="Text overlay" value={data.text_overlay} />
      </dl>
      {data.visual_density && (
        <div className="mt-3">
          <Badge variant="secondary">Density: {data.visual_density}</Badge>
        </div>
      )}
      {data.notable_frames?.length > 0 && (
        <div className="mt-3.5">
          <p className="eyebrow">Notable frames</p>
          <ul className="mt-2 space-y-2">
            {data.notable_frames.map((f: NotableFrame, i: number) => (
              <li
                key={i}
                className="rounded-[10px] border border-border p-3"
              >
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {f.timestamp}s
                </p>
                <p className="mt-0.5 text-[13px] leading-normal">
                  {f.description}
                </p>
                {f.why_it_matters && (
                  <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                    {f.why_it_matters}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

function AudioSection({ data }: { data: AudioAnalysis }) {
  const hasTranscript = (data.transcript ?? "").trim().length > 0;
  return (
    <SectionCard
      title="Audio & transcript"
      description={
        hasTranscript
          ? undefined
          : "Transcript unavailable. Visual analysis completed."
      }
    >
      {hasTranscript && (
        <div className="relative">
          <p className="rounded-lg border border-border bg-secondary/50 px-4 py-3 pr-20 text-[13.5px] italic leading-normal">
            “{data.transcript}”
          </p>
          <CopyButton
            text={(data.transcript ?? "").trim()}
            label="Copy transcript"
            className="absolute right-2 top-2"
          />
        </div>
      )}
      <dl
        className={cn(
          "grid grid-cols-2 gap-3",
          hasTranscript && "mt-3.5",
        )}
      >
        <KV label="Speaking style" value={data.speaking_style} />
        <KV label="Pace" value={data.speaking_pace} />
        <KV label="Music" value={data.music_usage} />
        <KV label="Sound effects" value={data.sound_effects} />
      </dl>
      {data.key_phrases?.length > 0 && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {data.key_phrases.map((p, i) => (
            <Badge key={i} variant="outline">
              {p}
            </Badge>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function EditingSection({ data }: { data: Editing }) {
  return (
    <SectionCard title="Editing">
      <div className="flex flex-wrap gap-1.5">
        {data.pace && <Badge variant="secondary">Pace: {data.pace}</Badge>}
        {data.cut_frequency && (
          <Badge variant="secondary">Cuts: {data.cut_frequency}</Badge>
        )}
        {data.caption_style && (
          <Badge variant="outline">Captions: {data.caption_style}</Badge>
        )}
      </div>
      <div className="mt-3.5 space-y-3">
        {data.retention_devices?.length > 0 && (
          <BadgeList label="Retention devices" items={data.retention_devices} />
        )}
        {data.transitions?.length > 0 && (
          <BadgeList label="Transitions" items={data.transitions} />
        )}
        {data.pattern_interrupts?.length > 0 && (
          <BadgeList
            label="Pattern interrupts"
            items={data.pattern_interrupts}
          />
        )}
      </div>
    </SectionCard>
  );
}

function BadgeList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((s, i) => (
          <Badge key={i} variant="outline">
            {s}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ReusablePatternSection({ data }: { data: ReusablePattern }) {
  if (!data.name && !data.template) return null;
  return (
    <SectionCard
      title="Reusable pattern"
      icon={<Lightbulb className="size-4 text-brand" />}
      brand
      description="What you can take from this inspo."
    >
      {data.name && <p className="text-[15px] font-semibold">{data.name}</p>}
      {data.template && (
        <div className="relative mt-2.5">
          <blockquote className="rounded-lg border border-brand/30 bg-background px-4 py-3 pr-20 italic leading-normal">
            {data.template}
          </blockquote>
          <CopyButton
            text={data.template}
            label="Copy pattern template"
            className="absolute right-2 top-2"
          />
        </div>
      )}
      <dl className="mt-3.5 space-y-2.5">
        {data.when_to_use && <KV label="When to use" value={data.when_to_use} />}
        {data.why_it_works && (
          <KV label="Why it works" value={data.why_it_works} />
        )}
        {data.adaptation_notes && (
          <KV label="Adapt for you" value={data.adaptation_notes} />
        )}
      </dl>
    </SectionCard>
  );
}

function TagsSection({ data }: { data: AnalysisTags }) {
  const groups: Array<{ label: string; key: keyof AnalysisTags }> = [
    { label: "Topics", key: "topics" },
    { label: "Format", key: "format" },
    { label: "Hook type", key: "hook_type" },
    { label: "Structure", key: "structure_type" },
    { label: "Visual style", key: "visual_style" },
    { label: "Editing", key: "editing_style" },
    { label: "Tone", key: "tone" },
    { label: "Pillars", key: "content_pillar" },
    { label: "Audience intent", key: "audience_intent" },
    { label: "Performance driver", key: "performance_driver" },
  ];
  const nonEmpty = groups.filter((g) => (data[g.key] ?? []).length > 0);
  if (nonEmpty.length === 0) return null;
  return (
    <SectionCard
      title="Tags"
      icon={<Sparkles className="size-4 text-brand" />}
      description="What this inspo is. Power for search & filters."
    >
      <div className="space-y-3">
        {nonEmpty.map((g) => (
          <div key={g.key}>
            <p className="eyebrow">{g.label}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {data[g.key].map((t, i) => (
                <Badge key={i} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
