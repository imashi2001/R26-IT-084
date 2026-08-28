import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";

/** Bundled fallback when no custom hero is uploaded. */
export const DEFAULT_HERO_PATH = "/dashboard/default-hero.jpg";

export function resolveHeroUrl(settings) {
  if (settings?.hero_image_url) return settings.hero_image_url;
  return DEFAULT_HERO_PATH;
}

export async function fetchDashboardSettings() {
  const { data } = await axios.get(apiUrl("/dashboard/settings"), {
    timeout: 8000,
  });
  return data;
}

export async function uploadDashboardHero(authFetch, file) {
  const fd = new FormData();
  fd.append("image", file);
  const res = await authFetch("/dashboard/settings/hero", {
    method: "POST",
    body: fd,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export async function removeDashboardHero(authFetch) {
  const res = await authFetch("/dashboard/settings/hero", {
    method: "DELETE",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export default function useDashboardSettings(intervalMs = 120_000) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchDashboardSettings();
      setSettings(data);
      setError(null);
    } catch (e) {
      setError(e?.message || "Could not load dashboard settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [refresh, intervalMs]);

  const heroUrl = resolveHeroUrl(settings);

  return { settings, heroUrl, loading, error, refresh, setSettings };
}
