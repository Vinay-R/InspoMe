import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-16 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full bg-brand/15 text-brand">
        <SearchX className="size-6" />
      </div>
      <div className="max-w-sm">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The link may be old, or the inspo it pointed to was archived.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Link
          href="/library"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand/90"
        >
          Go to your library
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
