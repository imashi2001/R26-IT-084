/** Client-side litter severity helpers (mirrors backend streak logic). */

export const ADD_BIN_STREAK = 3;

export function normalizeSeverity(sev) {
  return (sev || "").toString().trim().toUpperCase();
}

export function isHighSeverity(sev) {
  return normalizeSeverity(sev) === "HIGH";
}

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

function trailingStreak(captures, predicate, max = ADD_BIN_STREAK) {
  let n = 0;
  for (const c of captures || []) {
    if (!predicate(c)) break;
    n += 1;
    if (n >= max) break;
  }
  return n;
}

export function trailingHighLitterStreak(captures) {
  return trailingStreak(captures, (c) => isHighSeverity(c.litter_severity));
}

export function trailingLitteringEventStreak(captures) {
  return trailingStreak(
    captures,
    (c) => Boolean(c.littering_event_detected)
  );
}

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

export function formatLsi(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}

export function countHighLitterSites(devices = []) {
  return (devices || []).filter((d) =>
    isHighSeverity(d.latest_litter_severity)
  ).length;
}
