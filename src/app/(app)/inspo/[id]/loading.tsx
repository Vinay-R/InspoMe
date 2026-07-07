export default function InspoDetailLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true">
      {/* Back link */}
      <div className="h-4 w-16 rounded bg-muted" />

      {/* Media header: thumbnail + meta */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-[200px_1fr]">
          <div className="aspect-[9/12] bg-secondary sm:aspect-auto sm:min-h-64" />
          <div className="flex flex-col gap-3 p-5">
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded-full bg-muted" />
              <div className="h-5 w-24 rounded-full bg-muted" />
            </div>
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="mt-auto h-4 w-40 rounded bg-muted" />
          </div>
        </div>
      </div>

      {/* Section cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="mt-4 flex flex-col gap-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-5/6 rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
          </div>
          <div className="mt-4 flex gap-1.5">
            <div className="h-5 w-20 rounded-full bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
            <div className="h-5 w-24 rounded-full bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
