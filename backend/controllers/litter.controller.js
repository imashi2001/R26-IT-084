/**
 * POST /litter-severity — proxy to litter microservice (YOLO + LSI).
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

    const data = await modelClient.inferLitter({
      fileBuffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    return res.json(data);
  } catch (err) {
    const status = Number(err.status) && err.status >= 400 ? err.status : 502;
    const body = { error: err.message || "Litter severity inference failed" };
    if (err.detail !== undefined) body.detail = err.detail;
    return res.status(status).json(body);
  }
}

module.exports = { analyze };
