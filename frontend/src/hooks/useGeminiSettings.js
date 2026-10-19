import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";

export const VOICE_SOURCE_OPTIONS = [
  {
    value: "models",
    label: "Our models",
    description: "Voice from YOLO / existing model pipeline only.",
  },
  {
    value: "gemini",
    label: "Gemini",
    description: "Voice from Gemini Vision only.",
  },
  {
    value: "both",
    label: "Both (Gemini high priority)",
    description:
      "Run both; Gemini wins for voice when valid, else fall back to our models.",
  },
];

export function defaultGeminiSettings() {
  return {
    voice_source: "models",
    gemini_model: "gemini-2.0-flash",
    key_configured: false,
    key_last4: null,
    last_prediction: null,
    updated_at: null,
    voice_source_options: VOICE_SOURCE_OPTIONS,
  };
}

export async function fetchGeminiSettings() {
  const { data } = await axios.get(apiUrl("/dashboard/settings/gemini"), {
    timeout: 8000,
  });
  return data;
}

export async function saveGeminiSettings(authFetch, payload) {
  const res = await authFetch("/dashboard/settings/gemini", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export default function useGeminiSettings(intervalMs = 15_000) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchGeminiSettings();
      setSettings(data);
      setError(null);
    } catch (e) {
      setError(e?.message || "Could not load Gemini settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!intervalMs || intervalMs < 1000) return undefined;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { settings, setSettings, loading, error, refresh };
}
