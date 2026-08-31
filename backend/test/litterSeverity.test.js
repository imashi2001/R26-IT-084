const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const modelClient = require("../services/modelClient");
const alertService = require("../services/alertService");
const {
  litterSeverityExtras,
  qualifiesForAddBinAlert,
  trailingHighLitterStreak,
  isHighSeverity,
} = require("../services/litterSeverityUtils");

describe("litterSeverityExtras", () => {
  it("maps litter API payload to capture extras", () => {
    const out = litterSeverityExtras({
      severity: "HIGH",
      lsi: 57.2,
      detection_count: 12,
      metrics: { count: 12 },
    });
    assert.equal(out.litter_severity, "HIGH");
    assert.equal(out.litter_lsi, 57.2);
    assert.equal(out.litter_detection_count, 12);
  });

  it("returns nulls on error payload", () => {
    const out = litterSeverityExtras({ error: "down" });
    assert.equal(out.litter_severity, null);
  });
});

describe("qualifiesForAddBinAlert", () => {
  it("qualifies after 3 consecutive HIGH captures", () => {
    const caps = [
      { litter_severity: "HIGH" },
      { litter_severity: "HIGH" },
      { litter_severity: "HIGH" },
    ];
    assert.equal(trailingHighLitterStreak(caps), 3);
    assert.equal(qualifiesForAddBinAlert(caps), true);
  });

  it("does not qualify when streak breaks", () => {
    const caps = [
      { litter_severity: "HIGH" },
      { litter_severity: "MEDIUM" },
      { litter_severity: "HIGH" },
    ];
    assert.equal(qualifiesForAddBinAlert(caps), false);
  });

  it("qualifies after 3 consecutive littering events", () => {
    const caps = [
      { littering_event_detected: true, littering_max_confidence: 0.8 },
      { littering_event_detected: true, littering_max_confidence: 0.7 },
      { littering_event_detected: true, littering_max_confidence: 0.9 },
    ];
    assert.equal(qualifiesForAddBinAlert(caps), true);
  });
});

describe("classifyCaptureForAlert litter severity", () => {
  it("returns litter_severity_high for HIGH LSI", () => {
    const out = alertService.classifyCaptureForAlert({
      risk_level: "LOW",
      animal_count: 0,
      litter_severity: "HIGH",
      litter_lsi: 58,
      litter_detection_count: 9,
    });
    assert.equal(out.alert_type, "litter_severity_high");
    assert.match(out.summary, /LSI 58\.0/);
  });

  it("does not override risk_critical", () => {
    const out = alertService.classifyCaptureForAlert({
      risk_level: "CRITICAL",
      risk_case: "C1",
      animal_count: 0,
      litter_severity: "HIGH",
      litter_lsi: 60,
      litter_detection_count: 5,
    });
    assert.equal(out.alert_type, "risk_critical");
  });

  it("returns litter_add_bin when recent streak qualifies", () => {
    const out = alertService.classifyCaptureForAlert({
      risk_level: "LOW",
      animal_count: 0,
      litter_severity: "HIGH",
      litter_lsi: 55,
      litter_detection_count: 4,
      _recent_captures: [
        { litter_severity: "HIGH" },
        { litter_severity: "HIGH" },
        { litter_severity: "HIGH" },
      ],
    });
    assert.equal(out.alert_type, "litter_add_bin");
  });

  it("ignores MEDIUM for HIGH alert", () => {
    const out = alertService.classifyCaptureForAlert({
      risk_level: "LOW",
      animal_count: 0,
      litter_severity: "MEDIUM",
      litter_lsi: 45,
    });
    assert.notEqual(out?.alert_type, "litter_severity_high");
  });
});

describe("isHighSeverity", () => {
  it("detects HIGH case-insensitively", () => {
    assert.equal(isHighSeverity("high"), true);
    assert.equal(isHighSeverity("LOW"), false);
  });
});

describe("inferAll litter_severity slot", () => {
  it("includes litter_severity key in return shape", async () => {
    const prev = process.env.MODEL_LITTER_URL;
    process.env.MODEL_LITTER_URL = "";
    delete require.cache[require.resolve("../config/env")];
    delete require.cache[require.resolve("../services/modelClient")];
    const fresh = require("../services/modelClient");
    const out = await fresh.inferAll({
      fileBuffer: Buffer.from("fake"),
      filename: "x.jpg",
      mimetype: "image/jpeg",
    });
    assert.equal(out.litter_severity, null);
    process.env.MODEL_LITTER_URL = prev;
    delete require.cache[require.resolve("../config/env")];
    delete require.cache[require.resolve("../services/modelClient")];
  });
});

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
});
