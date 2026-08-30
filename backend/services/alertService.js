const { LITTERING_ALERT_CONFIDENCE } = require("../config/env");
const { Op } = require("sequelize");

const db = require("../config/db");
const modelsRegistry = require("../models");

const STATUSES = new Set([
  "open",
  "acknowledged",
  "actioned",
  "rejected",
  "dismissed",
]);

function ensureModels() {
  if (!db.isDbEnabled()) return null;
  return modelsRegistry.getModels() || modelsRegistry.init();
}

/**
 * Classify a capture into at most one alert (highest-priority reason).
 * @returns {null | { alert_type, severity, title, summary }}
 */
function classifyCaptureForAlert(c) {
  const risk = String(c.risk_level || "").toUpperCase();
  const animals = Number(c.animal_count) || 0;
  const fill = String(c.fill_level || "").trim();
  const fillLower = fill.toLowerCase();
  const pct = Number(c.fill_percentage);
  const waste = c.waste_label ? String(c.waste_label) : "—";

  if (risk === "CRITICAL") {
    return {
      alert_type: "risk_critical",
      severity: "critical",
      title: "Critical hygienic risk",
      summary: `Case ${c.risk_case || "—"} · waste ${waste} · ${animals} animal(s) · rotting ~${c.rotting_hours != null ? `${Number(c.rotting_hours).toFixed(1)}h` : "—"}`,
    };
  }
  if (risk === "HIGH") {
    return {
      alert_type: "risk_high",
      severity: "critical",
      title: "High hygienic risk",
      summary: `Case ${c.risk_case || "—"} · waste ${waste} · ${animals} animal(s)`,
    };
  }
  if (animals > 0 && risk === "MEDIUM") {
    return {
      alert_type: "buzzer",
      severity: "warning",
      title: "Deterrence threshold (buzzer)",
      summary: `MEDIUM risk with ${animals} animal detection(s) — buzzer policy would arm.`,
    };
  }
  const isOverflow =
    fillLower === "overflow" ||
    (Number.isFinite(pct) && pct >= 72);
  if (isOverflow) {
    const fillTxt = fill || (Number.isFinite(pct) ? `${Math.round(pct)}%` : "—");
    return {
      alert_type: "overflow",
      severity: "warning",
      title: "Bin fill near or at overflow",
      summary: `Fill level ${fillTxt}. Waste: ${waste}.`,
    };
  }
  const litteringDetected = Boolean(c.littering_event_detected);
  const litteringConf = Number(c.littering_max_confidence) || 0;
  if (litteringDetected && litteringConf >= LITTERING_ALERT_CONFIDENCE) {
    const count = Number(c.littering_event_count) || 0;
    return {
      alert_type: "littering_detected",
      severity: "warning",
      title: "Littering event detected",
      summary: `${count} littering event(s) on capture (max confidence ${(litteringConf * 100).toFixed(0)}%).`,
    };
  }
  if (animals > 0) {
    return {
      alert_type: "animal",
      severity: "info",
      title: "Animal activity near bin",
      summary: `${animals} animal detection(s) on capture. Risk ${risk || "LOW"}.`,
    };
  }
  return null;
}

/**
 * Scan recent captures and insert missing alert rows (idempotent).
 */
async function syncAlertsFromCaptures({ lookbackDays = 30, scanLimit = 400 } = {}) {
  const models = ensureModels();
  if (!models) return { created: 0 };

  const { Capture, Alert } = models;
  const since = new Date(Date.now() - lookbackDays * 86400000);

  const rows = await Capture.findAll({
    where: { captured_at: { [Op.gte]: since } },
    order: [["captured_at", "DESC"]],
    limit: scanLimit,
    attributes: [
      "id",
      "device_id",
      "captured_at",
      "risk_level",
      "risk_case",
      "animal_count",
      "fill_level",
      "fill_percentage",
      "waste_label",
      "rotting_hours",
      "littering_event_detected",
      "littering_event_count",
      "littering_max_confidence",
    ],
  });

  let created = 0;
  for (const row of rows) {
    const c = row.toJSON();
    const classified = classifyCaptureForAlert(c);
    if (!classified) continue;

    const existing = await Alert.findOne({
      where: { capture_id: c.id },
    });
    if (existing) continue;

    await Alert.create({
      capture_id: c.id,
      device_id: c.device_id,
      alert_type: classified.alert_type,
      severity: classified.severity,
      title: classified.title,
      summary: classified.summary,
      status: "open",
    });
    created += 1;
  }

  return { created };
}

async function listAlerts({ status = null, limit = 100, offset = 0 } = {}) {
  const models = ensureModels();
  if (!models) return null;

  const { Alert, Device, Capture } = models;

  const where = {};
  if (status && status !== "all" && STATUSES.has(status)) {
    where.status = status;
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  const total = await Alert.count({ where });

  const rows = await Alert.findAll({
    where,
    order: [["created_at", "DESC"]],
    limit: lim,
    offset: off,
    include: [
      {
        model: Device,
        as: "device",
        attributes: ["id", "name", "location", "address", "esp32_id"],
        required: false,
      },
      {
        model: Capture,
        as: "capture",
        attributes: [
          "id",
          "captured_at",
          "risk_level",
          "animal_count",
          "fill_level",
          "fill_percentage",
          "source_type",
        ],
        required: false,
      },
    ],
  });

  return {
    total,
    limit: lim,
    offset: off,
    rows: rows.map((r) => r.toJSON()),
  };
}

async function getStatusCounts() {
  const models = ensureModels();
  if (!models) return null;

  const { Alert, sequelize } = models;
  const rows = await Alert.findAll({
    attributes: [
      "status",
      [sequelize.fn("COUNT", sequelize.col("Alert.id")), "count"],
    ],
    group: ["status"],
    raw: true,
  });

  const out = {
    open: 0,
    acknowledged: 0,
    actioned: 0,
    rejected: 0,
    dismissed: 0,
  };
  for (const r of rows) {
    const k = r.status;
    if (Object.prototype.hasOwnProperty.call(out, k)) {
      out[k] = parseInt(r.count, 10) || 0;
    }
  }
  return out;
}

async function updateAlertStatus(
  alertId,
  { status, admin_note, userId } = {}
) {
  const models = ensureModels();
  if (!models) return null;

  const { Alert } = models;
  const id = parseInt(alertId, 10);
  if (!Number.isFinite(id)) return null;

  if (!status || !STATUSES.has(status)) {
    const err = new Error(`Invalid status. Use one of: ${[...STATUSES].join(", ")}`);
    err.status = 400;
    throw err;
  }

  const row = await Alert.findByPk(id);
  if (!row) return null;

  const patch = {
    status,
    admin_note:
      admin_note === undefined
        ? row.admin_note
        : admin_note === null || admin_note === ""
          ? null
          : String(admin_note).slice(0, 4000),
  };

  if (status !== "open") {
    patch.resolved_by_user_id = userId || null;
  } else {
    patch.resolved_by_user_id = null;
  }

  await row.update(patch);
  return row.toJSON();
}

module.exports = {
  STATUSES,
  classifyCaptureForAlert,
  syncAlertsFromCaptures,
  listAlerts,
  getStatusCounts,
  updateAlertStatus,
};
