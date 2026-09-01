import { effectiveFillTier } from "./fillTier";

/** Public landing availability bands (prompt legend). */
export const BIN_STATUS = {
  available: {
    key: "available",
    label: "Available",
    color: "#2E7D32",
    priority: 0,
  },
  near_full: {
    key: "near_full",
    label: "Near Full",
    color: "#F59E0B",
    priority: 1,
  },
  full: {
    key: "full",
    label: "Full",
    color: "#EF4444",
    priority: 2,
  },
  overflow: {
    key: "overflow",
    label: "Overflow",
    color: "#8B5CF6",
    priority: 3,
  },
};

export function fillPercent(bin) {
  const p = Number(bin?.latest_fill_percentage);
  if (Number.isFinite(p)) return Math.max(0, Math.min(100, Math.round(p)));
  const tier = effectiveFillTier(bin || {});
  if (tier === "empty") return 25;
  if (tier === "half") return 55;
  if (tier === "overflow") return 92;
  return null;
}

export function binAvailability(bin) {
  const tier = effectiveFillTier(bin || {});
  const pct = fillPercent(bin);

  if (tier === "overflow" || (pct != null && pct >= 90)) {
    return BIN_STATUS.overflow;
  }
  if (tier === "half" && pct != null && pct >= 70) {
    return BIN_STATUS.full;
  }
  if (tier === "half" || (pct != null && pct >= 55)) {
    return BIN_STATUS.near_full;
  }
  if (tier === "empty" || (pct != null && pct < 55)) {
    return BIN_STATUS.available;
  }
  if (pct != null && pct >= 70) return BIN_STATUS.full;
  if (pct != null && pct >= 40) return BIN_STATUS.near_full;
  return BIN_STATUS.available;
}

/** Prefer available / less-full, then closer distance. */
export function rankBinsForPublic(bins) {
  return [...(bins || [])].sort((a, b) => {
    const sa = binAvailability(a).priority;
    const sb = binAvailability(b).priority;
    if (sa !== sb) return sa - sb;
    const da = Number(a.distance_meters) || Number.POSITIVE_INFINITY;
    const db = Number(b.distance_meters) || Number.POSITIVE_INFINITY;
    return da - db;
  });
}

export function formatDistance(meters) {
  const m = Number(meters);
  if (!Number.isFinite(m)) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Demo pins when DATABASE_URL is unset (landing still demos the UX). */
export function demoBinsNear(lat, lng, queryLabel = "Malabe") {
  const baseLat = Number.isFinite(lat) ? lat : 6.9147;
  const baseLng = Number.isFinite(lng) ? lng : 79.9729;
  const area = queryLabel || "Malabe";
  return [
    {
      id: "demo-1",
      name: `${area} Town Center`,
      location: area,
      address: `${area}, Sri Lanka`,
      latitude: baseLat + 0.0012,
      longitude: baseLng + 0.0008,
      distance_meters: 250,
      latest_fill_percentage: 32,
      latest_fill_level: "empty",
      _demo: true,
    },
    {
      id: "demo-2",
      name: `${area} Bus Stand`,
      location: area,
      address: `${area}, Sri Lanka`,
      latitude: baseLat - 0.0015,
      longitude: baseLng + 0.0018,
      distance_meters: 450,
      latest_fill_percentage: 45,
      latest_fill_level: "empty",
      _demo: true,
    },
    {
      id: "demo-3",
      name: `${area} IT Park`,
      location: area,
      address: `${area}, Sri Lanka`,
      latitude: baseLat + 0.0024,
      longitude: baseLng - 0.0011,
      distance_meters: 650,
      latest_fill_percentage: 68,
      latest_fill_level: "half",
      _demo: true,
    },
    {
      id: "demo-4",
      name: `${area} Market`,
      location: area,
      address: `${area}, Sri Lanka`,
      latitude: baseLat - 0.0028,
      longitude: baseLng - 0.002,
      distance_meters: 820,
      latest_fill_percentage: 88,
      latest_fill_level: "half",
      _demo: true,
    },
  ];
}

export const POPULAR_AREAS = [
  "Malabe",
  "Kaduwela",
  "Kottawa",
  "Battaramulla",
  "Nugegoda",
  "Colombo 07",
];
