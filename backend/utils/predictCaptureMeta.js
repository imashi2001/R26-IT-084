/**
 * Derive dashboard-friendly summary fields for persisted captures.
 */

function normalizeExplicitSourceType(body) {
  const raw = (body?.source_type || "").toString().trim().toLowerCase();
  if (raw === "esp32" || raw === "mobile" || raw === "admin") return raw;
  return "";
}

function inferSourceType(body) {
  const explicit = normalizeExplicitSourceType(body);
  if (explicit) return explicit;
  const hasEsp =
    body?.esp32_id != null && String(body.esp32_id).trim() !== "";
  const hasBridge =
    body?.bridge_instance_id != null &&
    String(body.bridge_instance_id).trim() !== "";
  if (hasEsp || hasBridge) return "esp32";
  return "mobile";
}

function deriveFillPercentage(risk) {
  if (!risk || risk.level == null) return null;
  const key = String(risk.level).trim().toUpperCase();
  const map = {
    LOW: 25,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 95,
  };
  return map[key] != null ? map[key] : null;
}

function derivePredictionClass(waste, animalCount, risk) {
  if (waste && !waste.error && waste.label)
    return String(waste.label).slice(0, 160);
  const n = Number(animalCount) || 0;
  if (n > 0) return `animal:${n}`;
  if (risk?.level) return `risk:${String(risk.level).slice(0, 80)}`;
  return null;
}

module.exports = {
  inferSourceType,
  deriveFillPercentage,
  derivePredictionClass,
};
