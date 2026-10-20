/** Display helpers for the Litter Insights page. */

export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const BIN_STATUS_META = {
  persistent: {
    label: "Needs action",
    pill: "border-red-500/30 bg-red-500/15 text-red-300",
    hint: "Last 3 readings MEDIUM or HIGH",
  },
  watch: {
    label: "Watch",
    pill: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    hint: "Latest reading MEDIUM or HIGH",
  },
  recovered: {
    label: "Cleaned",
    pill: "border-sky-500/30 bg-sky-500/15 text-sky-300",
    hint: "Back to LOW after elevated litter",
  },
  clean: {
    label: "Clean",
    pill: "border-brand-500/30 bg-brand-500/15 text-brand-300",
    hint: "Recent readings LOW",
  },
  unknown: {
    label: "No data",
    pill: "border-slate-600/50 bg-slate-800/50 text-slate-400",
    hint: "No LSI readings in range",
  },
};

export const TREND_META = {
  rising: { label: "Rising", className: "text-red-300", arrow: "↑" },
  falling: { label: "Falling", className: "text-brand-300", arrow: "↓" },
  stable: { label: "Stable", className: "text-slate-300", arrow: "→" },
  unknown: { label: "—", className: "text-slate-500", arrow: "" },
};

export function binStatusMeta(status) {
  return BIN_STATUS_META[status] || BIN_STATUS_META.unknown;
}

export function trendMeta(trend) {
  return TREND_META[trend] || TREND_META.unknown;
}

/** Marker colour for an LSI value (LOW ≤ 30 < MEDIUM ≤ 53 < HIGH). */
export function lsiColor(lsi) {
  const v = Number(lsi);
  if (lsi == null || !Number.isFinite(v)) return "#64748b";
  if (v > 53) return "#ef4444";
  if (v > 30) return "#f59e0b";
  return "#22c55e";
}

/** Map marker radius: bigger for dirtier, more active bins. */
export function hotspotRadius(bin) {
  const lsi = Number(bin?.avg_lsi) || 0;
  const events = Number(bin?.littering_confirmed) || 0;
  return Math.round(Math.min(28, 8 + lsi / 5 + events * 2));
}

/** Heatmap cell score: confirmed littering counts double over HIGH litter readings. */
export function heatScore(cell) {
  return (Number(cell?.events) || 0) * 2 + (Number(cell?.high) || 0);
}

export function heatColor(score, maxScore) {
  if (!score || !maxScore) return "rgba(30, 41, 59, 0.55)";
  const ratio = Math.min(1, score / maxScore);
  const alpha = 0.18 + ratio * 0.72;
  return `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
}

export function maxHeatScore(heatmap) {
  let max = 0;
  for (const row of heatmap || []) {
    for (const cell of row || []) max = Math.max(max, heatScore(cell));
  }
  return max;
}

export function formatHour(h) {
  const hour = Number(h);
  if (!Number.isFinite(hour)) return "—";
  const suffix = hour < 12 ? "am" : "pm";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${suffix}`;
}

export function describePeak(peak) {
  if (!peak) return null;
  const end = (peak.hour + 1) % 24;
  return `${DOW_LABELS[peak.dow]} ${formatHour(peak.hour)}–${formatHour(end)}`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Outline points ([[x, y]] fractions) → SVG "x,y" list in a 0–1000 viewBox. */
export function polygonToSvgPoints(points) {
  return (points || [])
    .map(([x, y]) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`)
    .join(" ");
}

/** Click position on an element → [x, y] fractions clamped to 0–1. */
export function clickToFraction(clientX, clientY, rect) {
  if (!rect || !rect.width || !rect.height) return null;
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const x = clamp((clientX - rect.left) / rect.width);
  const y = clamp((clientY - rect.top) / rect.height);
  return [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000];
}

export function pct(value) {
  return value == null || !Number.isFinite(Number(value)) ? "—" : `${Number(value).toFixed(0)}%`;
}
