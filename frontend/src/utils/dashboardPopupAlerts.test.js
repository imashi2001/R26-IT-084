import { describe, it, expect } from "vitest";
import { buildDashboardPopupAlerts } from "./dashboardPopupAlerts.js";
import { annotateLitteringEpisodes } from "./litteringConfirmation.js";
import { DEFAULT_LITTER_POPUP_SETTINGS, withPopupDefaults } from "./litterPopupSettings.js";

const T0 = Date.parse("2026-10-20T08:00:00Z");

function cap(id, offsetS, extra = {}) {
  return {
    id,
    device_id: 1,
    captured_at: new Date(T0 + offsetS * 1000).toISOString(),
    ...extra,
  };
}

const litterFrame = (id, offsetS, conf) =>
  cap(id, offsetS, { littering_event_detected: true, littering_event_count: 1, littering_max_confidence: conf });

const kinds = (alerts) => alerts.map((a) => `${a.kind}:${a.captureId}`);

describe("annotateLitteringEpisodes (browser)", () => {
  it("confirms the second frame inside the window", () => {
    const out = annotateLitteringEpisodes(
      [litterFrame(1, 0, 0.6), litterFrame(2, 10, 0.6)],
      DEFAULT_LITTER_POPUP_SETTINGS.confirmation
    );
    expect(out.get(1).first_confirming).toBe(false);
    expect(out.get(2).first_confirming).toBe(true);
  });
});

describe("buildDashboardPopupAlerts litter switches", () => {
  const frames = [litterFrame(1, 0, 0.6), litterFrame(2, 10, 0.6), litterFrame(3, 500, 0.6)];

  it("keeps the original behaviour without settings", () => {
    const alerts = buildDashboardPopupAlerts(frames);
    expect(alerts.filter((a) => a.kind === "littering")).toHaveLength(3);
  });

  it("pops up once per confirmed episode by default", () => {
    const alerts = buildDashboardPopupAlerts(frames, DEFAULT_LITTER_POPUP_SETTINGS);
    expect(kinds(alerts)).toEqual(["littering:2"]);
    expect(alerts[0].detail).toMatch(/confirmed on 2 frames/);
  });

  it("pops up every frame when confirmed-only is off", () => {
    const s = withPopupDefaults({ popup_confirmed_only: false });
    expect(buildDashboardPopupAlerts(frames, s).filter((a) => a.kind === "littering")).toHaveLength(3);
  });

  it("hides illegal dumping when switched off but keeps animal popups", () => {
    const s = withPopupDefaults({ popup_illegal_dumping: false });
    const alerts = buildDashboardPopupAlerts(
      [...frames, cap(9, 20, { animal_count: 2 })],
      s
    );
    expect(kinds(alerts)).toEqual(["animal:9"]);
  });

  it("adds one add-bin popup when HIGH reaches the streak", () => {
    const caps = [1, 2, 3, 4].map((i) =>
      cap(i, i * 60, { litter_severity: "HIGH", litter_lsi: 60 + i })
    );
    const alerts = buildDashboardPopupAlerts(caps, DEFAULT_LITTER_POPUP_SETTINGS);
    expect(kinds(alerts)).toEqual(["litter_add_bin:3"]);
  });

  it("adds HIGH severity popups only when enabled", () => {
    const caps = [cap(1, 0, { litter_severity: "HIGH", litter_lsi: 70, litter_detection_count: 4 })];
    expect(buildDashboardPopupAlerts(caps, DEFAULT_LITTER_POPUP_SETTINGS)).toHaveLength(0);
    const on = withPopupDefaults({ popup_high_severity: true });
    expect(kinds(buildDashboardPopupAlerts(caps, on))).toEqual(["litter_high:1"]);
  });

  it("marks litter popups silent when sound is off", () => {
    const s = withPopupDefaults({ popup_sound: false, popup_confirmed_only: false });
    const alerts = buildDashboardPopupAlerts(
      [litterFrame(1, 0, 0.9), cap(2, 5, { animal_count: 1 })],
      s
    );
    expect(alerts.find((a) => a.kind === "littering").silent).toBe(true);
    expect(alerts.find((a) => a.kind === "animal").silent).toBeUndefined();
  });
});
