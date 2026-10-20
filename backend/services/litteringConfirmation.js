/**
 * Multi-frame littering confirmation.
 *
 * A single YOLO frame can fire on someone just walking past the bin. Frames
 * from the same bin that are close in time are grouped into one "episode";
 * the episode is confirmed once it has LITTERING_CONFIRM_MIN_FRAMES littering
 * frames, or any single frame reaches LITTERING_STRONG_CONFIDENCE.
 */

const {
  LITTERING_ALERT_CONFIDENCE,
  LITTERING_CONFIRM_MIN_FRAMES,
  LITTERING_CONFIRM_WINDOW_MS,
  LITTERING_STRONG_CONFIDENCE,
} = require("../config/env");

function confirmationOptions(opts = {}) {
  return {
    minConfidence: opts.minConfidence ?? LITTERING_ALERT_CONFIDENCE,
    minFrames: Math.max(1, opts.minFrames ?? LITTERING_CONFIRM_MIN_FRAMES),
    windowMs: opts.windowMs ?? LITTERING_CONFIRM_WINDOW_MS,
    strongConfidence: opts.strongConfidence ?? LITTERING_STRONG_CONFIDENCE,
  };
}

function isLitteringFrame(c, minConfidence = LITTERING_ALERT_CONFIDENCE) {
  return (
    Boolean(c?.littering_event_detected) &&
    (Number(c.littering_max_confidence) || 0) >= minConfidence
  );
}

function frameTime(c) {
  const t = new Date(c?.captured_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Group littering frames into per-bin episodes.
 * @param {Array<object>} captures any order; may mix bins
 * @returns {Map<any, {
 *   episode_key: string, episode_frames: number, episode_confirmed: boolean,
 *   first_confirming: boolean, first_confirming_id: any,
 *   episode_start: string, episode_end: string, episode_max_confidence: number
 * }>} keyed by capture id (littering frames only)
 */
function annotateLitteringEpisodes(captures, opts = {}) {
  const { minConfidence, minFrames, windowMs, strongConfidence } =
    confirmationOptions(opts);

  const byDevice = new Map();
  for (const c of captures || []) {
    if (!isLitteringFrame(c, minConfidence)) continue;
    const key = c.device_id != null ? `d${c.device_id}` : `c${c.id}`;
    if (!byDevice.has(key)) byDevice.set(key, []);
    byDevice.get(key).push(c);
  }

  const out = new Map();
  for (const [deviceKey, frames] of byDevice) {
    frames.sort((a, b) => frameTime(a) - frameTime(b) || (a.id || 0) - (b.id || 0));

    const episodes = [];
    let current = null;
    for (const f of frames) {
      const t = frameTime(f);
      if (!current || t - current.lastT > windowMs) {
        current = {
          key: `${deviceKey}:${f.id}`,
          members: [],
          lastT: t,
          confirmed: false,
          firstConfirmingId: null,
          maxConf: 0,
        };
        episodes.push(current);
      }
      current.lastT = t;
      current.members.push(f);
      const conf = Number(f.littering_max_confidence) || 0;
      current.maxConf = Math.max(current.maxConf, conf);
      if (
        !current.confirmed &&
        (current.members.length >= minFrames || conf >= strongConfidence)
      ) {
        current.confirmed = true;
        current.firstConfirmingId = f.id;
      }
    }

    for (const ep of episodes) {
      const start = ep.members[0];
      const end = ep.members[ep.members.length - 1];
      for (const f of ep.members) {
        out.set(f.id, {
          episode_key: ep.key,
          episode_frames: ep.members.length,
          episode_confirmed: ep.confirmed,
          first_confirming: ep.confirmed && ep.firstConfirmingId === f.id,
          first_confirming_id: ep.firstConfirmingId,
          episode_start: new Date(frameTime(start)).toISOString(),
          episode_end: new Date(frameTime(end)).toISOString(),
          episode_max_confidence: ep.maxConf,
        });
      }
    }
  }
  return out;
}

/** Totals for analytics: raw frames vs grouped episodes vs confirmed episodes. */
function summarizeLitteringEpisodes(captures, opts = {}) {
  const annotated = annotateLitteringEpisodes(captures, opts);
  const episodes = new Map();
  for (const rec of annotated.values()) {
    episodes.set(rec.episode_key, rec.episode_confirmed);
  }
  let confirmed = 0;
  for (const ok of episodes.values()) if (ok) confirmed += 1;
  return {
    frames: annotated.size,
    episodes: episodes.size,
    confirmed,
    unconfirmed: episodes.size - confirmed,
    annotated,
  };
}

module.exports = {
  confirmationOptions,
  isLitteringFrame,
  annotateLitteringEpisodes,
  summarizeLitteringEpisodes,
};
