/**
 * Collection urgency heuristics (mirrors frontend/src/utils/collectionPriority.js).
 */

const { effectiveFillTier } = require("./deviceFill");

function collectionUrgency(bin) {
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

function filterCollectionStops(bins) {
  return (bins || []).filter((b) => {
    const tier = effectiveFillTier(b);
    return tier === "half" || tier === "overflow";
  });
}

function sortCollectionStops(bins) {
  const list = [...(bins || [])];
  list.sort((a, b) => {
    const ta = effectiveFillTier(a);
    const tb = effectiveFillTier(b);
    const tierRank = (t) => (t === "overflow" ? 0 : t === "half" ? 1 : 2);
    const dr = tierRank(ta) - tierRank(tb);
    if (dr !== 0) return dr;
    return collectionUrgency(b) - collectionUrgency(a);
  });
  return list;
}

module.exports = {
  collectionUrgency,
  filterCollectionStops,
  sortCollectionStops,
  effectiveFillTier,
};
