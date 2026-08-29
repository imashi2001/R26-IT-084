"use client";
/**
 * Heuristic ordering for municipal waste collection scheduling.
 *
 * Higher score => empty this bin sooner. Uses fill tier + numeric estimate +
 * latest hygienic risk from GET /devices/map pins.
 *
 * This is transparent rule logic (not ML), consistent with the rest of the app.
 */

import { effectiveFillTier } from "./fillTier";

export function collectionUrgency(bin) {
  const tier = effectiveFillTier(bin);
  const pct = Number(bin.latest_fill_percentage);
  const risk = String(bin.latest_risk_level || "").toUpperCase();

  let score = 0;
  if (tier === "overflow") {
    score =
      85 +
      (Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) * 0.15 : 0);
  } else if (tier === "half") {
    score = 40 + (Number.isFinite(pct) ? pct * 0.45 : 20);
  } else if (tier === "empty") {
    score = 8 + (Number.isFinite(pct) ? pct * 0.25 : 0);
  } else {
    score = 22 + (Number.isFinite(pct) ? pct * 0.35 : 0);
  }

  if (risk === "CRITICAL") score += 35;
  else if (risk === "HIGH") score += 25;
  else if (risk === "MEDIUM") score += 12;

  return Math.round(score * 10) / 10;
}

/** Bin should appear on the "collect as soon as possible" shortlist. */
export function needsCollectionSoon(bin) {
  const tier = effectiveFillTier(bin);
  const risk = String(bin.latest_risk_level || "").toUpperCase();
  const pct = Number(bin.latest_fill_percentage);

  if (tier === "overflow") return true;
  if (risk === "HIGH" || risk === "CRITICAL") return true;
  if (Number.isFinite(pct) && pct >= 72) return true;
  if (tier === "half" && Number.isFinite(pct) && pct >= 68) return true;
  if (risk === "MEDIUM" && Number.isFinite(pct) && pct >= 55) return true;

  return collectionUrgency(bin) >= 62;
}

export function sortBinsByCollectionUrgency(bins) {
  return [...bins].sort(
    (a, b) => collectionUrgency(b) - collectionUrgency(a)
  );
}

export function urgencyBand(score) {
  if (score >= 95) return { label: "Critical", className: "bg-red-100 text-red-800 border-red-200" };
  if (score >= 75) return { label: "High", className: "bg-amber-50 text-amber-800 border-amber-200" };
  if (score >= 55) return { label: "Elevated", className: "bg-slate-100 text-ink-800 border-slate-200" };
  return { label: "Routine", className: "bg-brand-50 text-brand-800 border-brand-200" };
}
