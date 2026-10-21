const LEVEL_KEYS = new Set(["empty", "half", "overflow"]);

const TO_DISPLAY = {
  empty: "Empty",
  half: "Half",
  overflow: "Overflow",
};

/**
 * Pick fill label from YOLO predictions using highest confidence among known levels.
 * @param {Array<{label:string, confidence:number}>} predictions
 * @returns {string|null}
 */
function deriveFillLevel(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) return null;

  let bestDisplay = null;
  let bestConf = -1;

  for (const p of predictions) {
    const raw = (p.label || "").trim();
    const key = raw.toLowerCase();
    if (!LEVEL_KEYS.has(key)) continue;
    const conf = Number(p.confidence);
    const c = Number.isFinite(conf) ? conf : 0;
    if (c > bestConf) {
      bestConf = c;
      bestDisplay = TO_DISPLAY[key];
    }
  }

  return bestDisplay;
}

module.exports = { deriveFillLevel };
