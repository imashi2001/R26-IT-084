"use client";
/** Normalize backend fill_level strings for comparisons / CSS modifiers. */
export function normalizeFill(level) {
  return (level || "").trim().toLowerCase();
}

/**
 * Infer empty/half/overflow from stored fill_percentage (risk-derived or future numeric fill).
 * Bands align with map marker coloring.
 */
export function tierFromFillPercentage(pct) {
  const p = Number(pct);
  if (!Number.isFinite(p)) return null;
  if (p < 40) return "empty";
  if (p < 70) return "half";
  return "overflow";
}

/** Prefer explicit latest_fill_level; otherwise infer from latest_fill_percentage. */
export function effectiveFillTier(binLike) {
  const lvl = normalizeFill(binLike.latest_fill_level);
  if (lvl === "empty" || lvl === "half" || lvl === "overflow") return lvl;
  const inferred = tierFromFillPercentage(binLike.latest_fill_percentage);
  if (inferred) return inferred;
  return lvl || "unknown";
}

export function fillLabel(level) {
  const k = normalizeFill(level);
  if (!k) return "Unknown";
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export function fillColor(level) {
  const key = (level || "").toLowerCase();
  if (key === "overflow") return "#f87171";
  if (key === "half") return "#fbbf24";
  if (key === "empty") return "#34d399";
  return "#818cf8";
}

export function markerFillFromBin(binLike) {
  const tier = effectiveFillTier(binLike);
  if (tier !== "unknown") return fillColor(tier);
  return "#818cf8";
}
