import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — InspoMe",
  description: "Plain-language overview of what data InspoMe stores and why.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
      <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight">
        <span className="inline-block size-6 rounded-md bg-brand" />
        InspoMe
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: July 2026</p>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-semibold">The short version</h2>
          <p className="mt-2 text-muted-foreground">
            We store what&apos;s needed to run your library and nothing we
            don&apos;t need. We don&apos;t sell your data. This is a
            plain-language overview for an early product; we&apos;ll expand it
            before general availability.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">What we store</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground">Your account:</span> email
              address and the answers you give during onboarding (niche, goals,
              platforms).
            </li>
            <li>
              <span className="text-foreground">Saved URLs:</span> the TikTok
              and Instagram links you save, plus captions and thumbnails we
              fetch for them.
            </li>
            <li>
              <span className="text-foreground">Analysis output:</span> the
              AI-generated breakdown of each video you save.
            </li>
            <li>
              <span className="text-foreground">Connected accounts
              (optional):</span> if you connect a social account for analytics,
              we store its access tokens encrypted at rest, used only to fetch
              your own analytics.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">How analysis works</h2>
          <p className="mt-2 text-muted-foreground">
            When you save a link, we download the video and send it to an AI
            model (currently Google Gemini) to produce the analysis. The video
            itself isn&apos;t kept in our storage after processing — we keep
            the analysis output.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Where your data lives</h2>
          <p className="mt-2 text-muted-foreground">
            Data is stored in Supabase (Postgres) with row-level security, so
            your library is only readable by your account. Credentials for
            third-party services never leave our servers.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Deleting your data</h2>
          <p className="mt-2 text-muted-foreground">
            You can archive inspo from the app at any time. To delete your
            account and everything tied to it, email us and we&apos;ll do it
            promptly.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Contact</h2>
          <p className="mt-2 text-muted-foreground">
            Questions about your data:{" "}
            <a href="mailto:vinayr787@gmail.com" className="text-foreground underline underline-offset-4">
              vinayr787@gmail.com
            </a>
          </p>
        </section>
      </div>

      <nav className="mt-12 flex items-center gap-5 border-t border-border pt-6 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <Link href="/terms" className="hover:text-foreground">Terms</Link>
        <Link href="/login" className="hover:text-foreground">Sign in</Link>
      </nav>
    </main>
  );
}
