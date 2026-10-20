/** Dashboard popup switches for litter severity + littering action (GET/PUT /litter-insights/settings). */

import axios from "axios";
import { apiUrl } from "./apiBase";

/** Fired after the Settings page saves, so open dashboards apply it immediately. */
export const LITTER_POPUP_SETTINGS_EVENT = "vw:litter-popup-settings";

export const DEFAULT_LITTER_POPUP_SETTINGS = Object.freeze({
  popup_illegal_dumping: true,
  popup_confirmed_only: true,
  popup_add_bin: true,
  popup_high_severity: false,
  popup_sound: true,
  confirmation: {
    min_confidence: 0.5,
    min_frames: 2,
    window_seconds: 30,
    strong_confidence: 0.8,
  },
  add_bin_streak: 3,
});

export function withPopupDefaults(raw) {
  const base = DEFAULT_LITTER_POPUP_SETTINGS;
  return {
    ...base,
    ...(raw || {}),
    confirmation: { ...base.confirmation, ...(raw?.confirmation || {}) },
  };
}

export async function fetchLitterPopupSettings() {
  const { data } = await axios.get(apiUrl("/litter-insights/settings"), {
    timeout: 8000,
  });
  return withPopupDefaults(data);
}

export async function saveLitterPopupSettings(patch) {
  const { data } = await axios.put(apiUrl("/litter-insights/settings"), patch);
  const saved = withPopupDefaults(data);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LITTER_POPUP_SETTINGS_EVENT, { detail: saved }));
  }
  return saved;
}
