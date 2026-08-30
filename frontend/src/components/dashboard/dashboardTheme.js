/** Shared layout tokens for dashboard grids and panels. */

export const LAYOUT = {
  page: "mx-auto flex w-full max-w-[1680px] flex-col gap-5",
  kpiGrid:
    "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5",
  opsGrid:
    "grid grid-cols-1 items-stretch gap-5 xl:grid-cols-12 xl:min-h-[30rem]",
  analyticsGrid:
    "grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12 lg:min-h-[24rem]",
};

export const CHART = {
  grid: "#1e293b",
  axis: "#64748b",
  tooltip: {
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#e2e8f0",
    fontSize: 12,
  },
};

export const MAP_TILE_DARK =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export const badge = {
  live: "inline-flex items-center gap-1 rounded-full border border-brand-500/40 bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-400 shadow-glow-brand",
  stale:
    "inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400",
  brand:
    "rounded-full border border-brand-500/30 bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-400",
  warn: "rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400",
  danger:
    "rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400",
  info: "rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-400",
};

export const alertTone = {
  high: {
    bg: "bg-red-500/10 border border-red-500/20",
    fg: "text-red-300",
    ring: "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.45)]",
  },
  warn: {
    bg: "bg-amber-500/10 border border-amber-500/20",
    fg: "text-amber-300",
    ring: "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.35)]",
  },
  info: {
    bg: "bg-sky-500/10 border border-sky-500/20",
    fg: "text-sky-300",
    ring: "bg-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.35)]",
  },
  ok: {
    bg: "bg-brand-500/10 border border-brand-500/20",
    fg: "text-brand-300",
    ring: "bg-brand-500 shadow-[0_0_12px_rgba(34,197,94,0.35)]",
  },
};

export const tierBadge = {
  Empty: "border-brand-500/30 bg-brand-500/15 text-brand-400",
  Half: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  Overflow: "border-red-500/30 bg-red-500/15 text-red-400",
};

/** Page-level typography and layout tokens. */
export const PAGE = {
  title: "text-2xl font-bold tracking-tight text-slate-100",
  subtitle: "mt-0.5 max-w-3xl text-sm text-slate-400",
  sectionGap: "flex flex-col gap-5",
};

export const filterBar =
  "flex flex-wrap items-end gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3 md:p-4";

export const listRow =
  "rounded-xl border border-slate-700/50 bg-slate-950/40 p-3 transition hover:border-slate-600/60 md:p-4";

export const listRowCompact =
  "rounded-lg border border-slate-700/40 bg-slate-950/30 px-3 py-2 transition hover:border-slate-600/50";

export const emptyState =
  "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/50 bg-slate-950/30 px-6 py-12 text-center";

export const skeletonPulse =
  "animate-pulse rounded-xl border border-slate-700/40 bg-slate-900/60";

/** Standard dark map basemap — use everywhere instead of Voyager light. */
export const MAP_TILE = MAP_TILE_DARK;
