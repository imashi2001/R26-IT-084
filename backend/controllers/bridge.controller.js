/**
 * Bridge laptop endpoints (LAN relay for speaker / alarm).
 *
 * GET  /bridge/speaker-pending?bridge_instance_id=&esp32_id=
 * POST /bridge/speaker-ack  JSON { device_id }
 */

const db = require("../config/db");
const deviceService = require("../services/deviceService");

function dbRequired(res) {
  if (!db.isDbEnabled()) {
    res.status(503).json({
      error:
        "Database not configured. Set DATABASE_URL on the backend service.",
    });
    return false;
  }
  return true;
}

async function speakerPending(req, res, next) {
  try {
    if (!dbRequired(res)) return;

    const bridgeInstanceId = String(
      req.query.bridge_instance_id || ""
    ).trim();
    const esp32Id = String(req.query.esp32_id || "").trim();

    if (!bridgeInstanceId && !esp32Id) {
      return res.status(400).json({
        error: "Provide bridge_instance_id and/or esp32_id",
      });
    }

    const device = await deviceService.findPendingSpeakerCommand({
      bridgeInstanceId: bridgeInstanceId || null,
      esp32Id: esp32Id || null,
    });

    if (!device) {
      return res.json({ pending: false });
    }

    return res.json({
      pending: true,
      device_id: device.id,
      esp32_id: device.esp32_id,
      action: device.pending_speaker_action,
      camera_base_url: device.camera_base_url || null,
      pending_speaker_at: device.pending_speaker_at,
    });
  } catch (e) {
    return next(e);
  }
}

async function speakerAck(req, res, next) {
  try {
    if (!dbRequired(res)) return;

    const body = req.body || {};
    const id = parseInt(body.device_id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "device_id is required" });
    }

    const existing = await deviceService.getDeviceById(id);
    if (!existing) {
      return res.status(404).json({ error: "Device not found" });
    }

    await deviceService.clearPendingSpeakerAction(id);
    return res.json({ ok: true, device_id: id });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  speakerPending,
  speakerAck,
};
