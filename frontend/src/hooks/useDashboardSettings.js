import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";
import { BRAND } from "../components/BrandLogo";

/**
 * Rewrites backend upload URLs so images load through the Vite dev proxy
 * (or VITE_API_URL in production). Fixes hero/promo not showing on localhost:3000.
 */
export function normalizeDashboardAssetUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.pathname.startsWith("/uploads/dashboard/")) {
      return apiUrl(`${parsed.pathname}${parsed.search}`);
    }
    return trimmed;
  } catch {
    if (trimmed.startsWith("/uploads/")) {
      return apiUrl(trimmed);
    }
    return trimmed;
  }
}

export function resolveHeroUrl(settings) {
  return (
    normalizeDashboardAssetUrl(settings?.hero_image_url) || BRAND.heroDefault
  );
}

export function resolvePromoUrl(settings) {
  return normalizeDashboardAssetUrl(settings?.promo_image_url);
}

export async function fetchDashboardSettings() {
  const { data } = await axios.get(apiUrl("/dashboard/settings"), {
    timeout: 8000,
  });
  return data;
}

async function uploadImage(authFetch, path, file) {
  const fd = new FormData();
  fd.append("image", file);
  const res = await authFetch(path, { method: "POST", body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  if (body.hero_image_url) {
    body.hero_image_url = normalizeDashboardAssetUrl(body.hero_image_url);
  }
  if (body.promo_image_url) {
    body.promo_image_url = normalizeDashboardAssetUrl(body.promo_image_url);
  }
  return body;
}

async function removeImage(authFetch, path) {
  const res = await authFetch(path, { method: "DELETE" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export function uploadDashboardHero(authFetch, file) {
  return uploadImage(authFetch, "/dashboard/settings/hero", file);
}

export function removeDashboardHero(authFetch) {
  return removeImage(authFetch, "/dashboard/settings/hero");
}

export function uploadDashboardPromo(authFetch, file) {
  return uploadImage(authFetch, "/dashboard/settings/promo", file);
}

export function removeDashboardPromo(authFetch) {
  return removeImage(authFetch, "/dashboard/settings/promo");
}

export default function useDashboardSettings(intervalMs = 120_000) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchDashboardSettings();
      setSettings({
        ...data,
        hero_image_url: normalizeDashboardAssetUrl(data?.hero_image_url),
        promo_image_url: normalizeDashboardAssetUrl(data?.promo_image_url),
      });
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

  return {
    settings,
    heroUrl: resolveHeroUrl(settings),
    promoUrl: resolvePromoUrl(settings),
    loading,
    error,
    refresh,
    setSettings,
  };
}
