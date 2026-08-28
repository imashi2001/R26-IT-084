/** Dark-theme UI tokens for Bin Status page (matches dashboard shell). */

export const inputClass =
  "mt-1 w-full rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/40 disabled:opacity-50";

export const selectClass =
  "mt-1 w-full rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/40 disabled:opacity-50";

export const labelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-slate-500";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow-brand hover:bg-brand-500 disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800/80 disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/40 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-brand-500/30 hover:text-brand-400 disabled:opacity-50";

export function fillBadgeClass(tierKey) {
  switch (tierKey) {
    case "overflow":
      return "border-red-500/30 bg-red-500/15 text-red-400";
    case "half":
      return "border-amber-500/30 bg-amber-500/15 text-amber-400";
    case "empty":
      return "border-brand-500/30 bg-brand-500/15 text-brand-400";
    default:
      return "border-slate-600/50 bg-slate-800/50 text-slate-400";
  }
}

export function statusBadgeClass(status) {
  switch ((status || "").toLowerCase()) {
    case "active":
      return "border-brand-500/30 bg-brand-500/15 text-brand-400";
    case "maintenance":
      return "border-amber-500/30 bg-amber-500/15 text-amber-400";
    case "inactive":
      return "border-slate-600/50 bg-slate-800/50 text-slate-400";
    default:
      return "border-slate-600/50 bg-slate-800/50 text-slate-400";
  }
}

export function riskBadgeClass(level) {
  switch ((level || "").toUpperCase()) {
    case "CRITICAL":
      return "border-red-500/40 bg-red-500/20 text-red-300";
    case "HIGH":
      return "border-red-500/30 bg-red-500/15 text-red-400";
    case "MEDIUM":
      return "border-amber-500/30 bg-amber-500/15 text-amber-400";
    case "LOW":
      return "border-brand-500/30 bg-brand-500/15 text-brand-400";
    default:
      return "border-slate-600/50 bg-slate-800/50 text-slate-400";
  }
}

export function bannerTone(tone) {
  switch (tone) {
    case "red":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "amber":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "brand":
      return "border-brand-500/30 bg-brand-500/10 text-brand-300";
    default:
      return "border-slate-700/60 bg-slate-900/60 text-slate-300";
  }
}

export function summaryTone(tone) {
  switch (tone) {
    case "brand":
      return "border-brand-500/25 bg-brand-500/10 text-brand-300";
    case "amber":
      return "border-amber-500/25 bg-amber-500/10 text-amber-300";
    case "risk":
      return "border-red-500/25 bg-red-500/10 text-red-300";
    default:
      return "border-slate-700/50 bg-slate-900/50 text-slate-300";
  }
}
