/**
 * POST /littering-action — proxy to littering-event microservice (YOLO11).
 * Multipart field: image (same as /predict).
 */

const modelClient = require("../services/modelClient");

async function analyze(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        error: "Missing image file. Send multipart field `image`.",
      });
    }

    if (!modelClient.isLitteringActionConfigured()) {
      return res.status(503).json({
        error: "MODEL_LITTERING_ACTION_URL is not set on the backend.",
      });
    }

    const data = await modelClient.inferLitteringAction({
      fileBuffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    if (data?.error) {
      const status = data.status && data.status >= 400 ? data.status : 502;
      return res.status(status).json({ error: data.error });
    }

    return res.json(data);
  } catch (err) {
    const status = Number(err.status) && err.status >= 400 ? err.status : 502;
    const body = { error: err.message || "Littering-action inference failed" };
    if (err.detail !== undefined) body.detail = err.detail;
    return res.status(status).json(body);
  }
}

module.exports = { analyze };
