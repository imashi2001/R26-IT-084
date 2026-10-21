/**
 * GET /alerts   — list alerts (syncs from recent captures first)
 * PATCH /alerts/:id — admin: update status + optional admin_note
 */

const db = require("../config/db");
const alertService = require("../services/alertService");

async function listAlerts(req, res, next) {
  try {
    if (!db.isDbEnabled()) {
      return res.status(503).json({
        error:
          "Alerts require DATABASE_URL. Configure the backend database to enable this feature.",
      });
    }

    await alertService.syncAlertsFromCaptures({
      lookbackDays: 30,
      scanLimit: 400,
    });

    const status = req.query.status || null;
    const limit = req.query.limit;
    const offset = req.query.offset;

    const result = await alertService.listAlerts({ status, limit, offset });
    if (result === null) {
      return res.status(503).json({ error: "Database not available." });
    }

    const status_counts = await alertService.getStatusCounts();

    return res.json({
      total: result.total,
      count: result.rows.length,
      limit: result.limit,
      offset: result.offset,
      status: status || "all",
      status_counts: status_counts || {},
      alerts: result.rows,
    });
  } catch (e) {
    return next(e);
  }
}

async function patchAlert(req, res, next) {
  try {
    if (!db.isDbEnabled()) {
      return res.status(503).json({ error: "Database not configured." });
    }

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid alert id" });
    }

    const { status, admin_note } = req.body || {};
    if (!status) {
      return res.status(400).json({
        error: "Body must include status",
        allowed: [...alertService.STATUSES],
      });
    }

    try {
      const updated = await alertService.updateAlertStatus(id, {
        status,
        admin_note,
        userId: req.user?.id || null,
      });
      if (!updated) {
        return res.status(404).json({ error: "Alert not found" });
      }
      return res.json(updated);
    } catch (e) {
      if (e.status === 400) {
        return res.status(400).json({ error: e.message });
      }
      throw e;
    }
  } catch (e) {
    return next(e);
  }
}

module.exports = { listAlerts, patchAlert };
