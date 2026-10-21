/**
 * Frontend-only derivation of a 0-100 risk score from the qualitative risk
 * level + supporting signals (rotting hours, temp, humidity, animal count).
 *
 * Bands locked in the dashboard spec:
 *   LOW       10 - 30   (lower rotting_hours -> higher score)
 *   MEDIUM    40 - 65   (high temp OR high humidity bumps within band)
 *   HIGH      70 - 90   (animal count + organic + heat bumps within band)
 *   CRITICAL  95 - 100  (reserved; the engine doesn't emit CRITICAL yet)
 *
 * The risk engine itself stays untouched; this lives purely in the UI.
 */

const HIGH_TEMP_C = 30;
const HIGH_HUMIDITY_PCT = 70;

function clamp(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function scoreLow(extras) {
  const r = Number(extras?.rotting_hours);
  if (!Number.isFinite(r)) return 20;
  // 24h+ -> 10 (very safe), 0h -> 30 (worst LOW)
  const t = clamp(1 - r / 24, 0, 1);
  return Math.round(10 + t * 20);
}

function scoreMedium(extras) {
  const temp = Number(extras?.temp_c);
  const hum = Number(extras?.humidity_pct);
  let bump = 0;
  if (Number.isFinite(temp) && temp >= HIGH_TEMP_C) bump += 12;
  if (Number.isFinite(hum) && hum >= HIGH_HUMIDITY_PCT) bump += 12;
  return Math.round(clamp(40 + bump, 40, 65));
}

function scoreHigh(extras) {
  const animals = Number(extras?.animal_count) || 0;
  const isOrganic =
    String(extras?.waste_label || "").toLowerCase() === "organic";
  const temp = Number(extras?.temp_c);
  const isHot = Number.isFinite(temp) && temp >= HIGH_TEMP_C;

  let bump = 0;
  if (animals > 0) bump += Math.min(8, animals * 4);
  if (isOrganic) bump += 6;
  if (isHot) bump += 6;
  return Math.round(clamp(70 + bump, 70, 90));
}

/**
 * Returns a number in 0..100 plus a band label and a Tailwind tone hint.
 * If `level` is missing/unknown, returns null so the card renders an empty state.
 */
export default function computeRiskScore(extras) {
  if (!extras) return null;
  const lvl = String(extras.risk_level || "").toUpperCase();

  if (lvl === "LOW") return { score: scoreLow(extras), band: "LOW", tone: "low" };
  if (lvl === "MEDIUM") return { score: scoreMedium(extras), band: "MEDIUM", tone: "medium" };
  if (lvl === "HIGH") return { score: scoreHigh(extras), band: "HIGH", tone: "high" };
  if (lvl === "CRITICAL") return { score: 98, band: "CRITICAL", tone: "critical" };
  return null;
}

export const RISK_TONE = {
  low: {
    ring: "#22c55e",
    chipBg: "bg-brand-500/15 border border-brand-500/30",
    chipFg: "text-brand-400",
    barBg: "bg-brand-500",
    trackBg: "bg-slate-700/80",
  },
  medium: {
    ring: "#f59e0b",
    chipBg: "bg-amber-500/15 border border-amber-500/30",
    chipFg: "text-amber-400",
    barBg: "bg-amber-500",
    trackBg: "bg-slate-700/80",
  },
  high: {
    ring: "#ef4444",
    chipBg: "bg-red-500/15 border border-red-500/30",
    chipFg: "text-red-400",
    barBg: "bg-red-500",
    trackBg: "bg-slate-700/80",
  },
  critical: {
    ring: "#f87171",
    chipBg: "bg-red-600/20 border border-red-500/40",
    chipFg: "text-red-300",
    barBg: "bg-red-600",
    trackBg: "bg-slate-700/80",
  },
};
