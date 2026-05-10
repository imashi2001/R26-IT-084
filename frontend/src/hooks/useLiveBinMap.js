import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";

/*
 * useLiveBinMap
 * -------------
 * Single source of truth for the Live Monitoring page.
 *
 *   - Polls GET /devices/map every `intervalMs` (default 30s)
 *     -> array of bins with latitude/longitude + latest fill / risk / image.
 *   - Tries browser geolocation once. If granted, also polls
 *     GET /devices/nearest?lat&lng so we can highlight the closest bin.
 *   - Falls back to a deterministic centroid of the returned bins, then
 *     to a Sri Lanka default, when geolocation is unavailable.
 *
 * Returns:
 *   {
 *     bins,                // [{ id, name, latitude, longitude, latest_*, status_inferred, ... }]
 *     activeBins,          // bins with a recent capture (latest_captured_at not null)
 *     inactiveBins,        // bins with no captures yet
 *     nearestBinId,        // id of the closest bin (number) or null
 *     nearestDistanceM,    // meters or null
 *     userLocation,        // { lat, lng } or null
 *     center,              // [lat, lng] for initial map center
 *     loading, error, dbDisabled,
 *     refresh,             // () => void
 *   }
 *
 * 503 from /devices/map -> dbDisabled: true (lots of dev deploys run without
 * Postgres). UI surfaces an empty-state in that case.
 */

const DEFAULT_INTERVAL_MS = 30_000;
const SRI_LANKA_DEFAULT = [7.8731, 80.7718];
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

function parseTs(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function centroid(bins) {
  if (!bins || !bins.length) return null;
  let lat = 0;
  let lng = 0;
  let n = 0;
  for (const b of bins) {
    const a = Number(b.latitude);
    const o = Number(b.longitude);
    if (Number.isFinite(a) && Number.isFinite(o)) {
      lat += a;
      lng += o;
      n += 1;
    }
  }
  if (!n) return null;
  return [lat / n, lng / n];
}

export default function useLiveBinMap(intervalMs = DEFAULT_INTERVAL_MS) {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbDisabled, setDbDisabled] = useState(false);

  const [userLocation, setUserLocation] = useState(null);
  const [nearest, setNearest] = useState({ id: null, distanceM: null });

  const userLocationRef = useRef(null);
  userLocationRef.current = userLocation;

  // 1) Geolocation once on mount. If denied / unavailable we silently fall back.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // Permission denied / timeout. Stay null; UI will use fallback center.
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchBins = useCallback(async () => {
    try {
      const { data } = await axios.get(apiUrl("/devices/map"), {
        timeout: 8000,
      });
      const list = Array.isArray(data?.bins) ? data.bins : [];
      setBins(list);
      setError(null);
      setDbDisabled(false);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 503) {
        setDbDisabled(true);
        setError(null);
        setBins([]);
      } else {
        setError(e?.message || "Could not load bins.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNearest = useCallback(async () => {
    const u = userLocationRef.current;
    if (!u) return;
    try {
      const { data } = await axios.get(apiUrl("/devices/nearest"), {
        params: { lat: u.lat, lng: u.lng, limit: 1 },
        timeout: 8000,
      });
      const top = Array.isArray(data?.results) ? data.results[0] : null;
      if (top) {
        setNearest({ id: top.id, distanceM: top.distance_meters });
      } else {
        setNearest({ id: null, distanceM: null });
      }
    } catch {
      // Nearest is opportunistic — silently keep prior value.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (cancelled) return;
      await fetchBins();
      if (!cancelled) await fetchNearest();
    }
    tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [fetchBins, fetchNearest, intervalMs]);

  // Re-run nearest immediately once geolocation arrives.
  useEffect(() => {
    if (userLocation) fetchNearest();
  }, [userLocation, fetchNearest]);

  const enriched = useMemo(() => {
    const now = Date.now();
    return bins
      .filter(
        (b) =>
          b.latitude != null &&
          b.longitude != null &&
          Number.isFinite(Number(b.latitude)) &&
          Number.isFinite(Number(b.longitude))
      )
      .map((b) => {
        const ts = parseTs(b.latest_captured_at);
        const isFresh = ts > 0 && now - ts <= FRESH_WINDOW_MS;
        return {
          ...b,
          latitude: Number(b.latitude),
          longitude: Number(b.longitude),
          status_inferred: isFresh ? "active" : ts > 0 ? "stale" : "inactive",
        };
      });
  }, [bins]);

  const { activeBins, inactiveBins } = useMemo(() => {
    const active = enriched.filter(
      (b) => b.status_inferred === "active" || b.status_inferred === "stale"
    );
    const inactive = enriched.filter((b) => b.status_inferred === "inactive");
    active.sort(
      (a, b) => parseTs(b.latest_captured_at) - parseTs(a.latest_captured_at)
    );
    return { activeBins: active, inactiveBins: inactive };
  }, [enriched]);

  const center = useMemo(() => {
    if (userLocation) return [userLocation.lat, userLocation.lng];
    const c = centroid(enriched);
    if (c) return c;
    return SRI_LANKA_DEFAULT;
  }, [userLocation, enriched]);

  return {
    bins: enriched,
    activeBins,
    inactiveBins,
    nearestBinId: nearest.id,
    nearestDistanceM: nearest.distanceM,
    userLocation,
    center,
    loading,
    error,
    dbDisabled,
    refresh: fetchBins,
  };
}
