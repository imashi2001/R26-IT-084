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
    },
  };
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
  formatBinCode,
};
