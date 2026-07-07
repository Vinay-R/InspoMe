export default function LibraryLoading() {
  return (
    <div className="flex flex-1 flex-col gap-5" aria-busy="true">
      {/* Header row: title + add button */}
      <div className="flex animate-pulse items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-36 rounded-md bg-muted md:h-8" />
          <div className="h-4 w-52 rounded-md bg-muted" />
        </div>
        <div className="h-12 w-28 shrink-0 rounded-md bg-muted" />
      </div>

      {/* Card grid — mirrors the library card layout */}
      <ul className="grid animate-pulse grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="aspect-[9/12] w-full bg-secondary" />
            <div className="flex flex-col gap-2 p-3">
              <div className="h-3 w-32 rounded bg-muted" />
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="mt-1 flex gap-1">
                <div className="h-4 w-14 rounded-full bg-muted" />
                <div className="h-4 w-16 rounded-full bg-muted" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
