/**
 * Unified fill resolution for smart (capture) and virtual (manual) bins.
 */

const { deriveFillLevel } = require("./fillLevel");

function normalizeBinType(raw) {
  const t = String(raw ?? "smart").trim().toLowerCase();
  return t === "virtual" ? "virtual" : "smart";
}

function normalizeManualFillLevel(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (s === "Empty" || s === "Half" || s === "Overflow") return s;
  const lower = s.toLowerCase();
  if (lower === "empty") return "Empty";
  if (lower === "half") return "Half";
  if (lower === "overflow") return "Overflow";
  return null;
}

function isVirtualDevice(device) {
  return normalizeBinType(device?.bin_type) === "virtual";
}

function inferredFillLevelFromPercentage(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const p = Number(pct);
  if (p < 40) return "Empty";
  if (p < 70) return "Half";
  return "Overflow";
}

function resolveSmartFillLevel({ latestCap, mem }) {
  if (latestCap?.fill_level) return latestCap.fill_level;

  const capPreds = latestCap?.predictions;
  if (Array.isArray(capPreds) && capPreds.length > 0) {
    const shaped = capPreds.map((p) => ({
      label: p.label,
      confidence: Number(p.confidence),
    }));
    const fromPred = deriveFillLevel(shaped);
    if (fromPred) return fromPred;
  }

  const pct =
    latestCap?.fill_percentage != null
      ? latestCap.fill_percentage
      : mem?.extras?.fill_percentage ?? null;
  const fromPct = inferredFillLevelFromPercentage(pct);
  if (fromPct) return fromPct;

  if (mem?.predictions?.length) {
    const fromMem = deriveFillLevel(mem.predictions);
    if (fromMem) return fromMem;
  }

  return null;
}

function resolveSmartFillPercentage({ latestCap, mem }) {
  if (latestCap?.fill_percentage != null) return latestCap.fill_percentage;
  if (mem?.extras?.fill_percentage != null) return mem.extras.fill_percentage;
  return null;
}

function resolveDeviceFillLevel(device, { latestCap, mem } = {}) {
  if (isVirtualDevice(device)) {
    return normalizeManualFillLevel(device.manual_fill_level);
  }
  return resolveSmartFillLevel({ latestCap, mem });
}

function resolveDeviceFillPercentage(device, { latestCap, mem } = {}) {
  if (isVirtualDevice(device)) {
    if (device.manual_fill_percentage != null) {
      const p = Number(device.manual_fill_percentage);
      return Number.isFinite(p) ? p : null;
    }
    const lvl = normalizeManualFillLevel(device.manual_fill_level);
    if (lvl === "Empty") return 15;
    if (lvl === "Half") return 55;
    if (lvl === "Overflow") return 90;
    return null;
  }
  return resolveSmartFillPercentage({ latestCap, mem });
}

function normalizeFillTier(level) {
  return (level || "").trim().toLowerCase();
}

function effectiveFillTier(binLike) {
  if (isVirtualDevice(binLike)) {
    const manual = normalizeFillTier(
      binLike.manual_fill_level || binLike.latest_fill_level
    );
    if (manual === "empty" || manual === "half" || manual === "overflow") {
      return manual;
    }
  }
  const lvl = normalizeFillTier(binLike.latest_fill_level);
  if (lvl === "empty" || lvl === "half" || lvl === "overflow") return lvl;
  const pct = Number(binLike.latest_fill_percentage);
  if (Number.isFinite(pct)) {
    if (pct < 40) return "empty";
    if (pct < 70) return "half";
    return "overflow";
  }
  return lvl || "unknown";
}

/**
 * Validate and normalize bin_type / manual fill fields for create or patch.
 * Mutates payload in place. Returns error string or null.
 */
function applyBinTypePayload(body, payload, { isPatch = false } = {}) {
  const effectiveType =
    body.bin_type !== undefined
      ? normalizeBinType(body.bin_type)
      : isPatch
        ? normalizeBinType(payload.bin_type)
        : "smart";

  if (body.bin_type !== undefined || !isPatch) {
    payload.bin_type = effectiveType;
  }

  if (effectiveType === "virtual") {
    if (body.manual_fill_level !== undefined || !isPatch) {
      const lvl = normalizeManualFillLevel(body.manual_fill_level);
      if (!lvl) {
        return "manual_fill_level is required for virtual bins (Empty, Half, or Overflow)";
      }
      payload.manual_fill_level = lvl;
    } else if (isPatch && payload.manual_fill_level == null) {
      return "manual_fill_level is required for virtual bins";
    }

    if (body.manual_fill_percentage !== undefined) {
      if (
        body.manual_fill_percentage === "" ||
        body.manual_fill_percentage == null
      ) {
        payload.manual_fill_percentage = null;
      } else {
        const p = Number(body.manual_fill_percentage);
        if (!Number.isFinite(p) || p < 0 || p > 100) {
          return "manual_fill_percentage must be between 0 and 100";
        }
        payload.manual_fill_percentage = p;
      }
    }

    payload.esp32_id = null;
    payload.bridge_instance_id = null;
    payload.camera_base_url = null;
  } else if (effectiveType === "smart") {
    if (body.bin_type !== undefined || !isPatch) {
      payload.manual_fill_level = null;
      payload.manual_fill_percentage = null;
    }
  }

  return null;
}

function validateVirtualCoordinates(payload) {
  if (normalizeBinType(payload.bin_type) !== "virtual") return null;
  if (
    payload.latitude == null ||
    payload.longitude == null ||
    !Number.isFinite(Number(payload.latitude)) ||
    !Number.isFinite(Number(payload.longitude))
  ) {
    return "Virtual bins require valid latitude and longitude";
  }
  return null;
}

module.exports = {
  normalizeBinType,
  normalizeManualFillLevel,
  isVirtualDevice,
  resolveSmartFillLevel,
  resolveSmartFillPercentage,
  resolveDeviceFillLevel,
  resolveDeviceFillPercentage,
  effectiveFillTier,
  applyBinTypePayload,
  validateVirtualCoordinates,
};
