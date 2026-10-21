/**
 * POST /litter-severity — proxy to litter microservice (YOLO + LSI).
 * Multipart field: image (same as /predict).
 * Optional field device_id: apply that bin's saved outline (inside-bin litter ignored).
 *
 * Used by the "Litter Severity" dashboard page for manual tests: the photo is
 * analysed and the result returned straight away. Nothing is saved and no
 * alerts are created (live bin photos go through POST /predict instead).
 */

const modelClient = require("../services/modelClient");
const litterBinOutlineService = require("../services/litterBinOutlineService");

async function analyze(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        error: "Missing image file. Send multipart field `image`.",
      });
    }

    // No bin chosen (or no outline saved) → null → all litter is counted.
    const binPolygon = await litterBinOutlineService.polygonForDevice(
      req.body?.device_id
    );

    const data = await modelClient.inferLitter({
      fileBuffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      binPolygon,
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
