/** Shared dark-dashboard styling tokens (VisionWaste monitoring UI). */

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
