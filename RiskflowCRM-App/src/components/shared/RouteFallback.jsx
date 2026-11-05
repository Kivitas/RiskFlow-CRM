export default function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="w-full min-h-[60vh] p-6 md:p-8 animate-pulse"
    >
      <div className="h-8 w-56 rounded-lg bg-slate-200 mb-3" />
      <div className="h-4 w-80 max-w-full rounded bg-slate-100 mb-8" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-slate-100" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
