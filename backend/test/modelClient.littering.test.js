const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const modelClient = require("../services/modelClient");
const alertService = require("../services/alertService");

describe("normalizeLitteringActionPayload", () => {
  it("maps bbox detections to box arrays", () => {
    const out = modelClient.normalizeLitteringActionPayload({
      event_detected: true,
      event_count: 1,
      max_confidence: 0.87,
      detections: [
        {
          class_id: 0,
          class_name: "littering",
          confidence: 0.87,
          bbox: { x1: 10, y1: 20, x2: 30, y2: 40 },
        },
      ],
    });
    assert.equal(out.event_detected, true);
    assert.equal(out.detections[0].label, "littering");
    assert.deepEqual(out.detections[0].box, [10, 20, 30, 40]);
  });

  it("derives event_detected from detection count", () => {
    const out = modelClient.normalizeLitteringActionPayload({
      detections: [{ class_name: "littering", confidence: 0.6, bbox: { x1: 0, y1: 0, x2: 1, y2: 1 } }],
    });
    assert.equal(out.event_count, 1);
    assert.equal(out.event_detected, true);
  });
});

describe("classifyCaptureForAlert littering", () => {
  it("returns littering_detected above threshold", () => {
    const out = alertService.classifyCaptureForAlert({
      risk_level: "LOW",
      animal_count: 0,
      littering_event_detected: true,
      littering_event_count: 1,
      littering_max_confidence: 0.75,
    });
    assert.equal(out.alert_type, "littering_detected");
    assert.equal(out.severity, "warning");
  });

  it("ignores littering below alert confidence", () => {
    const out = alertService.classifyCaptureForAlert({
      risk_level: "LOW",
      animal_count: 0,
      littering_event_detected: true,
      littering_event_count: 1,
      littering_max_confidence: 0.1,
    });
    assert.equal(out, null);
  });
});

describe("pingLitteringActionHealth", () => {
  it("reports not_configured when URL unset", async () => {
    const prev = process.env.MODEL_LITTERING_ACTION_URL;
    process.env.MODEL_LITTERING_ACTION_URL = "";
    delete require.cache[require.resolve("../config/env")];
    delete require.cache[require.resolve("../services/modelClient")];
    const fresh = require("../services/modelClient");
    const health = await fresh.pingLitteringActionHealth();
    assert.equal(health.status, "not_configured");
    process.env.MODEL_LITTERING_ACTION_URL = prev;
    delete require.cache[require.resolve("../config/env")];
    delete require.cache[require.resolve("../services/modelClient")];
  });
});
