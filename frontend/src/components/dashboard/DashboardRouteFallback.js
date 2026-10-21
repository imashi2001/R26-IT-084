import PageSkeleton from "./PageSkeleton";

/** Lightweight loading shell — avoids mounting full DashboardLayout during lazy load. */
export default function DashboardRouteFallback() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0b131e] font-sans text-slate-200">
      <div className="pointer-events-none fixed inset-0 bg-dashboard-radial" aria-hidden />
      <div className="relative flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6">
        <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading dashboard…
        </div>
        <PageSkeleton rows={3} />
      </div>
    </div>
  );
}
