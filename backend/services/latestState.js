/**
 * latestState - in-memory latest ESP32 capture.
 *
 * Purpose: allow the deployed frontend (HTTPS) to show the most recent ESP32
 * snapshot + predictions even though it cannot directly fetch http://10.x.x.x
 * camera URLs (mixed content + private network).
 *
 * This state resets on backend redeploy/restart. For permanent history, use DB.
 */

let latest = null;

/**
 * @param {object} payload
 * @param {Buffer} payload.imageBuffer
 * @param {string} payload.mimetype
 * @param {string} payload.filename
 * @param {string} payload.modelName
 * @param {Array} payload.predictions
 */
function setLatest({ imageBuffer, mimetype, filename, modelName, predictions }) {
  latest = {
    timestamp: new Date().toISOString(),
    image: {
      buffer: imageBuffer,
      mimetype: mimetype || "image/jpeg",
      filename: filename || "latest.jpg",
      bytes: imageBuffer ? imageBuffer.length : 0,
    },
    model: modelName,
    predictions: Array.isArray(predictions) ? predictions : [],
  };
}

function getLatest() {
  return latest;
}

function clearLatest() {
  latest = null;
}

module.exports = { setLatest, getLatest, clearLatest };

