"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ExternalLink,
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
  const [archiving, setArchiving] = React.useState(false);

  const isPending =
    inspo.analysis_status === "queued" || inspo.analysis_status === "processing";

  // Poll while pending so the user sees sections fill in live.
  React.useEffect(() => {
    if (!isPending) return;
    const interval = setInterval(async () => {
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
    }, 2000);
    return () => clearInterval(interval);
  }, [isPending, inspo.id]);

  async function retry() {
    setRetrying(true);
    try {
      await fetch(`/api/inspo/${inspo.id}/retry-analysis`, { method: "POST" });
      setInspo((s) => ({
        ...s,
        analysis_status: "queued",
        media_status: "queued",
      }));
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
    <div className="flex flex-col gap-5">
      <Link
        href="/library"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
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
      {isPending && !analysis && <PendingAnalysisCard job={job} />}

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
  archiving,
}: {
  inspo: InspoRow;
  onRetry: () => void;
  onArchive: () => void;
  retrying: boolean;
  archiving: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-0">
        <div className="relative aspect-[9/12] sm:aspect-auto bg-secondary">
          {inspo.thumbnail_url ? (
            <img
              src={inspo.thumbnail_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center text-xs text-muted-foreground">
              {inspo.media_status === "queued"
                ? "Fetching media…"
                : "No thumbnail available"}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{platformLabel(inspo.platform)}</Badge>
            <AnalysisPill status={inspo.analysis_status} />
            <span className="text-xs text-muted-foreground">
              Saved {formatRelativeTime(inspo.created_at)}
            </span>
          </div>

          <div>
            <p className="text-sm font-medium">
              {inspo.creator_handle ? `@${inspo.creator_handle}` : "Unknown creator"}
            </p>
            {inspo.caption && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
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

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            <a
              href={inspo.deep_link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline underline-offset-4"
            >
              Open original
              <ExternalLink className="size-3.5" />
            </a>
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              <RefreshCcw
                className={cn("size-3.5", retrying && "animate-spin")}
              />
              {inspo.analysis_status === "complete"
                ? "Re-analyze"
                : "Retry analysis"}
            </button>
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={onArchive}
              disabled={archiving}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-destructive disabled:opacity-60"
            >
              <Trash2 className="size-3.5" />
              Archive
            </button>
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

function PendingAnalysisCard({ job }: { job: IngestionJobRow | null }) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <Loader2 className="size-5 mt-0.5 animate-spin text-brand" />
        <div className="flex-1">
          <p className="font-medium">Analyzing this inspo</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {job?.status === "downloading" && "Downloading the video…"}
            {job?.status === "downloaded" && "Preparing for analysis…"}
            {job?.status === "uploading_to_gemini" &&
              "Sending to the analysis model…"}
            {job?.status === "analyzing" &&
              "Breaking down hook, structure, visuals, and audio…"}
            {!job?.status &&
              "Hook, structure, visuals, and reusable pattern coming up."}
          </p>
        </div>
      </CardContent>
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
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
        <AlertTriangle className="size-5 mt-0.5 text-destructive" />
        <div className="flex-1">
          <p className="font-medium">Saved, but analysis failed</p>
          <p className="text-sm text-muted-foreground mt-0.5">
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
      </CardContent>
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
      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
          <CardDescription>
            Metrics aren&apos;t available for this video. We&apos;ll surface them when we
            connect TikTok / Instagram metrics in a future update.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
          <CardDescription>Loading metrics…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance</CardTitle>
        <CardDescription>
          Source: {metrics.source} · Confidence: {metrics.confidence} · Updated{" "}
          {formatRelativeTime(metrics.fetched_at)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat icon={<Eye className="size-4" />} label="Views" value={formatCount(metrics.views)} />
          <Stat icon={<Heart className="size-4" />} label="Likes" value={formatCount(metrics.likes)} />
          <Stat
            icon={<MessageCircle className="size-4" />}
            label="Comments"
            value={formatCount(metrics.comments)}
          />
          <Stat icon={<Share2 className="size-4" />} label="Shares" value={formatCount(metrics.shares)} />
          <Stat icon={<Bookmark className="size-4" />} label="Saves" value={formatCount(metrics.saves)} />
        </div>
        {metrics.engagement_rate !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Engagement rate: {(metrics.engagement_rate * 100).toFixed(1)}%
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SummarySection({ analysis }: { analysis: VideoAnalysisRow }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Executive summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        <p>{analysis.summary}</p>
        <dl className="mt-3 grid grid-cols-1 gap-y-1.5 sm:grid-cols-3 text-sm">
          <KV label="Category" value={analysis.content_category} />
          <KV label="Topic" value={analysis.primary_topic} />
          <KV label="Audience" value={analysis.target_audience} />
        </dl>
      </CardContent>
    </Card>
  );
}

function KV({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}

function WhyItWorkedSection({ data }: { data: WhyItWorked }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Why it worked</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        <p className="text-base font-medium">{data.primary_reason}</p>
        {data.secondary_reasons?.length > 0 && (
          <ul className="space-y-1.5 list-disc pl-5 text-muted-foreground">
            {data.secondary_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Platform fit: {data.platform_fit}</Badge>
          <Badge variant="secondary">Audience fit: {data.audience_fit}</Badge>
        </div>
        {data.creative_strengths?.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Creative strengths
            </p>
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
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Performance risks
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.performance_risks.map((s, i) => (
                <Badge key={i} variant="warning">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HookSection({ data }: { data: Hook }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hook</CardTitle>
        <CardDescription>The first 1–3 seconds.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        {data.text && (
          <blockquote className="rounded-lg border-l-4 border-brand bg-brand/5 px-4 py-3 text-base font-medium">
            “{data.text}”
          </blockquote>
        )}
        <div className="flex flex-wrap gap-2">
          {data.type && <Badge variant="brand">{data.type}</Badge>}
          {data.modality && <Badge variant="secondary">{data.modality}</Badge>}
          {typeof data.strength_score === "number" && (
            <Badge variant="outline">
              Strength: {data.strength_score}/10
            </Badge>
          )}
        </div>
        {data.notes && <p className="text-muted-foreground">{data.notes}</p>}
      </CardContent>
    </Card>
  );
}

function StructureSection({ data }: { data: Structure }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Structure</CardTitle>
        {data.retention_arc && (
          <CardDescription>{data.retention_arc}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed">
        <div className="flex flex-wrap gap-2">
          {data.type && <Badge variant="brand">{data.type}</Badge>}
          {data.pacing && <Badge variant="secondary">Pacing: {data.pacing}</Badge>}
          {data.loopability && (
            <Badge variant="secondary">Loopability: {data.loopability}</Badge>
          )}
        </div>
        {data.beats?.length > 0 && (
          <ol className="relative ml-3 space-y-3 border-l border-border pl-4">
            {data.beats.map((b: StructureBeat, i: number) => (
              <li key={i} className="relative">
                <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-brand ring-4 ring-background" />
                <div className="flex items-baseline gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {b.timestamp_start}s–{b.timestamp_end}s
                  </span>
                  <span className="font-medium">{b.label}</span>
                </div>
                <p className="text-muted-foreground">{b.description}</p>
                {b.purpose && (
                  <p className="text-xs text-muted-foreground italic">
                    Purpose: {b.purpose}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function VisualsSection({ data }: { data: Visuals }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visuals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
          <KV label="Style" value={data.style} />
          <KV label="Framing" value={data.camera_framing} />
          <KV label="Setting" value={data.setting} />
          <KV label="Lighting" value={data.lighting} />
          <KV label="Motion" value={data.motion} />
          <KV label="Text overlay" value={data.text_overlay} />
        </dl>
        {data.visual_density && (
          <Badge variant="secondary">Density: {data.visual_density}</Badge>
        )}
        {data.notable_frames?.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mt-2">
              Notable frames
            </p>
            <ul className="mt-2 space-y-2">
              {data.notable_frames.map((f: NotableFrame, i: number) => (
                <li key={i} className="rounded-md border border-border p-3">
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {f.timestamp}s
                  </p>
                  <p className="mt-0.5">{f.description}</p>
                  {f.why_it_matters && (
                    <p className="mt-0.5 text-xs text-muted-foreground italic">
                      {f.why_it_matters}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AudioSection({ data }: { data: AudioAnalysis }) {
  const hasTranscript = (data.transcript ?? "").trim().length > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audio & transcript</CardTitle>
        {!hasTranscript && (
          <CardDescription>
            Transcript unavailable. Visual analysis completed.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        {hasTranscript && (
          <p className="rounded-md border border-border bg-secondary/50 p-3 italic">
            “{data.transcript}”
          </p>
        )}
        <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
          <KV label="Speaking style" value={data.speaking_style} />
          <KV label="Pace" value={data.speaking_pace} />
          <KV label="Music" value={data.music_usage} />
          <KV label="Sound effects" value={data.sound_effects} />
        </dl>
        {data.key_phrases?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.key_phrases.map((p, i) => (
              <Badge key={i} variant="outline">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditingSection({ data }: { data: Editing }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Editing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        <div className="flex flex-wrap gap-2">
          {data.pace && <Badge variant="secondary">Pace: {data.pace}</Badge>}
          {data.cut_frequency && (
            <Badge variant="secondary">Cuts: {data.cut_frequency}</Badge>
          )}
          {data.caption_style && (
            <Badge variant="outline">Captions: {data.caption_style}</Badge>
          )}
        </div>
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
      </CardContent>
    </Card>
  );
}

function BadgeList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
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
    <Card className="border-brand/30 bg-brand/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-brand" />
          <CardTitle>Reusable pattern</CardTitle>
        </div>
        <CardDescription>What you can take from this inspo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">
        {data.name && (
          <p className="text-base font-semibold">{data.name}</p>
        )}
        {data.template && (
          <blockquote className="rounded-lg border border-brand/30 bg-background px-4 py-3 italic">
            {data.template}
          </blockquote>
        )}
        <dl className="space-y-2">
          {data.when_to_use && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                When to use
              </dt>
              <dd className="mt-0.5">{data.when_to_use}</dd>
            </div>
          )}
          {data.why_it_works && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Why it works
              </dt>
              <dd className="mt-0.5">{data.why_it_works}</dd>
            </div>
          )}
          {data.adaptation_notes && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                Adapt for you
              </dt>
              <dd className="mt-0.5">{data.adaptation_notes}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand" />
          <CardTitle>Tags</CardTitle>
        </div>
        <CardDescription>
          What this inspo is. Power for search & filters.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {nonEmpty.map((g) => (
          <div key={g.key}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {g.label}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {data[g.key].map((t, i) => (
                <Badge key={i} variant="secondary">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
