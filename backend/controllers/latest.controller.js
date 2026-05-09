const latestState = require("../services/latestState");

function getLatest(req, res) {
  const latest = latestState.getLatest();
  if (!latest) {
    return res.status(404).json({ error: "No capture received yet." });
  }

  // Cache-bust helper for frontend image URL
  const ts = encodeURIComponent(latest.timestamp);
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  return res.json({
    timestamp: latest.timestamp,
    model: latest.model,
    predictions: latest.predictions,
    image: {
      bytes: latest.image.bytes,
      mimetype: latest.image.mimetype,
      url: `${baseUrl}/latest.jpg?t=${ts}`,
    },
  });
}

function getLatestImage(req, res) {
  const latest = latestState.getLatest();
  if (!latest || !latest.image || !latest.image.buffer) {
    return res.status(404).json({ error: "No image received yet." });
  }

  res.set("Content-Type", latest.image.mimetype || "image/jpeg");
  // Avoid caching so frontend can show newest image
  res.set("Cache-Control", "no-store");
  return res.send(latest.image.buffer);
}

module.exports = { getLatest, getLatestImage };

