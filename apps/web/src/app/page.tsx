import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Link2,
  ScanSearch,
  Repeat2,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "InspoMe — Decode your favorite posts.",
  description:
    "Save TikToks and Reels, and InspoMe breaks each one down — hook, structure, visuals, editing — into a pattern you can reuse in your next video.",
};

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed) {
      redirect("/onboarding");
    }
    redirect("/library");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block size-6 rounded-md bg-brand" />
            <span className="font-semibold tracking-tight">InspoMe</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5">
        {/* Hero */}
        <section className="flex flex-col gap-5 pb-14 pt-14 md:pb-20 md:pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
            For short-form creators
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Decode Your Favorite Posts.
            <br />
            Re-use Viral Formats.
            <br />
            Make It Yours.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-foreground/80 md:text-lg">
            Your saved folder is full of videos you&apos;ll never rewatch.
            InspoMe breaks each one down — hook, structure, visuals, editing —
            into a pattern you can reuse in your next video.
          </p>
          <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-brand px-6 text-base font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand/90"
            >
              Start your library
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#example"
              className="inline-flex h-12 items-center justify-center rounded-md px-4 text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              See a breakdown
            </a>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-border pb-14 pt-14 md:pb-20 md:pt-20">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            How it works
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            <div className="flex flex-col gap-3">
              <div className="inline-flex size-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <Link2 className="size-5" />
              </div>
              <div>
                <p className="font-medium">Paste a link</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Drop any TikTok or Reel into your library the moment it stops
                  your scroll.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="inline-flex size-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <ScanSearch className="size-5" />
              </div>
              <div>
                <p className="font-medium">We break it down</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  AI watches the video and maps the hook, beats, visuals, and
                  editing choices.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="inline-flex size-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <Repeat2 className="size-5" />
              </div>
              <div>
                <p className="font-medium">Reuse the pattern</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Take the template and shoot your version — same mechanics,
                  your voice.
                </p>
              </div>
            </div>
          </div>
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-brand px-6 text-base font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand/90"
            >
              Save your first inspo
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        {/* Example analysis */}
        <section
          id="example"
          className="scroll-mt-20 border-t border-border pb-16 pt-14 md:pb-24 md:pt-20"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="brand">Example analysis</Badge>
            <p className="text-sm text-muted-foreground">
              What every saved video turns into.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {/* Media header strip */}
            <Card>
              <CardContent className="flex flex-col gap-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">TikTok</Badge>
                  <Badge variant="success">
                    <CheckCircle2 className="size-3" />
                    Analysis ready
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    0:32
                  </span>
                </div>
                <p className="text-sm font-medium">@lena.makes</p>
                <p className="text-sm text-muted-foreground">
                  the $12 pantry pasta that got me 2M views 🍋
                </p>
              </CardContent>
            </Card>

            {/* Hook */}
            <Card>
              <CardHeader>
                <CardTitle>Hook</CardTitle>
                <CardDescription>The first 1–3 seconds.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed">
                <blockquote className="rounded-lg border-l-4 border-brand bg-brand/5 px-4 py-3 text-base font-medium">
                  &ldquo;You&apos;ve been salting your pasta water wrong your
                  whole life — and it&apos;s not your fault.&rdquo;
                </blockquote>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="brand">Contrarian claim</Badge>
                  <Badge variant="secondary">Spoken + text overlay</Badge>
                  <Badge variant="outline">Strength: 9/10</Badge>
                </div>
                <p className="text-muted-foreground">
                  Challenges a daily habit in the first breath, then softens
                  the blame — the viewer stays to be proven wrong.
                </p>
              </CardContent>
            </Card>

            {/* Structure */}
            <Card>
              <CardHeader>
                <CardTitle>Structure</CardTitle>
                <CardDescription>
                  Front-loaded payoff with a seamless loop back to the opener.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed">
                <ol className="relative ml-3 space-y-3 border-l border-border pl-4">
                  <li className="relative">
                    <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-brand ring-4 ring-card" />
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        0s–3s
                      </span>
                      <span className="font-medium">Hook</span>
                    </div>
                    <p className="text-muted-foreground">
                      Tight face crop, claim delivered to camera; text overlay
                      repeats it word for word.
                    </p>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-brand ring-4 ring-card" />
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        3s–24s
                      </span>
                      <span className="font-medium">Proof build</span>
                    </div>
                    <p className="text-muted-foreground">
                      The method in fast cuts — each step answers the doubt the
                      hook planted.
                    </p>
                  </li>
                  <li className="relative">
                    <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-brand ring-4 ring-card" />
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        24s–32s
                      </span>
                      <span className="font-medium">Loop close</span>
                    </div>
                    <p className="text-muted-foreground">
                      The final plate mirrors the opening frame, so the rewatch
                      feels seamless.
                    </p>
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* Reusable pattern */}
            <Card className="border-brand/30 bg-brand/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-brand" />
                  <CardTitle>Reusable pattern</CardTitle>
                </div>
                <CardDescription>
                  What you can take from this inspo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed">
                <p className="text-base font-semibold">
                  Contrarian hook → fast proof → seamless loop
                </p>
                <blockquote className="rounded-lg border border-brand/30 bg-background px-4 py-3 italic">
                  Open on a claim your audience will push back on, prove it in
                  under 20 seconds, and end on a frame that mirrors your
                  opener.
                </blockquote>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">contrarian claim</Badge>
                  <Badge variant="secondary">talking head</Badge>
                  <Badge variant="secondary">fast pacing</Badge>
                  <Badge variant="secondary">loopable</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block size-4 rounded-sm bg-brand" />
            InspoMe
          </div>
          <nav className="flex items-center gap-5 text-sm text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
