const db = require("../config/db");
const deviceService = require("../services/deviceService");
const deviceCommandService = require("../services/deviceCommandService");
const captureService = require("../services/captureService");
const latestState = require("../services/latestState");
const { deriveFillLevel } = require("../utils/fillLevel");
const {
  resolveDeviceFillLevel,
  resolveDeviceFillPercentage,
  applyBinTypePayload,
  validateVirtualCoordinates,
} = require("../utils/deviceFill");
const { haversineMeters } = require("../utils/geo");
const { getPublicBaseUrl } = require("../utils/publicUrl");

/** ESP32 considered Online for UI if last poll within this window. */
const ONLINE_MS = 20_000;

function withPresence(device) {
  if (!device || typeof device !== "object") return device;
  const last = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
  const online = Boolean(last && Date.now() - last <= ONLINE_MS);
  return {
    ...device,
    camera_online: online,
    last_seen_at: device.last_seen_at || null,
  };
}

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

/** Sequelize rows use box_x1..box_y4; model microservice + frontend expect `box: number[]`. */
function predictionToApiShape(p) {
  if (!p || typeof p !== "object") return p;
  if (Array.isArray(p.box)) {
    return {
      label: p.label,
      confidence: Number(p.confidence),
      box: p.box.map(Number),
    };
  }
  const { box_x1, box_y1, box_x2, box_y2, label, confidence } = p;
  if (
    box_x1 != null &&
    box_y1 != null &&
    box_x2 != null &&
    box_y2 != null
  ) {
    return {
      label,
      confidence: Number(confidence),
      box: [
        Number(box_x1),
        Number(box_y1),
        Number(box_x2),
        Number(box_y2),
      ],
    };
  }
  return {
    label: p.label,
    confidence: Number(p.confidence),
    box: [0, 0, 0, 0],
  };
}

function normalizePredictionsForApi(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(predictionToApiShape);
}

/** Same tier bands as the React map/home UI (<40 empty, <70 half). */
function inferredFillLevelFromPercentage(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return null;
  const p = Number(pct);
  if (p < 40) return "Empty";
  if (p < 70) return "Half";
  return "Overflow";
}

function resolveLatestFillLevel({ device, latestCap, mem }) {
  return resolveDeviceFillLevel(device || {}, { latestCap, mem });
}

function resolveLatestFillPercentage({ device, latestCap, mem }) {
  return resolveDeviceFillPercentage(device || {}, { latestCap, mem });
}

function enrichDeviceLatest(device, latestCap, mem) {
  return {
    latest_fill_level: resolveLatestFillLevel({ device, latestCap, mem }),
    latest_fill_percentage: resolveLatestFillPercentage({
      device,
      latestCap,
      mem,
    }),
    latest_risk_level: latestCap?.risk_level || null,
    latest_source_type:
      latestCap?.source_type || mem?.extras?.source_type || null,
    latest_captured_at: latestCap?.captured_at || mem?.timestamp || null,
  };
}

function normalizeDeviceStatus(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (["active", "inactive", "maintenance"].includes(s)) return s;
  return null;
}

function clampIntQuery(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function list(req, res, next) {
  try {
    if (!dbRequired(res)) return;
    const rows = await deviceService.listDevices();
    const wantLatest =
      String(req.query.latest || "").trim() === "1" ||
      String(req.query.latest || "").toLowerCase() === "true";
    if (!wantLatest) {
      return res.json({ devices: rows.map(withPresence) });
    }

    const devices = await Promise.all(
      rows.map(async (d) => {
        const latestCap = await deviceService.getLatestCaptureForDevice(d.id);
        const mem = latestState.getLatestForDevice(d.id);
        return withPresence({
          ...d,
          ...enrichDeviceLatest(d, latestCap, mem),
        });
      })
    );

    return res.json({ devices });
  } catch (e) {
    return next(e);
  }
}

async function create(req, res, next) {
  try {
    if (!dbRequired(res)) return;

    const body = req.body || {};
    const name = (body.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const payload = {
      user_id: req.user?.id ?? body.user_id ?? null,
      name,
      esp32_id: body.esp32_id != null ? String(body.esp32_id).trim() || null : null,
      location: body.location != null ? String(body.location).trim() || null : null,
      address: body.address != null ? String(body.address).trim() || null : null,
      latitude:
        body.latitude === undefined || body.latitude === ""
          ? null
          : Number(body.latitude),
      longitude:
        body.longitude === undefined || body.longitude === ""
          ? null
          : Number(body.longitude),
      bridge_instance_id:
        body.bridge_instance_id != null
          ? String(body.bridge_instance_id).trim() || null
          : null,
      camera_base_url:
        body.camera_base_url != null
          ? String(body.camera_base_url).trim().replace(/\/+$/, "") || null
          : null,
      status: normalizeDeviceStatus(body.status) || "active",
    };

    const binTypeErr = applyBinTypePayload(body, payload, { isPatch: false });
    if (binTypeErr) {
      return res.status(400).json({ error: binTypeErr });
    }

    const coordErr = validateVirtualCoordinates(payload);
    if (coordErr) {
      return res.status(400).json({ error: coordErr });
    }

    if (
      payload.latitude != null &&
      !Number.isFinite(payload.latitude)
    ) {
      return res.status(400).json({ error: "latitude must be a number" });
    }
    if (
      payload.longitude != null &&
      !Number.isFinite(payload.longitude)
    ) {
      return res.status(400).json({ error: "longitude must be a number" });
    }

    const created = await deviceService.createDevice(payload);
    return res.status(201).json(created);
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "esp32_id must be unique" });
    }
    return next(e);
  }
}

async function patch(req, res, next) {
  try {
    if (!dbRequired(res)) return;

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid device id" });
    }

    const body = req.body || {};
    const patch = {};

    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (patch.name === "") {
      return res.status(400).json({ error: "name cannot be empty" });
    }

    if (body.esp32_id !== undefined) {
      patch.esp32_id =
        body.esp32_id == null || body.esp32_id === ""
          ? null
          : String(body.esp32_id).trim();
    }
    if (body.location !== undefined) {
      patch.location =
        body.location == null || body.location === ""
          ? null
          : String(body.location).trim();
    }
    if (body.address !== undefined) {
      patch.address =
        body.address == null || body.address === ""
          ? null
          : String(body.address).trim();
    }
    if (body.latitude !== undefined) {
      patch.latitude =
        body.latitude === "" || body.latitude === null
          ? null
          : Number(body.latitude);
    }
    if (body.longitude !== undefined) {
      patch.longitude =
        body.longitude === "" || body.longitude === null
          ? null
          : Number(body.longitude);
    }
    if (body.user_id !== undefined) {
      patch.user_id =
        body.user_id === "" || body.user_id === null
          ? null
          : parseInt(body.user_id, 10);
    }
    if (body.bridge_instance_id !== undefined) {
      patch.bridge_instance_id =
        body.bridge_instance_id == null || body.bridge_instance_id === ""
          ? null
          : String(body.bridge_instance_id).trim();
    }
    if (body.camera_base_url !== undefined) {
      patch.camera_base_url =
        body.camera_base_url == null || body.camera_base_url === ""
          ? null
          : String(body.camera_base_url).trim().replace(/\/+$/, "");
    }
    if (body.status !== undefined) {
      const st = normalizeDeviceStatus(body.status);
      if (!st) {
        return res.status(400).json({
          error: "status must be active, inactive, or maintenance",
        });
      }
      patch.status = st;
    }

    if (body.bin_type !== undefined) {
      patch.bin_type = body.bin_type;
    }
    if (body.manual_fill_level !== undefined) {
      patch.manual_fill_level = body.manual_fill_level;
    }
    if (body.manual_fill_percentage !== undefined) {
      patch.manual_fill_percentage = body.manual_fill_percentage;
    }

    const existing = await deviceService.getDeviceById(id);
    if (!existing) {
      return res.status(404).json({ error: "Device not found" });
    }

    const merged = { ...existing, ...patch };
    const binTypeErr = applyBinTypePayload(body, merged, { isPatch: true });
    if (binTypeErr) {
      return res.status(400).json({ error: binTypeErr });
    }

    Object.assign(patch, {
      bin_type: merged.bin_type,
      manual_fill_level: merged.manual_fill_level,
      manual_fill_percentage: merged.manual_fill_percentage,
      esp32_id: merged.esp32_id,
      bridge_instance_id: merged.bridge_instance_id,
      camera_base_url: merged.camera_base_url,
    });

    const coordErr = validateVirtualCoordinates({ ...existing, ...patch });
    if (coordErr) {
      return res.status(400).json({ error: coordErr });
    }

    if (
      patch.latitude != null &&
      !Number.isFinite(patch.latitude)
    ) {
      return res.status(400).json({ error: "latitude must be a number" });
    }
    if (
      patch.longitude != null &&
      !Number.isFinite(patch.longitude)
    ) {
      return res.status(400).json({ error: "longitude must be a number" });
    }

    const updated = await deviceService.updateDevice(id, patch);
    if (!updated) {
      return res.status(404).json({ error: "Device not found" });
    }

    return res.json(updated);
  } catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "esp32_id must be unique" });
    }
    return next(e);
  }
}

async function getOne(req, res, next) {
  try {
    if (!dbRequired(res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid device id" });
    }

    const row = await deviceService.getDeviceById(id);
    if (!row) {
      return res.status(404).json({ error: "Device not found" });
    }

    return res.json(withPresence(row));
  } catch (e) {
    return next(e);
  }
}

async function mapPins(req, res, next) {
  try {
    if (!dbRequired(res)) return;

    const devices = await deviceService.listDevicesWithCoordinates();
    const baseUrl = getPublicBaseUrl(req);

    const bins = [];

    for (const d of devices) {
      const latestCap = await deviceService.getLatestCaptureForDevice(d.id);
      const mem = latestState.getLatestForDevice(d.id);

      const latest = enrichDeviceLatest(d, latestCap, mem);
      const capturedAt = latest.latest_captured_at;

      let latest_image_url = null;
      if (latestCap?.image_buffer) {
        const ts = encodeURIComponent(capturedAt || "");
        latest_image_url = `${baseUrl}/devices/${d.id}/image/latest?t=${ts}`;
      } else if (mem?.timestamp) {
        const ts = encodeURIComponent(mem.timestamp);
        latest_image_url = `${baseUrl}/devices/${d.id}/image/latest?t=${ts}`;
      }

      bins.push({
        id: d.id,
        name: d.name,
        bin_type: d.bin_type || "smart",
        esp32_id: d.esp32_id,
        location: d.location,
        address: d.address,
        latitude: d.latitude,
        longitude: d.longitude,
        manual_fill_level: d.manual_fill_level || null,
        manual_fill_percentage: d.manual_fill_percentage ?? null,
        latest_fill_level: latest.latest_fill_level,
        latest_captured_at: capturedAt,
        latest_image_url,
        latest_risk_level: latest.latest_risk_level,
        latest_waste_label: latestCap?.waste_label || null,
        latest_source_type: latest.latest_source_type,
        latest_fill_percentage: latest.latest_fill_percentage,
      });
    }

    return res.json({ bins });
  } catch (e) {
    return next(e);
  }
}

async function nearest(req, res, next) {
  try {
    if (!dbRequired(res)) return;

    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "5", 10) || 5, 1),
      50
    );

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        error: "Query params lat and lng are required numbers",
      });
    }

    const devices = await deviceService.listDevicesWithCoordinates();

    const scored = await Promise.all(
      devices.map(async (d) => {
        const dist = haversineMeters(lat, lng, d.latitude, d.longitude);
        const latestCap = await deviceService.getLatestCaptureForDevice(d.id);
        const mem = latestState.getLatestForDevice(d.id);
        const baseUrl = getPublicBaseUrl(req);

        let latest_image_url = null;
        const capturedAt = latestCap?.captured_at || mem?.timestamp || null;

        if (latestCap?.image_buffer) {
          const ts = encodeURIComponent(capturedAt || "");
          latest_image_url = `${baseUrl}/devices/${d.id}/image/latest?t=${ts}`;
        } else if (mem?.timestamp) {
          const ts = encodeURIComponent(mem.timestamp);
          latest_image_url = `${baseUrl}/devices/${d.id}/image/latest?t=${ts}`;
        }

        const latest = enrichDeviceLatest(d, latestCap, mem);

        return {
          id: d.id,
          name: d.name,
          bin_type: d.bin_type || "smart",
          esp32_id: d.esp32_id,
          location: d.location,
          address: d.address,
          latitude: d.latitude,
          longitude: d.longitude,
          distance_meters: Math.round(dist * 10) / 10,
          manual_fill_level: d.manual_fill_level || null,
          latest_fill_level: latest.latest_fill_level,
          latest_captured_at: latest.latest_captured_at,
          latest_image_url,
          latest_risk_level: latest.latest_risk_level,
          latest_source_type: latest.latest_source_type,
          latest_fill_percentage: latest.latest_fill_percentage,
        };
      })
    );

    scored.sort((a, b) => a.distance_meters - b.distance_meters);

    return res.json({ results: scored.slice(0, limit) });
  } catch (e) {
    return next(e);
  }
}

async function listCapturesForDevice(req, res, next) {
  try {
    if (!dbRequired(res)) return;

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid device id" });
    }

    const dev = await deviceService.getDeviceById(id);
    if (!dev) {
      return res.status(404).json({ error: "Device not found" });
    }

    const limit = clampIntQuery(req.query.limit, 1, 100, 30);
    const offset = clampIntQuery(req.query.offset, 0, 1_000_000, 0);

    const rows = await captureService.listCaptures({
      deviceId: id,
      limit,
      offset,
    });

    const sanitized = rows.map((c) => {
      const buf = c.image_buffer;
      const has_image = Boolean(
        buf &&
          (Buffer.isBuffer(buf)
            ? buf.length > 0
            : typeof buf === "string"
              ? buf.length > 0
              : ArrayBuffer.isView(buf) && buf.byteLength > 0)
      );
      const { image_buffer: _ib, ...rest } = c;
      return { ...rest, has_image };
    });

    return res.json({
      device_id: id,
      count: sanitized.length,
      limit,
      offset,
      captures: sanitized,
    });
  } catch (e) {
    return next(e);
  }
}

async function latestDetail(req, res, next) {
  try {
    if (!dbRequired(res)) return;

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid device id" });
    }

    const device = await deviceService.getDeviceById(id);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }

    let capture = await deviceService.getLatestCaptureForDevice(id);
    const baseUrl = getPublicBaseUrl(req);

    let predictions = [];
    let captured_at = null;
    let fill_level = null;
    let model_name = null;
    let extras = null;

    if (capture) {
      predictions = normalizePredictionsForApi(capture.predictions || []);
      captured_at = capture.captured_at;
      fill_level = capture.fill_level;
      model_name = capture.model_name;
      extras = {
        waste_label: capture.waste_label,
        waste_confidence: capture.waste_confidence,
        animal_count: capture.animal_count,
        risk_level: capture.risk_level,
        risk_case: capture.risk_case,
        rotting_hours: capture.rotting_hours,
        temp_c: capture.temp_c,
        humidity_pct: capture.humidity_pct,
        weather_condition: capture.weather_condition,
        source_type: capture.source_type,
        capture_latitude: capture.latitude,
        capture_longitude: capture.longitude,
        fill_percentage: capture.fill_percentage,
        prediction_class: capture.prediction_class,
        littering_event_detected: capture.littering_event_detected,
        littering_event_count: capture.littering_event_count,
        littering_max_confidence: capture.littering_max_confidence,
      };
    }

    const mem = latestState.getLatestForDevice(id);
    const ts =
      encodeURIComponent(captured_at || mem?.timestamp || "");

    const imageUrl =
      capture?.image_buffer || mem?.image?.buffer
        ? `${baseUrl}/devices/${id}/image/latest?t=${ts}`
        : null;

    if (!capture && mem) {
      predictions = normalizePredictionsForApi(mem.predictions || []);
      captured_at = mem.timestamp;
      model_name = mem.model;
      fill_level = deriveFillLevel(predictions);
      extras = mem.extras || null;
    }

    return res.json({
      device: withPresence(device),
      latest: {
        captured_at,
        fill_level,
        model_name,
        predictions,
        extras,
        image: {
          url: imageUrl,
        },
      },
    });
  } catch (e) {
    return next(e);
  }
}

async function latestImage(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid device id" });
    }

    if (db.isDbEnabled()) {
      const captureRow = await deviceService.getLatestCaptureForDevice(id);
      let buf = captureRow?.image_buffer;
      if (buf && !Buffer.isBuffer(buf)) {
        buf = Buffer.from(buf);
      }
      if (buf && buf.length > 0) {
        res.set(
          "Content-Type",
          captureRow.image_mimetype || "image/jpeg"
        );
        res.set("Cache-Control", "no-store");
        return res.send(buf);
      }
    }

    const mem = latestState.getLatestForDevice(id);
    if (mem?.image?.buffer) {
      res.set("Content-Type", mem.image.mimetype || "image/jpeg");
      res.set("Cache-Control", "no-store");
      return res.send(mem.image.buffer);
    }

    return res.status(404).json({ error: "No image for this bin yet." });
  } catch (e) {
    return next(e);
  }
}

async function speakerTest(req, res, next) {
  try {
    if (!dbRequired(res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid device id" });
    }

    const existing = await deviceService.getDeviceById(id);
    if (!existing) {
      return res.status(404).json({ error: "Device not found" });
    }

    const updated = await deviceService.enqueueSpeakerAction(id, "test");
    return res.json({
      ok: true,
      device_id: id,
      pending_speaker_action: updated?.pending_speaker_action || "test",
      pending_speaker_at: updated?.pending_speaker_at || null,
      message:
        "Speaker test queued. Keep the VisionWaste bridge running on the same Wi‑Fi; the ESP32 should sound within one poll cycle.",
    });
  } catch (e) {
    return next(e);
  }
}

/**
 * Admin: queue PLAY_AUDIO track 1 for ESP32 DFPlayer (poll-based, no LAN).
 * Independent from POST /:id/speaker-test (laptop bridge).
 */
async function audioTest(req, res, next) {
  try {
    if (!dbRequired(res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid device id" });
    }

    const device = await deviceService.getDeviceById(id);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    if (!device.esp32_id || !String(device.esp32_id).trim()) {
      return res.status(400).json({
        error: "Device has no esp32_id. Set ESP32 ID on the bin first.",
      });
    }

    const track =
      req.body?.track !== undefined && req.body?.track !== ""
        ? req.body.track
        : 1;

    const cmd = await deviceCommandService.createPlayAudioCommand(device, {
      track,
    });
    return res.status(201).json(cmd);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * Admin: queue STOP_AUDIO for ESP32 DFPlayer (stops current playback).
 */
async function audioStop(req, res, next) {
  try {
    if (!dbRequired(res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid device id" });
    }

    const device = await deviceService.getDeviceById(id);
    if (!device) {
      return res.status(404).json({ error: "Device not found" });
    }
    if (!device.esp32_id || !String(device.esp32_id).trim()) {
      return res.status(400).json({
        error: "Device has no esp32_id. Set ESP32 ID on the bin first.",
      });
    }

    const cmd = await deviceCommandService.createStopAudioCommand(device);
    return res.status(201).json(cmd);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * ESP32 poll: GET /devices/commands?esp32_id=esp-cam-1
 * No auth (same trust model as /bridge/speaker-pending).
 */
async function pollCommands(req, res, next) {
  try {
    if (!dbRequired(res)) return;
    const esp32Id = req.query.esp32_id;
    if (!esp32Id || !String(esp32Id).trim()) {
      return res.status(400).json({ error: "esp32_id query parameter is required" });
    }

    const result = await deviceCommandService.pollNextCommand(esp32Id);
    if (!result.command) {
      return res.json({ command: null });
    }
    return res.json(result.command);
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * ESP32 ACK: POST /devices/commands/:command_id/ack
 */
async function ackCommand(req, res, next) {
  try {
    if (!dbRequired(res)) return;
    const commandId = req.params.command_id;
    const body = req.body || {};
    const updated = await deviceCommandService.ackCommand(commandId, {
      esp32Id: body.esp32_id,
      status: body.status,
      errorMessage: body.error_message,
    });
    return res.json({
      ok: true,
      command: updated,
    });
  } catch (e) {
    if (e.status) {
      return res.status(e.status).json({ error: e.message });
    }
    return next(e);
  }
}

/**
 * Admin status poll for Test Audio UX.
 * GET /devices/commands/:command_id
 */
async function getCommand(req, res, next) {
  try {
    if (!dbRequired(res)) return;
    const cmd = await deviceCommandService.getCommandById(req.params.command_id);
    if (!cmd) {
      return res.status(404).json({ error: "Command not found" });
    }
    return res.json(cmd);
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  list,
  create,
  patch,
  getOne,
  mapPins,
  nearest,
  listCapturesForDevice,
  latestDetail,
  latestImage,
  speakerTest,
  audioTest,
  audioStop,
  pollCommands,
  ackCommand,
  getCommand,
};
