const latestState = require("../services/latestState");
const { getPublicBaseUrl } = require("../utils/publicUrl");

function getLatest(req, res) {
  const latest = latestState.getLatest();
  if (!latest) {
    return res.status(404).json({ error: "No capture received yet." });
  }

  const ts = encodeURIComponent(latest.timestamp);
  const baseUrl = getPublicBaseUrl(req);

  return res.json({
    timestamp: latest.timestamp,
    device_id: latest.deviceId,
    model: latest.model,
    predictions: latest.predictions,
    image: {
      bytes: latest.image.bytes,
      mimetype: latest.image.mimetype,
      url: `${baseUrl}/latest/image?t=${ts}`,
    },
  });
}

function getLatestImage(req, res) {
  const latest = latestState.getLatest();
  if (!latest || !latest.image || !latest.image.buffer) {
    return res.status(404).json({ error: "No image received yet." });
  }

  res.set("Content-Type", latest.image.mimetype || "image/jpeg");
  res.set("Cache-Control", "no-store");
  return res.send(latest.image.buffer);
}

module.exports = { getLatest, getLatestImage };
