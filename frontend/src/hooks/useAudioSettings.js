import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";

export const BUILTIN_SCENARIO_KEYS = [
  "illegal_dumping",
  "waste_full",
  "animal_detected",
  "correct_dumping",
];

export const BUILTIN_LABELS = {
  illegal_dumping: "Illegal dumping",
  waste_full: "Waste full / overflow",
  animal_detected: "Animal detected",
  correct_dumping: "Correct dumping",
};

export const AUTO_CONDITION_OPTIONS = [
  { value: "manual_only", label: "Manual test only" },
  { value: "risk_high", label: "Auto: HIGH risk" },
  { value: "risk_critical", label: "Auto: CRITICAL risk" },
  { value: "risk_medium", label: "Auto: MEDIUM risk" },
];

export function formatTrackLabel(track) {
  const n = Number(track);
  if (!Number.isFinite(n)) return "0001";
  return String(Math.trunc(n)).padStart(4, "0");
}

export function mp3Path(track) {
  return `/MP3/${formatTrackLabel(track)}.mp3`;
}

export function defaultAudioSettings() {
  return {
    tracks: {
      illegal_dumping: 1,
      waste_full: 2,
      animal_detected: 3,
      correct_dumping: 4,
    },
    custom_scenarios: [],
    updated_at: null,
  };
}

export function allTestTracks(settings) {
  const s = settings || defaultAudioSettings();
  const labels = s.builtin_labels || BUILTIN_LABELS;
  const rows = BUILTIN_SCENARIO_KEYS.map((key) => ({
    key,
    label: labels[key] || BUILTIN_LABELS[key] || key,
    track: Number(s.tracks?.[key]) || defaultAudioSettings().tracks[key],
    builtin: true,
  }));
  for (const c of s.custom_scenarios || []) {
    rows.push({
      key: c.id,
      label: c.label,
      track: Number(c.track) || 1,
      builtin: false,
      auto_condition: c.auto_condition || "manual_only",
    });
  }
  return rows;
}

export async function fetchAudioSettings() {
  const { data } = await axios.get(apiUrl("/dashboard/settings/audio"), {
    timeout: 8000,
  });
  return data;
}

export async function saveAudioSettings(authFetch, payload) {
  const res = await authFetch("/dashboard/settings/audio", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export default function useAudioSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAudioSettings();
      setSettings(data);
      setError(null);
    } catch (e) {
      setError(e?.message || "Could not load audio settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    settings,
    testTracks: allTestTracks(settings),
    loading,
    error,
    refresh,
    setSettings,
  };
}
