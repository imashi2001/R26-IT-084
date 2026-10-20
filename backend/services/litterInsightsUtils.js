/**
 * Pure analytics for the Litter Insights page (no DB access — easy to test).
 */

const { normalizeSeverity, formatBinCode } = require("./litterSeverityUtils");
const { summarizeLitteringEpisodes } = require("./litteringConfirmation");

const DAY_MS = 86_400_000;
const ELEVATED = new Set(["MEDIUM", "HIGH"]);
/** LSI change per day that counts as a real trend (not noise). */
const TREND_SLOPE_PER_DAY = 5;
const TREND_POINTS = 20;

function hasLsi(c) {
  return c?.litter_lsi != null && Number.isFinite(Number(c.litter_lsi));
}

function ts(c) {
  const t = new Date(c?.captured_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

function round1(v) {
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
}

/** Local calendar parts for a UTC timestamp, given JS getTimezoneOffset() minutes. */
function localParts(t, tzOffsetMin = 0) {
  const d = new Date(t - tzOffsetMin * 60_000);
  return {
    dow: d.getUTCDay(),
    hour: d.getUTCHours(),
    date: d.toISOString().slice(0, 10),
  };
}

/** Least-squares slope of LSI per day; null with fewer than 3 points. */
function slopePerDay(points) {
  if (!points || points.length < 3) return null;
  const xs = points.map((p) => p.t / DAY_MS);
  const ys = points.map((p) => p.v);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den > 0 ? num / den : null;
}

function trendLabel(slope) {
  if (slope == null) return "unknown";
  if (slope >= TREND_SLOPE_PER_DAY) return "rising";
  if (slope <= -TREND_SLOPE_PER_DAY) return "falling";
  return "stable";
}

/**
 * persistent: last 3 readings MEDIUM/HIGH · recovered: now LOW after an elevated
 * reading in the previous 3 · watch: latest is MEDIUM/HIGH · clean: otherwise.
 * @param {string[]} severities oldest → newest
 */
function binStatus(severities) {
  if (!severities.length) return "unknown";
  const last = severities[severities.length - 1];
  const last3 = severities.slice(-3);
  if (last3.length === 3 && last3.every((s) => ELEVATED.has(s))) return "persistent";
  if (last === "LOW" && severities.slice(-4, -1).some((s) => ELEVATED.has(s))) {
    return "recovered";
  }
  if (ELEVATED.has(last)) return "watch";
  return "clean";
}

/**
 * Elevated → LOW transitions (the area was cleaned) plus the open elevated run.
 * @param {Array<object>} seq one bin's LSI captures, oldest → newest
 */
function findCleanups(seq) {
  const cleanups = [];
  let runStart = null;
  let peak = null;
  for (const c of seq) {
    const sev = normalizeSeverity(c.litter_severity);
    const lsi = Number(c.litter_lsi);
    if (ELEVATED.has(sev)) {
      if (!runStart) runStart = c;
      if (!peak || lsi > peak.lsi) peak = { lsi, severity: sev, at: c.captured_at };
    } else if (sev === "LOW" && runStart) {
      cleanups.push({
        at: c.captured_at,
        capture_id: c.id,
        before_lsi: round1(peak.lsi),
        before_severity: peak.severity,
        after_lsi: round1(lsi),
        elevated_since: runStart.captured_at,
        hours_elevated: round1((ts(c) - ts(runStart)) / 3_600_000),
      });
      runStart = null;
      peak = null;
    }
  }
  return {
    cleanups,
    open_run: runStart
      ? {
          elevated_since: runStart.captured_at,
          peak_lsi: round1(peak.lsi),
          peak_severity: peak.severity,
        }
      : null,
  };
}

function feedbackStats(feedback) {
  const out = {
    severity: { total: 0, correct: 0, accuracy: null, confusion: {} },
    action: { total: 0, correct: 0, accuracy: null, false_alarms: 0, missed: 0 },
  };
  for (const f of feedback || []) {
    const bucket = out[f.model];
    if (!bucket) continue;
    bucket.total += 1;
    if (f.verdict === "correct") bucket.correct += 1;
    if (f.model === "severity" && f.predicted_label && f.corrected_label) {
      const key = `${f.predicted_label}->${f.corrected_label}`;
      bucket.confusion[key] = (bucket.confusion[key] || 0) + 1;
    }
    if (f.model === "action" && f.verdict === "incorrect") {
      if (f.predicted_label === "littering") bucket.false_alarms += 1;
      else bucket.missed += 1;
    }
  }
  for (const b of Object.values(out)) {
    b.accuracy = b.total ? round1((b.correct / b.total) * 100) : null;
  }
  return out;
}

/**
 * @param {{
 *   captures: object[], devices?: object[], outlines?: object[], feedback?: object[],
 *   days: number, tzOffsetMin?: number, now?: number, confirmation?: object
 * }} input
 */
function buildLitterSummary({
  captures,
  devices = [],
  outlines = [],
  feedback = [],
  days,
  tzOffsetMin = 0,
  now = Date.now(),
  confirmation = {},
}) {
  const sorted = [...(captures || [])].sort((a, b) => ts(a) - ts(b));
  const lsiCaps = sorted.filter(hasLsi);
  const episodes = summarizeLitteringEpisodes(sorted, confirmation);

  const sevCount = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  let lsiSum = 0;
  for (const c of lsiCaps) {
    const sev = normalizeSeverity(c.litter_severity);
    if (sevCount[sev] != null) sevCount[sev] += 1;
    lsiSum += Number(c.litter_lsi);
  }

  // Each confirmed episode counts once, at the time it started.
  const confirmedEpisodeStarts = new Map();
  for (const [id, rec] of episodes.annotated) {
    if (!rec.episode_confirmed || confirmedEpisodeStarts.has(rec.episode_key)) continue;
    const cap = sorted.find((c) => c.id === id);
    confirmedEpisodeStarts.set(rec.episode_key, {
      t: new Date(rec.episode_start).getTime(),
      device_id: cap?.device_id ?? null,
    });
  }

  const daily = [];
  const dailyIndex = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const { date } = localParts(now - i * DAY_MS, tzOffsetMin);
    if (dailyIndex.has(date)) continue;
    const bucket = { date, captures: 0, lsi_sum: 0, max_lsi: null, high: 0, events: 0 };
    dailyIndex.set(date, bucket);
    daily.push(bucket);
  }

  const heatmap = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ captures: 0, high: 0, events: 0, lsi_sum: 0 }))
  );

  for (const c of lsiCaps) {
    const lsi = Number(c.litter_lsi);
    const { dow, hour, date } = localParts(ts(c), tzOffsetMin);
    const cell = heatmap[dow][hour];
    cell.captures += 1;
    cell.lsi_sum += lsi;
    const isHigh = normalizeSeverity(c.litter_severity) === "HIGH";
    if (isHigh) cell.high += 1;
    const day = dailyIndex.get(date);
    if (day) {
      day.captures += 1;
      day.lsi_sum += lsi;
      day.max_lsi = day.max_lsi == null ? lsi : Math.max(day.max_lsi, lsi);
      if (isHigh) day.high += 1;
    }
  }
  for (const ep of confirmedEpisodeStarts.values()) {
    const { dow, hour, date } = localParts(ep.t, tzOffsetMin);
    heatmap[dow][hour].events += 1;
    const day = dailyIndex.get(date);
    if (day) day.events += 1;
  }

  let peak = null;
  const heatmapOut = heatmap.map((row, dow) =>
    row.map((cell, hour) => {
      const score = cell.events * 2 + cell.high;
      if (score > 0 && (!peak || score > peak.score)) {
        peak = { dow, hour, events: cell.events, high: cell.high, score };
      }
      return {
        captures: cell.captures,
        high: cell.high,
        events: cell.events,
        avg_lsi: cell.captures ? round1(cell.lsi_sum / cell.captures) : null,
      };
    })
  );

  const outlineByDevice = new Set(
    (outlines || [])
      .filter((o) => Array.isArray(o.bin_polygon) && o.bin_polygon.length >= 3)
      .map((o) => Number(o.device_id))
  );
  const deviceById = new Map((devices || []).map((d) => [Number(d.id), d]));

  const perDevice = new Map();
  for (const c of sorted) {
    if (c.device_id == null) continue;
    const id = Number(c.device_id);
    if (!perDevice.has(id)) perDevice.set(id, []);
    perDevice.get(id).push(c);
  }
  const confirmedByDevice = new Map();
  for (const ep of confirmedEpisodeStarts.values()) {
    if (ep.device_id == null) continue;
    const id = Number(ep.device_id);
    confirmedByDevice.set(id, (confirmedByDevice.get(id) || 0) + 1);
  }

  const bins = [];
  const cleanups = [];
  for (const [id, caps] of perDevice) {
    const seq = caps.filter(hasLsi);
    const d = deviceById.get(id) || {};
    const lsis = seq.map((c) => Number(c.litter_lsi));
    const severities = seq.map((c) => normalizeSeverity(c.litter_severity));
    const latest = seq[seq.length - 1] || null;
    const slope = slopePerDay(
      seq.slice(-TREND_POINTS).map((c) => ({ t: ts(c), v: Number(c.litter_lsi) }))
    );
    const { cleanups: binCleanups, open_run: openRun } = findCleanups(seq);
    const name = d.name || formatBinCode(id);
    for (const cl of binCleanups) {
      cleanups.push({ ...cl, device_id: id, bin_code: formatBinCode(id), name });
    }

    bins.push({
      device_id: id,
      bin_code: formatBinCode(id),
      name,
      location: d.location || d.address || null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      captures: seq.length,
      avg_lsi: lsis.length ? round1(lsis.reduce((a, b) => a + b, 0) / lsis.length) : null,
      max_lsi: lsis.length ? round1(Math.max(...lsis)) : null,
      high: severities.filter((s) => s === "HIGH").length,
      medium: severities.filter((s) => s === "MEDIUM").length,
      littering_frames: caps.filter((c) => episodes.annotated.has(c.id)).length,
      littering_confirmed: confirmedByDevice.get(id) || 0,
      latest_lsi: latest ? round1(Number(latest.litter_lsi)) : null,
      latest_severity: latest ? normalizeSeverity(latest.litter_severity) : null,
      latest_at: latest?.captured_at ?? null,
      trend_per_day: round1(slope),
      trend: trendLabel(slope),
      status: binStatus(severities),
      elevated_since: openRun?.elevated_since ?? null,
      cleanups: binCleanups.length,
      has_outline: outlineByDevice.has(id),
    });
  }

  const statusRank = { persistent: 0, watch: 1, recovered: 2, clean: 3, unknown: 4 };
  bins.sort(
    (a, b) =>
      (statusRank[a.status] ?? 5) - (statusRank[b.status] ?? 5) ||
      (b.avg_lsi ?? -1) - (a.avg_lsi ?? -1)
  );
  cleanups.sort((a, b) => new Date(b.at) - new Date(a.at));

  return {
    range: {
      days,
      since: new Date(now - days * DAY_MS).toISOString(),
      until: new Date(now).toISOString(),
      tz_offset_minutes: tzOffsetMin,
    },
    totals: {
      captures_analyzed: lsiCaps.length,
      avg_lsi: lsiCaps.length ? round1(lsiSum / lsiCaps.length) : null,
      low: sevCount.LOW,
      medium: sevCount.MEDIUM,
      high: sevCount.HIGH,
      high_share: lsiCaps.length ? round1((sevCount.HIGH / lsiCaps.length) * 100) : null,
      littering_frames: episodes.frames,
      littering_episodes: episodes.episodes,
      littering_confirmed: episodes.confirmed,
      littering_unconfirmed: episodes.unconfirmed,
      bins_with_data: bins.length,
      bins_persistent: bins.filter((b) => b.status === "persistent").length,
      bins_rising: bins.filter((b) => b.trend === "rising").length,
      cleanups: cleanups.length,
    },
    daily: daily.map((d) => ({
      date: d.date,
      captures: d.captures,
      avg_lsi: d.captures ? round1(d.lsi_sum / d.captures) : null,
      max_lsi: round1(d.max_lsi),
      high: d.high,
      events: d.events,
    })),
    heatmap: heatmapOut,
    peak,
    bins,
    cleanups: cleanups.slice(0, 30),
    feedback: feedbackStats(feedback),
  };
}

module.exports = {
  localParts,
  slopePerDay,
  trendLabel,
  binStatus,
  findCleanups,
  feedbackStats,
  buildLitterSummary,
};
