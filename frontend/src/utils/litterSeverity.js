/**
 * Client-side litter severity helpers (mirrors backend streak logic).
 *
 * Same rules as backend/services/litterSeverityUtils.js, so the dashboard can
 * show badges and "Add a new bin" hints without another API call. Keep the
 * two files in step if a rule changes.
 */

/** HIGH readings in a row before "Add a new bin" is suggested. */
export const ADD_BIN_STREAK = 3;

/** " high " / "High" / null → "HIGH" / "" so comparisons never fail on case or spaces. */
export function normalizeSeverity(sev) {
  return (sev || "").toString().trim().toUpperCase();
}

export function isHighSeverity(sev) {
  return normalizeSeverity(sev) === "HIGH";
}

/**
 * Label + colour tone for a severity badge. Accepts a bin (latest_litter_severity)
 * or a single capture (litter_severity). tone: danger = red, warn = amber,
 * ok = green, muted = grey (no reading yet).
 */
export function litterSeverityMeta(deviceOrCapture) {
  const sev = normalizeSeverity(
    deviceOrCapture?.latest_litter_severity ??
      deviceOrCapture?.litter_severity ??
      ""
  );
  if (sev === "HIGH") {
    return { label: "HIGH", tone: "danger" };
  }
  if (sev === "MEDIUM") {
    return { label: "MEDIUM", tone: "warn" };
  }
  if (sev === "LOW") {
    return { label: "LOW", tone: "ok" };
  }
  return { label: "—", tone: "muted" };
}

/**
 * Count how many of the newest captures in a row pass a test (stops at the first miss).
 * Example: [HIGH, HIGH, LOW, HIGH] → 2.
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

/** How many of the newest captures in a row had HIGH litter. */
export function trailingHighLitterStreak(captures) {
  return trailingStreak(captures, (c) => isHighSeverity(c.litter_severity));
}

/** How many of the newest captures in a row caught someone littering. */
export function trailingLitteringEventStreak(captures) {
  return trailingStreak(
    captures,
    (c) => Boolean(c.littering_event_detected)
  );
}

/** "Add a new bin here": last 3 captures all HIGH litter, or all caught littering. */
export function qualifiesForAddBinAlert(captures) {
  return (
    trailingHighLitterStreak(captures) >= ADD_BIN_STREAK ||
    trailingLitteringEventStreak(captures) >= ADD_BIN_STREAK
  );
}

/** Captures for one device, newest first. */
export function capturesForDevice(captures, deviceId, limit = ADD_BIN_STREAK) {
  if (deviceId == null) return [];
  return (captures || [])
    .filter((c) => c.device_id === deviceId)
    .slice(0, limit);
}

/** LSI score for display: 57.234 → "57.2", missing → "—". */
export function formatLsi(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

/** Number of bins whose latest reading is HIGH (dashboard KPI). */
export function countHighLitterSites(devices = []) {
  return (devices || []).filter((d) =>
    isHighSeverity(d.latest_litter_severity)
  ).length;
}
