/**
 * Collection route planning helpers (Half + Overflow stops, multi-stop OSRM).
 */

import { effectiveFillTier } from "./fillTier";
import { collectionUrgency, sortBinsByCollectionUrgency } from "./collectionPriority";
import { apiUrl } from "./apiBase";

export function filterCollectionStops(bins) {
  return (bins || []).filter((b) => {
    const tier = effectiveFillTier(b);
    return tier === "half" || tier === "overflow";
  });
}

export function sortCollectionStops(bins) {
  const list = filterCollectionStops(bins);
  const overflow = list.filter((b) => effectiveFillTier(b) === "overflow");
  const half = list.filter((b) => effectiveFillTier(b) === "half");
  return [
    ...sortBinsByCollectionUrgency(overflow),
    ...sortBinsByCollectionUrgency(half),
  ];
}

export function isVirtualBin(bin) {
  return String(bin?.bin_type || "smart").toLowerCase() === "virtual";
}

export async function fetchCollectionPlan(start, startMode = "gps") {
  const res = await fetch(apiUrl("/collection/plan"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start: { latitude: start[0], longitude: start[1] },
      start_mode: startMode,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

export async function fetchMultiStopDrivingRoute(start, stops) {
  const points = [start, ...(stops || []).map((s) => [s.latitude, s.longitude])];
  if (points.length < 2) {
    return { path: points, approximate: true, distanceM: 0, durationS: 0 };
  }

  const coordStr = points
    .map(([lat, lng]) => `${Number(lng)},${Number(lat)}`)
    .join(";");

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("OSRM failed");
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) {
      throw new Error("No route");
    }
    const route = data.routes[0];
    const path = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    return {
      path,
      approximate: false,
      distanceM: route.distance,
      durationS: route.duration,
    };
  } catch {
    const path = points.map(([lat, lng]) => [Number(lat), Number(lng)]);
    return { path, approximate: true, distanceM: null, durationS: null };
  }
}

/** Google Maps URL — max ~10 waypoints between origin and destination. */
export function buildGoogleMapsMultiStopUrl(start, stops) {
  if (!start || !stops?.length) return null;
  const origin = `${start[0]},${start[1]}`;
  const dest = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination: dest,
    travelmode: "driving",
  });
  if (stops.length > 1) {
    const waypoints = stops
      .slice(0, -1)
      .slice(0, 9)
      .map((s) => `${s.latitude},${s.longitude}`)
      .join("|");
    if (waypoints) params.set("waypoints", waypoints);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function formatRouteDistance(m) {
  if (m == null || !Number.isFinite(Number(m))) return "—";
  const n = Number(m);
  if (n < 1000) return `${Math.round(n)} m`;
  return `${(n / 1000).toFixed(1)} km`;
}

export function formatRouteDuration(sec) {
  if (sec == null || !Number.isFinite(Number(sec))) return "—";
  const n = Math.round(Number(sec));
  if (n < 60) return `${n}s`;
  const mins = Math.round(n / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function stopUrgencyLabel(stop) {
  return stop?.urgency ?? collectionUrgency(stop);
}
