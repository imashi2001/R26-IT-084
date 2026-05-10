const db = require("../config/db");
const deviceService = require("../services/deviceService");
const latestState = require("../services/latestState");
const { deriveFillLevel } = require("../utils/fillLevel");
const { haversineMeters } = require("../utils/geo");
const { getPublicBaseUrl } = require("../utils/publicUrl");

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

async function list(req, res, next) {
  try {
    if (!dbRequired(res)) return;
    const rows = await deviceService.listDevices();
    return res.json({ devices: rows });
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
    };

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

    return res.json(row);
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

      const fill = latestCap?.fill_level || null;
      const capturedAt = latestCap?.captured_at || null;

      let latest_image_url = null;
      if (latestCap?.image_buffer) {
        const ts = encodeURIComponent(capturedAt || "");
        latest_image_url = `${baseUrl}/devices/${d.id}/image/latest?t=${ts}`;
      } else {
        const mem = latestState.getLatestForDevice(d.id);
        if (mem?.timestamp) {
          const ts = encodeURIComponent(mem.timestamp);
          latest_image_url = `${baseUrl}/devices/${d.id}/image/latest?t=${ts}`;
        }
      }

      bins.push({
        id: d.id,
        name: d.name,
        esp32_id: d.esp32_id,
        location: d.location,
        address: d.address,
        latitude: d.latitude,
        longitude: d.longitude,
        latest_fill_level: fill,
        latest_captured_at: capturedAt,
        latest_image_url,
        latest_risk_level: latestCap?.risk_level || null,
        latest_waste_label: latestCap?.waste_label || null,
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
        const baseUrl = getPublicBaseUrl(req);

        let latest_image_url = null;
        const capturedAt = latestCap?.captured_at || null;

        if (latestCap?.image_buffer) {
          const ts = encodeURIComponent(capturedAt || "");
          latest_image_url = `${baseUrl}/devices/${d.id}/image/latest?t=${ts}`;
        } else {
          const mem = latestState.getLatestForDevice(d.id);
          if (mem?.timestamp) {
            const ts = encodeURIComponent(mem.timestamp);
            latest_image_url = `${baseUrl}/devices/${d.id}/image/latest?t=${ts}`;
          }
        }

        return {
          id: d.id,
          name: d.name,
          esp32_id: d.esp32_id,
          location: d.location,
          address: d.address,
          latitude: d.latitude,
          longitude: d.longitude,
          distance_meters: Math.round(dist * 10) / 10,
          latest_fill_level: latestCap?.fill_level || null,
          latest_captured_at: capturedAt,
          latest_image_url,
          latest_risk_level: latestCap?.risk_level || null,
        };
      })
    );

    scored.sort((a, b) => a.distance_meters - b.distance_meters);

    return res.json({ results: scored.slice(0, limit) });
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
      device,
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

module.exports = {
  list,
  create,
  patch,
  getOne,
  mapPins,
  nearest,
  latestDetail,
  latestImage,
};
