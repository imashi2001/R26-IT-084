import { AlertTriangle, PawPrint, MapPin, Trash2 } from "lucide-react";
import { formatBinCode, coerceLocation } from "./dashboardBins";
import { annotateLitteringEpisodes } from "./litteringConfirmation";
import { formatLsi } from "./litterSeverity";

function isHigh(c) {
  return String(c?.litter_severity || "").trim().toUpperCase() === "HIGH";
}

/**
 * Captures that completed a run of `streak` HIGH litter readings on one bin.
 * Keyed by the capture that reached the streak, so a growing run pops up once.
 */
function addBinTriggers(captures, streak) {
  const byDevice = new Map();
  for (const c of captures || []) {
    if (c?.device_id == null || c.litter_severity == null) continue;
    if (!byDevice.has(c.device_id)) byDevice.set(c.device_id, []);
    byDevice.get(c.device_id).push(c);
  }
  const triggers = new Set();
  for (const list of byDevice.values()) {
    list.sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
    let run = 0;
    for (const c of list) {
      run = isHigh(c) ? run + 1 : 0;
      if (run === streak) triggers.add(c.id);
    }
  }
  return triggers;
}

/**
 * Build popup-worthy alerts from captures (illegal dumping, animal detection,
 * and optional litter severity popups).
 * @param {object[]} captures
 * @param {object|null} litterSettings popup switches from /litter-insights/settings;
 *   null keeps the original behaviour (every littering frame pops up).
 */
export function buildDashboardPopupAlerts(captures, litterSettings = null) {
  const alerts = [];
  const litter = litterSettings;
  const episodes =
    litter?.popup_illegal_dumping && litter.popup_confirmed_only
      ? annotateLitteringEpisodes(captures, litter.confirmation)
      : null;
  const addBinIds = litter?.popup_add_bin
    ? addBinTriggers(captures, litter.add_bin_streak || 3)
    : null;
  const litterSilent = Boolean(litter) && !litter.popup_sound;

  for (const c of captures || []) {
    if (!c?.id) continue;

    const binId = formatBinCode(c.device_id);
    const location = coerceLocation(c.location, c.device_location, c.address);
    const base = {
      captureId: c.id,
      deviceId: c.device_id,
      ts: c.captured_at,
      binId,
      binName: c.device_name || binId,
      location,
      fillLevel: c.fill_level,
      fillPercentage: c.fill_percentage,
      riskLevel: c.risk_level,
      wasteLabel: c.waste_label,
      sourceType: c.source_type,
    };
    const litterBase = {
      ...base,
      litterSeverity: c.litter_severity || null,
      litterLsi: c.litter_lsi ?? null,
      silent: litterSilent,
    };

    const littering = Boolean(c.littering_event_detected);
    const episode = episodes?.get(c.id);
    const showLittering =
      littering &&
      (!litter || (litter.popup_illegal_dumping && (!episodes || episode?.first_confirming)));
    if (showLittering) {
      const count = Number(c.littering_event_count) || 0;
      const conf = Number(c.littering_max_confidence) || 0;
      alerts.push({
        ...litterBase,
        id: `${c.id}-littering`,
        kind: "littering",
        title: "Illegal Dumping Detected",
        summary: `${count} dumping event${count === 1 ? "" : "s"} detected near this bin`,
        detail: episode
          ? `${(conf * 100).toFixed(0)}% model confidence · confirmed on ${episode.episode_frames} frame${episode.episode_frames === 1 ? "" : "s"}`
          : `${(conf * 100).toFixed(0)}% model confidence`,
        Icon: AlertTriangle,
        tone: "warn",
      });
    }

    if (addBinIds?.has(c.id)) {
      alerts.push({
        ...litterBase,
        id: `${c.id}-litter-add-bin`,
        kind: "litter_add_bin",
        title: "Add a New Bin Here",
        summary: `HIGH litter around this bin on ${litter.add_bin_streak || 3} captures in a row`,
        detail: `Latest LSI ${formatLsi(c.litter_lsi)} — capacity here is not enough`,
        Icon: MapPin,
        tone: "high",
      });
    } else if (litter?.popup_high_severity && isHigh(c)) {
      const count = Number(c.litter_detection_count) || 0;
      alerts.push({
        ...litterBase,
        id: `${c.id}-litter-high`,
        kind: "litter_high",
        title: "High Litter Severity",
        summary: `${count} litter object${count === 1 ? "" : "s"} around this bin`,
        detail: `LSI ${formatLsi(c.litter_lsi)} / 100`,
        Icon: Trash2,
        tone: "high",
      });
    }

    if ((Number(c.animal_count) || 0) > 0) {
      const count = Number(c.animal_count);
      alerts.push({
        ...base,
        id: `${c.id}-animal`,
        kind: "animal",
        title: "Animal Detected",
        summary: `${count} animal${count === 1 ? "" : "s"} spotted near this bin`,
        detail: `Risk level ${String(c.risk_level || "LOW").toUpperCase()}`,
        animalCount: count,
        Icon: PawPrint,
        tone: "warn",
      });
    }
  }

  return alerts.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );
}

const SEEN_KEY = "vw_dashboard_popup_seen";

export function getPopupSeenIds() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function markPopupSeen(id) {
  try {
    const seen = getPopupSeenIds();
    seen.add(id);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)));
  } catch {
    /* private browsing / storage blocked */
  }
}

export function markAllPopupSeen(ids) {
  try {
    const seen = getPopupSeenIds();
    ids.forEach((id) => seen.add(id));
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)));
  } catch {
    /* private browsing / storage blocked */
  }
}
