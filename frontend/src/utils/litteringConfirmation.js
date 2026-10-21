/**
 * Browser copy of backend/services/litteringConfirmation.js so the dashboard
 * popup follows the same rule as littering alerts: littering frames from one
 * bin that are close in time form an episode, confirmed once it has
 * `min_frames` frames or one frame reaches `strong_confidence`.
 */

function frameTime(c) {
  const t = new Date(c?.captured_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function isLitteringFrame(c, minConfidence = 0.5) {
  return (
    Boolean(c?.littering_event_detected) &&
    (Number(c.littering_max_confidence) || 0) >= minConfidence
  );
}

/**
 * @param {object[]} captures any order
 * @param {{ min_confidence, min_frames, window_seconds, strong_confidence }} cfg
 * @returns {Map<any, { episode_frames: number, episode_confirmed: boolean, first_confirming: boolean }>}
 */
export function annotateLitteringEpisodes(captures, cfg = {}) {
  const minConfidence = cfg.min_confidence ?? 0.5;
  const minFrames = Math.max(1, cfg.min_frames ?? 2);
  const windowMs = (cfg.window_seconds ?? 30) * 1000;
  const strong = cfg.strong_confidence ?? 0.8;

  const byDevice = new Map();
  for (const c of captures || []) {
    if (!isLitteringFrame(c, minConfidence)) continue;
    const key = c.device_id != null ? `d${c.device_id}` : `c${c.id}`;
    if (!byDevice.has(key)) byDevice.set(key, []);
    byDevice.get(key).push(c);
  }

  const out = new Map();
  for (const frames of byDevice.values()) {
    frames.sort((a, b) => frameTime(a) - frameTime(b) || (a.id || 0) - (b.id || 0));
    const episodes = [];
    let current = null;
    for (const f of frames) {
      const t = frameTime(f);
      if (!current || t - current.lastT > windowMs) {
        current = { members: [], lastT: t, confirmed: false, firstId: null };
        episodes.push(current);
      }
      current.lastT = t;
      current.members.push(f);
      const conf = Number(f.littering_max_confidence) || 0;
      if (!current.confirmed && (current.members.length >= minFrames || conf >= strong)) {
        current.confirmed = true;
        current.firstId = f.id;
      }
    }
    for (const ep of episodes) {
      for (const f of ep.members) {
        out.set(f.id, {
          episode_frames: ep.members.length,
          episode_confirmed: ep.confirmed,
          first_confirming: ep.confirmed && ep.firstId === f.id,
        });
      }
    }
  }
  return out;
}
