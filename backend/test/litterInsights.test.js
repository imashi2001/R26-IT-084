const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  annotateLitteringEpisodes,
  summarizeLitteringEpisodes,
} = require("../services/litteringConfirmation");
const { detectLitterRise, litterSeverityExtras } = require("../services/litterSeverityUtils");
const {
  binStatus,
  findCleanups,
  slopePerDay,
  localParts,
  feedbackStats,
  buildLitterSummary,
} = require("../services/litterInsightsUtils");
const { normalizePolygon } = require("../services/litterBinOutlineService");
const alertService = require("../services/alertService");

const OPTS = { minConfidence: 0.5, minFrames: 2, windowMs: 120_000, strongConfidence: 0.8 };
const T0 = Date.parse("2026-10-01T08:00:00Z");

function frame(id, offsetS, conf, deviceId = 1) {
  return {
    id,
    device_id: deviceId,
    captured_at: new Date(T0 + offsetS * 1000).toISOString(),
    littering_event_detected: true,
    littering_max_confidence: conf,
  };
}

function lsiCap(id, offsetH, lsi, severity, deviceId = 1) {
  return {
    id,
    device_id: deviceId,
    captured_at: new Date(T0 + offsetH * 3_600_000).toISOString(),
    litter_lsi: lsi,
    litter_severity: severity,
  };
}

describe("annotateLitteringEpisodes", () => {
  it("does not confirm a single medium-confidence frame", () => {
    const rec = annotateLitteringEpisodes([frame(1, 0, 0.6)], OPTS).get(1);
    assert.equal(rec.episode_confirmed, false);
    assert.equal(rec.first_confirming, false);
  });

  it("confirms on the second frame within the window", () => {
    const out = annotateLitteringEpisodes([frame(2, 40, 0.55), frame(1, 0, 0.6)], OPTS);
    assert.equal(out.get(1).episode_confirmed, true);
    assert.equal(out.get(1).first_confirming, false);
    assert.equal(out.get(2).first_confirming, true);
    assert.equal(out.get(2).first_confirming_id, 2);
    assert.equal(out.get(2).episode_frames, 2);
  });

  it("starts a new episode after the window gap", () => {
    const out = annotateLitteringEpisodes([frame(1, 0, 0.6), frame(2, 400, 0.6)], OPTS);
    assert.notEqual(out.get(1).episode_key, out.get(2).episode_key);
    assert.equal(out.get(2).episode_confirmed, false);
  });

  it("confirms one strong frame on its own", () => {
    const rec = annotateLitteringEpisodes([frame(1, 0, 0.9)], OPTS).get(1);
    assert.equal(rec.first_confirming, true);
  });

  it("keeps bins separate and ignores low-confidence frames", () => {
    const out = annotateLitteringEpisodes(
      [frame(1, 0, 0.6, 1), frame(2, 10, 0.6, 2), frame(3, 20, 0.3, 1)],
      OPTS
    );
    assert.equal(out.get(1).episode_confirmed, false);
    assert.equal(out.get(2).episode_confirmed, false);
    assert.equal(out.has(3), false);
  });

  it("summarizes frames vs episodes", () => {
    const s = summarizeLitteringEpisodes(
      [frame(1, 0, 0.6), frame(2, 30, 0.6), frame(3, 1000, 0.6)],
      OPTS
    );
    assert.equal(s.frames, 3);
    assert.equal(s.episodes, 2);
    assert.equal(s.confirmed, 1);
    assert.equal(s.unconfirmed, 1);
  });
});

describe("classifyCaptureForAlert littering confirmation flag", () => {
  const base = {
    risk_level: "LOW",
    animal_count: 0,
    littering_event_detected: true,
    littering_event_count: 1,
    littering_max_confidence: 0.7,
  };

  it("skips littering when the frame is not the confirming one", () => {
    const out = alertService.classifyCaptureForAlert({ ...base, _littering_confirmed: false });
    assert.equal(out, null);
  });

  it("alerts when the frame confirmed its episode", () => {
    const out = alertService.classifyCaptureForAlert({ ...base, _littering_confirmed: true });
    assert.equal(out.alert_type, "littering_detected");
  });
});

describe("detectLitterRise", () => {
  const earlier = [
    { captured_at: "2026-10-01T06:00:00Z", litter_lsi: 12 },
    { captured_at: "2026-10-01T07:00:00Z", litter_lsi: 25 },
  ];

  it("flags a MEDIUM reading that rose by the delta", () => {
    const r = detectLitterRise(earlier, { severity: "MEDIUM", lsi: 45 }, { delta: 20 });
    assert.equal(r.from_lsi, 12);
    assert.equal(r.rise, 33);
  });

  it("ignores small rises, HIGH and LOW readings", () => {
    assert.equal(detectLitterRise(earlier, { severity: "MEDIUM", lsi: 30 }, { delta: 20 }), null);
    assert.equal(detectLitterRise(earlier, { severity: "HIGH", lsi: 70 }, { delta: 20 }), null);
    assert.equal(detectLitterRise(earlier, { severity: "LOW", lsi: 29 }, { delta: 10 }), null);
    assert.equal(detectLitterRise([], { severity: "MEDIUM", lsi: 50 }, { delta: 20 }), null);
  });
});

describe("litterSeverityExtras outline fields", () => {
  it("stores whether the bin outline was applied", () => {
    const out = litterSeverityExtras({
      severity: "LOW",
      lsi: 10,
      detection_count: 1,
      bin_polygon_applied: true,
      ignored_inside_bin: 4,
    });
    assert.equal(out.litter_severity_summary.bin_polygon_applied, true);
    assert.equal(out.litter_severity_summary.ignored_inside_bin, 4);
  });
});

describe("binStatus", () => {
  it("classifies sequences", () => {
    assert.equal(binStatus(["HIGH", "MEDIUM", "HIGH"]), "persistent");
    assert.equal(binStatus(["HIGH", "LOW"]), "recovered");
    assert.equal(binStatus(["LOW", "MEDIUM"]), "watch");
    assert.equal(binStatus(["LOW", "LOW", "LOW", "LOW", "LOW"]), "clean");
    assert.equal(binStatus([]), "unknown");
  });
});

describe("findCleanups", () => {
  it("records elevated → LOW transitions with the run peak", () => {
    const { cleanups, open_run } = findCleanups([
      lsiCap(1, 0, 40, "MEDIUM"),
      lsiCap(2, 2, 70, "HIGH"),
      lsiCap(3, 4, 8, "LOW"),
      lsiCap(4, 6, 45, "MEDIUM"),
    ]);
    assert.equal(cleanups.length, 1);
    assert.equal(cleanups[0].before_lsi, 70);
    assert.equal(cleanups[0].after_lsi, 8);
    assert.equal(cleanups[0].hours_elevated, 4);
    assert.equal(open_run.peak_lsi, 45);
  });
});

describe("slopePerDay", () => {
  it("returns LSI change per day", () => {
    const pts = [0, 1, 2].map((d) => ({ t: T0 + d * 86_400_000, v: 10 + d * 10 }));
    assert.equal(Math.round(slopePerDay(pts)), 10);
    assert.equal(slopePerDay(pts.slice(0, 2)), null);
  });
});

describe("localParts", () => {
  it("shifts by the browser timezone offset", () => {
    // Sri Lanka: getTimezoneOffset() = -330 → 08:00Z is 13:30 local.
    const p = localParts(T0, -330);
    assert.equal(p.hour, 13);
    assert.equal(p.date, "2026-10-01");
  });
});

describe("feedbackStats", () => {
  it("computes accuracy, confusion and false alarms", () => {
    const s = feedbackStats([
      { model: "severity", verdict: "correct", predicted_label: "HIGH", corrected_label: "HIGH" },
      { model: "severity", verdict: "incorrect", predicted_label: "HIGH", corrected_label: "MEDIUM" },
      { model: "action", verdict: "incorrect", predicted_label: "littering" },
      { model: "action", verdict: "correct", predicted_label: "littering" },
    ]);
    assert.equal(s.severity.accuracy, 50);
    assert.equal(s.severity.confusion["HIGH->MEDIUM"], 1);
    assert.equal(s.action.false_alarms, 1);
    assert.equal(s.action.accuracy, 50);
  });
});

describe("buildLitterSummary", () => {
  it("aggregates totals, bins, cleanups and episodes", () => {
    const now = T0 + 3 * 86_400_000;
    const captures = [
      lsiCap(1, 0, 60, "HIGH", 1),
      lsiCap(2, 1, 65, "HIGH", 1),
      lsiCap(3, 2, 70, "HIGH", 1),
      lsiCap(4, 0, 50, "MEDIUM", 2),
      lsiCap(5, 3, 5, "LOW", 2),
      frame(6, 0, 0.6, 1),
      frame(7, 30, 0.7, 1),
    ];
    const s = buildLitterSummary({
      captures,
      devices: [{ id: 1, name: "Market bin", latitude: 6.9, longitude: 79.8 }],
      outlines: [{ device_id: 2, bin_polygon: [[0, 0], [1, 0], [1, 1]] }],
      days: 7,
      now,
      confirmation: OPTS,
    });
    assert.equal(s.totals.captures_analyzed, 5);
    assert.equal(s.totals.high, 3);
    assert.equal(s.totals.littering_confirmed, 1);
    assert.equal(s.daily.length, 7);
    assert.equal(s.heatmap.length, 7);
    assert.equal(s.heatmap[0].length, 24);

    const bin1 = s.bins.find((b) => b.device_id === 1);
    const bin2 = s.bins.find((b) => b.device_id === 2);
    assert.equal(bin1.status, "persistent");
    assert.equal(bin1.name, "Market bin");
    assert.equal(bin1.littering_confirmed, 1);
    assert.equal(bin2.status, "recovered");
    assert.equal(bin2.has_outline, true);
    assert.equal(s.bins[0].device_id, 1);
    assert.equal(s.cleanups.length, 1);
    assert.equal(s.cleanups[0].device_id, 2);
    assert.ok(s.peak);
  });
});

describe("normalizePolygon", () => {
  it("accepts and rounds fractional points", () => {
    const out = normalizePolygon([[0.123456, 0.5], { x: 0.9, y: 0.1 }, [0.5, 0.95]]);
    assert.deepEqual(out[0], [0.1235, 0.5]);
    assert.deepEqual(out[1], [0.9, 0.1]);
  });

  it("rejects bad outlines", () => {
    assert.throws(() => normalizePolygon([[0, 0], [1, 1]]), /at least 3/);
    assert.throws(() => normalizePolygon([[0, 0], [2, 1], [0.5, 0.5]]), /between 0 and 1/);
  });
});
