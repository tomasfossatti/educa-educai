export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8" aria-busy="true" aria-live="polite">
      <div className="h-6 w-48 animate-pulse rounded bg-line" />
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-subtle" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-subtle" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-subtle" />
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
