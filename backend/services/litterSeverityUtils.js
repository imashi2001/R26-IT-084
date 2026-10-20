/**
 * Litter severity (LSI) helpers — streak detection and capture extras.
 */

const ADD_BIN_STREAK = 3;

function normalizeSeverity(sev) {
  return (sev || "").toString().trim().toUpperCase();
}

function isHighSeverity(sev) {
  return normalizeSeverity(sev) === "HIGH";
}

function litterSeverityExtras(litterPayload) {
  if (!litterPayload || litterPayload.error) {
    return {
      litter_severity: null,
      litter_lsi: null,
      litter_detection_count: null,
      litter_severity_summary: null,
    };
  }
  const severity = normalizeSeverity(litterPayload.severity) || null;
  const lsi = Number(litterPayload.lsi);
  const count =
    Number(litterPayload.detection_count) ||
    Number(litterPayload.metrics?.count) ||
    (Array.isArray(litterPayload.detections)
      ? litterPayload.detections.length
      : 0);
  return {
    litter_severity: severity,
    litter_lsi: Number.isFinite(lsi) ? lsi : null,
    litter_detection_count: count,
    litter_severity_summary: {
      severity,
      lsi: Number.isFinite(lsi) ? lsi : null,
      detection_count: count,
      metrics: litterPayload.metrics || null,
      model: litterPayload.model || "litter_severity",
      bin_polygon_applied: Boolean(litterPayload.bin_polygon_applied),
      ignored_inside_bin: Number(litterPayload.ignored_inside_bin) || 0,
    },
  };
}

/**
 * Early warning: has LSI climbed by at least `delta` from the lowest earlier
 * reading in `points` (same bin, recent window)? Only MEDIUM qualifies — HIGH
 * already has its own alert and LOW is not worth escalating.
 * @param {Array<{ captured_at: any, litter_lsi: number }>} points earlier readings
 * @returns {null | { from_lsi, to_lsi, rise, from_at }}
 */
function detectLitterRise(points, current, { delta = 20 } = {}) {
  const sev = normalizeSeverity(current?.severity);
  const to = Number(current?.lsi);
  if (sev !== "MEDIUM" || !Number.isFinite(to)) return null;

  let low = null;
  for (const p of points || []) {
    const v = Number(p?.litter_lsi);
    if (!Number.isFinite(v)) continue;
    if (!low || v < low.lsi) low = { lsi: v, at: p.captured_at };
  }
  if (!low) return null;
  const rise = to - low.lsi;
  if (rise < delta) return null;
  return { from_lsi: low.lsi, to_lsi: to, rise, from_at: low.at };
}

/**
 * Count trailing consecutive captures matching a predicate (newest first).
 */
function trailingStreak(captures, predicate, max = ADD_BIN_STREAK) {
  let n = 0;
  for (const c of captures || []) {
    if (!predicate(c)) break;
    n += 1;
    if (n >= max) break;
  }
  return n;
}

function trailingHighLitterStreak(captures) {
  return trailingStreak(captures, (c) => isHighSeverity(c.litter_severity));
}

function trailingLitteringEventStreak(captures) {
  return trailingStreak(
    captures,
    (c) =>
      Boolean(c.littering_event_detected) &&
      (Number(c.littering_max_confidence) || 0) >= 0.5
  );
}

function qualifiesForAddBinAlert(captures) {
  return (
    trailingHighLitterStreak(captures) >= ADD_BIN_STREAK ||
    trailingLitteringEventStreak(captures) >= ADD_BIN_STREAK
  );
}

function formatBinCode(deviceId) {
  if (deviceId == null) return "BIN—";
  const num = Number(deviceId);
  if (!Number.isFinite(num)) return String(deviceId);
  return `BIN-${String(num).padStart(2, "0")}`;
}

module.exports = {
  ADD_BIN_STREAK,
  normalizeSeverity,
  isHighSeverity,
  litterSeverityExtras,
  trailingHighLitterStreak,
  trailingLitteringEventStreak,
  qualifiesForAddBinAlert,
  detectLitterRise,
  formatBinCode,
};
