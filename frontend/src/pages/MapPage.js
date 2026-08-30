import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  useMap,
  useMapEvents,
  Polyline,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPinned,
  RefreshCw,
  Truck,
  Navigation,
  XCircle,
  Crosshair,
  AlertTriangle,
  ChevronRight,
  ListOrdered,
  Database,
} from "lucide-react";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
import { apiUrl } from "../utils/apiBase";
import {
  normalizeFill,
  effectiveFillTier,
  fillLabel,
  markerFillFromBin,
} from "../utils/fillTier";
import {
  collectionUrgency,
  needsCollectionSoon,
  sortBinsByCollectionUrgency,
  urgencyBand,
} from "../utils/collectionPriority";
import {
  fetchCollectionPlan,
  fetchMultiStopDrivingRoute,
  buildGoogleMapsMultiStopUrl,
  formatRouteDistance,
  formatRouteDuration,
  isVirtualBin,
} from "../utils/collectionRoute";

/*
 * /map — Collection planning map (dashboard shell).
 *
 * Goals:
 *   - Same Voyager + CircleMarker visual language as Live Monitoring.
 *   - Nearest-bin flows use **driving** OSRM preview + Google Maps (driving)
 *     for collection trucks (not walking).
 *   - "Collect ASAP" panel: bins sorted by transparent urgency heuristic
 *     (overflow / fill % / hygienic risk); crews can focus the map from a row click.
 *   - Keeps GET /devices/map + GET /devices/nearest — no backend changes.
 */

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const LEGEND = [
  { color: "#22c55e", label: "Empty" },
  { color: "#f59e0b", label: "Half" },
  { color: "#ef4444", label: "Overflow" },
  { color: "#818cf8", label: "Unknown" },
];

const NEAREST_FILL_LEVELS = new Set(["empty", "half"]);

async function fetchDrivingRoute(from, to) {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const straight = () => ({
    path: [
      [lat1, lng1],
      [lat2, lng2],
    ],
    approximate: true,
  });
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return straight();
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) {
      return straight();
    }
    const path = data.routes[0].geometry.coordinates.map(([lng, lat]) => [
      lat,
      lng,
    ]);
    return { path, approximate: false };
  } catch {
    return straight();
  }
}

function parseTs(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function relativeCapture(iso) {
  if (!iso) return "—";
  const t = parseTs(iso);
  if (!t) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return `${Math.round(diff / 86400_000)}d ago`;
}

function formatDistance(m) {
  if (m == null || !Number.isFinite(Number(m))) return "—";
  const n = Number(m);
  if (n < 1000) return `${Math.round(n)} m`;
  return `${(n / 1000).toFixed(1)} km`;
}

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (
      !center ||
      center.length < 2 ||
      !Number.isFinite(Number(center[0])) ||
      !Number.isFinite(Number(center[1]))
    ) {
      return;
    }
    map.flyTo(
      [Number(center[0]), Number(center[1])],
      zoom ?? 15,
      { duration: 0.75 }
    );
  }, [map, center, zoom]);
  return null;
}

function FitRouteBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    const b = L.latLngBounds(positions);
    map.fitBounds(b, { padding: [72, 72], maxZoom: 15 });
  }, [map, positions]);
  return null;
}

function MapDepotPicker({ active, onPick }) {
  useMapEvents({
    click(e) {
      if (!active) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function fillBadgeClass(tierKey) {
  switch (tierKey) {
    case "overflow":
      return "bg-red-50 text-red-700 border-red-200";
    case "half":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "empty":
      return "bg-brand-50 text-brand-700 border-brand-200";
    default:
      return "bg-slate-100 text-ink-500 border-slate-200";
  }
}

function riskTextClass(level) {
  if (level === "HIGH" || level === "CRITICAL") return "text-red-600 font-semibold";
  if (level === "MEDIUM") return "text-amber-600 font-semibold";
  return "text-ink-600";
}

export default function MapPage() {
  const [bins, setBins] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [routeSummary, setRouteSummary] = useState(null);
  const [userLatLng, setUserLatLng] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [routeApproximate, setRouteApproximate] = useState(false);
  const [routeTargetBinId, setRouteTargetBinId] = useState(null);
  const [focusBinId, setFocusBinId] = useState(null);
  const [startMode, setStartMode] = useState("gps");
  const [depotLatLng, setDepotLatLng] = useState(null);
  const [depotPickActive, setDepotPickActive] = useState(false);
  const [collectionStops, setCollectionStops] = useState([]);
  const [collectionMeta, setCollectionMeta] = useState(null);
  const [collectionBusy, setCollectionBusy] = useState(false);
  const markerRefs = useRef(new Map());

  const defaultCenter = useMemo(() => [7.8731, 80.7718], []);

  const binsOnMap = useMemo(
    () =>
      bins.filter(
        (b) =>
          b.latitude != null &&
          b.longitude != null &&
          Number.isFinite(Number(b.latitude)) &&
          Number.isFinite(Number(b.longitude))
      ),
    [bins]
  );

  const urgentBins = useMemo(() => {
    const flagged = binsOnMap.filter(needsCollectionSoon);
    return sortBinsByCollectionUrgency(flagged);
  }, [binsOnMap]);

  const sortedAllByUrgency = useMemo(
    () => sortBinsByCollectionUrgency(binsOnMap),
    [binsOnMap]
  );

  const clearNavigationUi = useCallback(() => {
    setToast(null);
    setRouteSummary(null);
    setUserLatLng(null);
    setRoutePath(null);
    setRouteApproximate(false);
    setRouteTargetBinId(null);
    setCollectionStops([]);
    setCollectionMeta(null);
    setDepotPickActive(false);
  }, []);

  const loadMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    clearNavigationUi();
    try {
      const res = await fetch(apiUrl("/devices/map"));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setBins(Array.isArray(data.bins) ? data.bins : []);
    } catch (e) {
      setError(e.message || "Could not load map data.");
      setBins([]);
    } finally {
      setLoading(false);
    }
  }, [clearNavigationUi]);

  useEffect(() => {
    loadMap();
  }, [loadMap]);

  /** Fly map + open popup when list focuses a bin */
  useEffect(() => {
    if (!focusBinId) return;
    const t = setTimeout(() => {
      const ref = markerRefs.current.get(focusBinId);
      if (ref) ref.openPopup();
    }, 400);
    return () => clearTimeout(t);
  }, [focusBinId]);

  const runGeo = useCallback(
    (mode) => {
      clearNavigationUi();
      if (!navigator.geolocation) {
        setToast({
          tone: "error",
          message: "Geolocation is not supported in this browser.",
        });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const me = [lat, lng];
          try {
            const res = await fetch(
              apiUrl(
                `/devices/nearest?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&limit=50`
              )
            );
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.error || `HTTP ${res.status}`);
            }
            const data = await res.json();
            const results = Array.isArray(data.results) ? data.results : [];
            if (!results.length) {
              setToast({
                tone: "warn",
                message: "No bins with coordinates found.",
              });
              return;
            }

            if (mode === "urgent") {
              const urgent = results.filter(needsCollectionSoon);
              if (!urgent.length) {
                setToast({
                  tone: "warn",
                  message:
                    "No bins match the urgent-collection rules nearby (overflow / high fill / elevated risk). Use “Nearest bin” or check the priority list.",
                });
                setUserLatLng(me);
                setFocusBinId(null);
                return;
              }
              const top = urgent[0];
              const binLatLng = [top.latitude, top.longitude];
              const { path, approximate } = await fetchDrivingRoute(me, binLatLng);
              setUserLatLng(me);
              setRoutePath(path);
              setRouteApproximate(approximate);
              setRouteTargetBinId(top.id);
              setFocusBinId(top.id);
              const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${lat},${lng}`)}&destination=${encodeURIComponent(`${top.latitude},${top.longitude}`)}&travelmode=driving`;
              setRouteSummary({
                mode: "urgent",
                name: top.name,
                distanceM: top.distance_meters,
                fillTier: effectiveFillTier(top),
                fillPct: top.latest_fill_percentage,
                risk: top.latest_risk_level,
                urgency: collectionUrgency(top),
                approximate,
                mapsUrl,
              });
              return;
            }

            /* mode === 'capacity' — nearest bin that still has disposal capacity */
            const eligible = results.filter((r) =>
              NEAREST_FILL_LEVELS.has(effectiveFillTier(r))
            );
            if (!eligible.length) {
              setToast({
                tone: "warn",
                message:
                  "No bins with spare capacity nearby (empty / half). Try urgent pickup or another area.",
              });
              setUserLatLng(me);
              return;
            }
            const top = eligible[0];
            const binLatLng = [top.latitude, top.longitude];
            const { path, approximate } = await fetchDrivingRoute(me, binLatLng);
            setUserLatLng(me);
            setRoutePath(path);
            setRouteApproximate(approximate);
            setRouteTargetBinId(top.id);
            setFocusBinId(top.id);
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${lat},${lng}`)}&destination=${encodeURIComponent(`${top.latitude},${top.longitude}`)}&travelmode=driving`;
            setRouteSummary({
              mode: "capacity",
              name: top.name,
              distanceM: top.distance_meters,
              fillTier: effectiveFillTier(top),
              fillPct: top.latest_fill_percentage,
              risk: top.latest_risk_level,
              urgency: collectionUrgency(top),
              approximate,
              mapsUrl,
            });
          } catch (e) {
            setToast({
              tone: "error",
              message: e.message || "Nearest lookup failed.",
            });
          }
        },
        () => {
          setToast({
            tone: "error",
            message: "Location permission denied or unavailable.",
          });
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    },
    [clearNavigationUi]
  );

  const runCollectionRoute = useCallback(() => {
    clearNavigationUi();

    const finishPlan = async (start) => {
      setCollectionBusy(true);
      try {
        const plan = await fetchCollectionPlan(start, startMode);
        if (!plan.stops?.length) {
          setToast({
            tone: "warn",
            message: `No Half or Overflow bins to collect (${plan.excluded_empty_count || 0} empty bins excluded).`,
          });
          setUserLatLng(startMode === "gps" ? start : null);
          if (startMode === "depot") setDepotLatLng(start);
          return;
        }
        setCollectionStops(plan.stops);
        setCollectionMeta({
          excluded: plan.excluded_empty_count,
          total: plan.total_stops,
        });
        if (startMode === "gps") setUserLatLng(start);
        else setDepotLatLng(start);

        const { path, approximate, distanceM, durationS } =
          await fetchMultiStopDrivingRoute(start, plan.stops);
        setRoutePath(path);
        setRouteApproximate(approximate);
        const mapsUrl = buildGoogleMapsMultiStopUrl(start, plan.stops);
        setRouteSummary({
          mode: "collection",
          name: `${plan.total_stops} stops`,
          distanceM,
          durationS,
          approximate,
          mapsUrl,
          stopCount: plan.total_stops,
          excludedEmpty: plan.excluded_empty_count,
        });
      } catch (e) {
        setToast({
          tone: "error",
          message: e.message || "Collection route failed.",
        });
      } finally {
        setCollectionBusy(false);
        setDepotPickActive(false);
      }
    };

    if (startMode === "depot") {
      if (!depotLatLng) {
        setToast({
          tone: "warn",
          message: "Click the map to set a depot start point first.",
        });
        setDepotPickActive(true);
        return;
      }
      finishPlan(depotLatLng);
      return;
    }

    if (!navigator.geolocation) {
      setToast({
        tone: "error",
        message: "Geolocation is not supported in this browser.",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finishPlan([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        setToast({
          tone: "error",
          message: "Location permission denied or unavailable.",
        });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [clearNavigationUi, startMode, depotLatLng]);

  const center = useMemo(() => {
    if (userLatLng) return userLatLng;
    if (depotLatLng) return depotLatLng;
    if (binsOnMap.length) {
      let la = 0;
      let lo = 0;
      for (const b of binsOnMap) {
        la += Number(b.latitude);
        lo += Number(b.longitude);
      }
      const n = binsOnMap.length;
      return [la / n, lo / n];
    }
    return defaultCenter;
  }, [userLatLng, depotLatLng, binsOnMap, defaultCenter]);

  const mapZoom = userLatLng ? 13 : binsOnMap.length ? 10 : 7;

  /** When not showing a polyline route, optionally fly to focused bin or GPS pin. */
  const flyTarget = useMemo(() => {
    if (routePath?.length) return null;
    if (focusBinId != null) {
      const t = binsOnMap.find((x) => Number(x.id) === Number(focusBinId));
      if (t)
        return {
          center: [Number(t.latitude), Number(t.longitude)],
          zoom: 15,
        };
    }
    if (userLatLng) return { center: userLatLng, zoom: 13 };
    return null;
  }, [routePath, focusBinId, binsOnMap, userLatLng]);

  return (
    <DashboardLayout>
      <div className="flex min-h-0 flex-1 flex-col gap-5 p-4 lg:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">
              Map &amp; collection routes
            </h1>
            <p className="mt-0.5 max-w-3xl text-sm text-ink-500">
              Plan truck runs: see bins that need pickup soon, find the{" "}
              <strong>nearest urgent</strong> stop from your current location
              (driving preview), or locate the nearest bin with{" "}
              <strong>spare capacity</strong> for disposal crews. Open Google Maps
              for turn-by-turn navigation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/live-monitoring"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
            >
              Live Monitoring
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
            >
              Dashboard
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800">
            <ListOrdered className="h-3.5 w-3.5" />
            <span className="uppercase tracking-wider opacity-70">Urgent</span>
            <span className="font-semibold">{urgentBins.length}</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-ink-700">
            <Database className="h-3.5 w-3.5" />
            <span className="uppercase tracking-wider opacity-70">On map</span>
            <span className="font-semibold">{binsOnMap.length}</span>
          </span>
          {routeSummary ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800">
              <Truck className="h-3.5 w-3.5" />
              Route · {formatDistance(routeSummary.distanceM)}
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{error}</div>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,380px)_1fr] lg:items-stretch">
          {/* Left column */}
          <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
            {toast ? (
              <div
                className={`flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${
                  toast.tone === "error"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
                role="status"
              >
                <span>{toast.message}</span>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 hover:bg-black/5"
                  aria-label="Dismiss"
                  onClick={() => setToast(null)}
                >
                  ×
                </button>
              </div>
            ) : null}

            <Card className="min-h-0 !min-h-0 flex-shrink-0">
              <Card.Header icon={Navigation} title="Route tools" />
              <Card.Body className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={loadMap}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-slate-50 disabled:opacity-50 min-w-[120px]"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => runGeo("urgent")}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 min-w-[140px]"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    Nearest urgent
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => runGeo("capacity")}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-slate-50"
                >
                  <MapPinned className="h-3.5 w-3.5" />
                  Nearest with spare capacity
                </button>
                {(routePath?.length || userLatLng || depotLatLng) && (
                  <button
                    type="button"
                    onClick={clearNavigationUi}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Clear route &amp; location
                  </button>
                )}
                <p className="text-[11px] leading-snug text-ink-500">
                  Uses your browser location once per action. Driving path preview
                  via{" "}
                  <span className="font-medium text-ink-600">OSRM</span>; open
                  Google Maps for live traffic.
                </p>
              </Card.Body>
            </Card>

            <Card className="flex-shrink-0 border-brand-500/20">
              <Card.Header icon={Truck} title="Collection route" />
              <Card.Body className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setStartMode("gps")}
                    className={[
                      "flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold",
                      startMode === "gps"
                        ? "bg-brand-600 text-white"
                        : "text-ink-600 hover:bg-white",
                    ].join(" ")}
                  >
                    My location
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStartMode("depot");
                      setDepotPickActive(true);
                    }}
                    className={[
                      "flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold",
                      startMode === "depot"
                        ? "bg-brand-600 text-white"
                        : "text-ink-600 hover:bg-white",
                    ].join(" ")}
                  >
                    Depot on map
                  </button>
                </div>
                {startMode === "depot" ? (
                  <p className="text-[11px] text-ink-500">
                    {depotLatLng
                      ? `Depot: ${depotLatLng[0].toFixed(5)}, ${depotLatLng[1].toFixed(5)}`
                      : depotPickActive
                        ? "Click the map to place the depot start pin…"
                        : "Switch here, then click the map to set depot."}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={collectionBusy || loading}
                  onClick={runCollectionRoute}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  <ListOrdered className="h-3.5 w-3.5" />
                  {collectionBusy ? "Planning…" : "Generate collection route"}
                </button>
                <p className="text-[11px] leading-snug text-ink-500">
                  Includes all <strong>Half</strong> and <strong>Overflow</strong> bins
                  (smart + virtual). Empty bins are excluded. Order: overflow first,
                  then half by urgency.
                </p>
                {collectionMeta ? (
                  <p className="text-[11px] text-brand-800">
                    {collectionMeta.total} stops · {collectionMeta.excluded} empty
                    excluded
                  </p>
                ) : null}
              </Card.Body>
            </Card>

            {collectionStops.length > 0 ? (
              <Card className="flex-shrink-0">
                <Card.Header
                  icon={ListOrdered}
                  title="Route stops"
                  right={
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                      {collectionStops.length} bins
                    </span>
                  }
                />
                <Card.Body className="max-h-48 overflow-y-auto !mt-2">
                  <ul className="space-y-1.5">
                    {collectionStops.map((stop) => {
                      const tier = effectiveFillTier(stop);
                      const tierKey = normalizeFill(tier) || "unknown";
                      return (
                        <li key={stop.id}>
                          <button
                            type="button"
                            onClick={() => setFocusBinId(stop.id)}
                            className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left hover:bg-slate-50"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                              {stop.order}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-900">
                              {stop.name}
                            </span>
                            <span
                              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${fillBadgeClass(tierKey)}`}
                            >
                              {fillLabel(tier === "unknown" ? "" : tier)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Card.Body>
              </Card>
            ) : null}

            {routeSummary ? (
              <Card className="flex-shrink-0 border-brand-200 bg-brand-50/40">
                <Card.Header
                  icon={Truck}
                  title={
                    routeSummary.mode === "collection"
                      ? "Collection route ready"
                      : routeSummary.mode === "urgent"
                        ? "Suggested urgent pickup"
                        : "Suggested bin (capacity)"
                  }
                  right={
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-200">
                      Driving
                    </span>
                  }
                />
                <Card.Body className="space-y-2">
                  <div className="text-lg font-bold text-ink-900">
                    {routeSummary.name}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-slate-200">
                      {routeSummary.mode === "collection"
                        ? formatRouteDistance(routeSummary.distanceM)
                        : `~${formatDistance(routeSummary.distanceM)}`}
                    </span>
                    {routeSummary.mode === "collection" ? (
                      <>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-slate-200">
                          {formatRouteDuration(routeSummary.durationS)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-slate-200">
                          {routeSummary.stopCount} stops
                        </span>
                        {routeSummary.excludedEmpty ? (
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-500 ring-1 ring-slate-200">
                            {routeSummary.excludedEmpty} empty skipped
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${fillBadgeClass(
                            normalizeFill(routeSummary.fillTier) || "unknown"
                          )}`}
                        >
                          {fillLabel(
                            routeSummary.fillTier === "unknown"
                              ? ""
                              : routeSummary.fillTier
                          )}
                        </span>
                        {routeSummary.risk ? (
                          <span
                            className={`rounded-full bg-white px-2 py-0.5 text-xs font-semibold ring-1 ring-slate-200 ${riskTextClass(routeSummary.risk)}`}
                          >
                            Risk {routeSummary.risk}
                          </span>
                        ) : null}
                      </>
                    )}
                  </div>
                  {routeSummary.mode !== "collection" &&
                  routeSummary.fillPct != null &&
                  Number.isFinite(Number(routeSummary.fillPct)) ? (
                    <p className="text-xs text-ink-600">
                      Fill estimate:{" "}
                      <span className="font-semibold">
                        {Math.round(Number(routeSummary.fillPct))}%
                      </span>
                      {" · "}
                      Urgency score:{" "}
                      <span className="font-semibold">
                        {routeSummary.urgency}
                      </span>
                    </p>
                  ) : null}
                  {routeSummary.approximate ? (
                    <p className="text-xs text-amber-800">
                      Straight-line preview — open Maps for roads and traffic.
                    </p>
                  ) : (
                    <p className="text-xs text-brand-800">
                      Driving route preview on map (OpenStreetMap).
                    </p>
                  )}
                  {routeSummary.mapsUrl ? (
                    <a
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
                      href={routeSummary.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in Google Maps
                    </a>
                  ) : null}
                </Card.Body>
              </Card>
            ) : null}

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <Card.Header
                icon={ListOrdered}
                title="Collect ASAP"
                right={
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    By urgency
                  </span>
                }
              />
              <Card.Body className="min-h-0 flex-1 overflow-y-auto !mt-2">
                {!binsOnMap.length && !loading ? (
                  <p className="text-sm text-ink-500">
                    No bins with coordinates. Add lat/lng in Admin.
                  </p>
                ) : urgentBins.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    No bins currently match urgent-collection rules. When bins
                    reach overflow, high fill %, or elevated risk, they appear
                    here automatically.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {urgentBins.map((b, idx) => {
                      const tier = effectiveFillTier(b);
                      const tierKey = normalizeFill(tier) || "unknown";
                      const score = collectionUrgency(b);
                      const band = urgencyBand(score);
                      const pct =
                        b.latest_fill_percentage != null &&
                        Number.isFinite(Number(b.latest_fill_percentage))
                          ? `${Math.round(Number(b.latest_fill_percentage))}%`
                          : "—";
                      const activeRow =
                        (focusBinId != null &&
                          Number(b.id) === Number(focusBinId)) ||
                        (routeTargetBinId != null &&
                          Number(b.id) === Number(routeTargetBinId));
                      return (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => setFocusBinId(b.id)}
                            className={`flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition hover:bg-slate-50 ${
                              activeRow
                                ? "border-brand-400 bg-brand-50/60 ring-1 ring-brand-200"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                                  {idx + 1}
                                </span>
                                <span className="truncate font-semibold text-ink-900">
                                  {b.name}
                                </span>
                              </span>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${band.className}`}
                              >
                                {band.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pl-8">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${fillBadgeClass(tierKey)}`}
                              >
                                {fillLabel(tier === "unknown" ? "" : tier)}
                              </span>
                              <span className="text-[11px] text-ink-500">
                                Fill {pct}
                              </span>
                              {b.latest_risk_level ? (
                                <span
                                  className={`text-[11px] ${riskTextClass(b.latest_risk_level)}`}
                                >
                                  {b.latest_risk_level}
                                </span>
                              ) : null}
                              <span className="text-[11px] text-ink-400">
                                {relativeCapture(b.latest_captured_at)}
                              </span>
                            </div>
                            <div className="pl-8 flex items-center gap-2">
                              <Link
                                to={`/bins/${b.id}`}
                                className="text-[11px] font-semibold text-brand-700 hover:text-brand-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Bin details →
                              </Link>
                              <span className="text-[11px] text-ink-400">
                                Score {score}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card.Body>
              <Card.Footer>
                Ordering uses fill tier, estimated %, and latest hygienic risk —
                same transparency as the rule-based risk engine.
              </Card.Footer>
            </Card>

            <Card className="max-h-[240px] flex-shrink-0 flex flex-col overflow-hidden">
              <Card.Header icon={Database} title="All bins on map" />
              <Card.Body className="min-h-0 flex-1 overflow-y-auto !mt-2">
                <ul className="divide-y divide-slate-100">
                  {sortedAllByUrgency.map((b) => {
                    const tier = effectiveFillTier(b);
                    const tierKey = normalizeFill(tier) || "unknown";
                    const pct =
                      b.latest_fill_percentage != null &&
                      Number.isFinite(Number(b.latest_fill_percentage))
                        ? `${Math.round(Number(b.latest_fill_percentage))}%`
                        : "—";
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => setFocusBinId(b.id)}
                          className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-slate-50"
                        >
                          <span className="truncate text-sm font-medium text-ink-900">
                            {b.name}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${fillBadgeClass(tierKey)}`}
                            >
                              {fillLabel(tier === "unknown" ? "" : tier)}
                            </span>
                            <span className="text-xs tabular-nums text-ink-500 w-10 text-right">
                              {pct}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card.Body>
            </Card>
          </div>

          {/* Map */}
          <div className="relative min-h-[min(62vh,560px)] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:min-h-[calc(100vh-220px)]">
            <MapContainer
              center={center}
              zoom={mapZoom}
              scrollWheelZoom
              className="z-0"
              style={{ height: "100%", width: "100%", minHeight: "min(62vh,560px)" }}
            >
              <TileLayer attribution={TILE_ATTR} url={TILE_URL} />
              <MapDepotPicker
                active={depotPickActive && startMode === "depot"}
                onPick={(lat, lng) => {
                  setDepotLatLng([lat, lng]);
                  setDepotPickActive(false);
                }}
              />
              {flyTarget ? (
                <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} />
              ) : null}
              {routePath?.length ? (
                <>
                  <Polyline
                    positions={routePath}
                    pathOptions={{
                      color: "#15803d",
                      weight: 5,
                      opacity: routeApproximate ? 0.45 : 0.88,
                      lineCap: "round",
                      lineJoin: "round",
                      dashArray: routeApproximate ? "10 14" : undefined,
                    }}
                  />
                  <FitRouteBounds positions={routePath} />
                </>
              ) : null}

              {depotLatLng ? (
                <CircleMarker
                  center={depotLatLng}
                  radius={11}
                  pathOptions={{
                    color: "#fff",
                    weight: 3,
                    fillColor: "#a855f7",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <div className="text-xs font-semibold text-ink-900">
                      Depot start
                    </div>
                    <div className="text-[11px] text-ink-500">
                      Collection route begins here
                    </div>
                  </Popup>
                </CircleMarker>
              ) : null}

              {userLatLng ? (
                <CircleMarker
                  center={userLatLng}
                  radius={11}
                  pathOptions={{
                    color: "#fff",
                    weight: 3,
                    fillColor: "#0ea5e9",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <div className="text-xs font-semibold text-ink-900">
                      Truck / crew location
                    </div>
                    <div className="text-[11px] text-ink-500">
                      Used for nearest-stop routing
                    </div>
                  </Popup>
                </CircleMarker>
              ) : null}

              {routeTargetBinId ? (
                <Circle
                  center={(() => {
                    const t = binsOnMap.find((x) => x.id === routeTargetBinId);
                    return t ? [t.latitude, t.longitude] : center;
                  })()}
                  radius={140}
                  pathOptions={{
                    color: "#15803d",
                    weight: 2,
                    dashArray: "6 6",
                    fillColor: "#22c55e",
                    fillOpacity: 0.06,
                  }}
                  interactive={false}
                />
              ) : null}

              {binsOnMap.map((b) => {
                const tier = effectiveFillTier(b);
                const tierKey = normalizeFill(tier) || "unknown";
                const urgent = needsCollectionSoon(b);
                const virtual = isVirtualBin(b);
                const isRouteTarget =
                  routeTargetBinId != null &&
                  Number(b.id) === Number(routeTargetBinId);
                const isFocused =
                  focusBinId != null && Number(b.id) === Number(focusBinId);
                const routeStop = collectionStops.find(
                  (s) => Number(s.id) === Number(b.id)
                );
                const fillPctText =
                  b.latest_fill_percentage != null &&
                  Number.isFinite(Number(b.latest_fill_percentage))
                    ? `${Math.round(Number(b.latest_fill_percentage))}%`
                    : "—";

                return (
                  <CircleMarker
                    key={b.id}
                    center={[Number(b.latitude), Number(b.longitude)]}
                    radius={
                      routeStop
                        ? 13
                        : isRouteTarget
                          ? 14
                          : urgent
                            ? 12
                            : isFocused
                              ? 11
                              : 9
                    }
                    pathOptions={{
                      color:
                        isRouteTarget || isFocused ? "#0f172a" : "#ffffff",
                      weight: isRouteTarget || isFocused ? 3 : 2,
                      fillColor: markerFillFromBin(b),
                      fillOpacity: 0.95,
                      dashArray: virtual ? "4 6" : undefined,
                    }}
                    ref={(ref) => {
                      if (ref) markerRefs.current.set(b.id, ref);
                      else markerRefs.current.delete(b.id);
                    }}
                    eventHandlers={{
                      click: (e) => {
                        setFocusBinId(b.id);
                        e.target.openPopup();
                      },
                    }}
                  >
                    <Popup>
                      <div className="min-w-[200px] text-xs leading-tight">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-ink-900">
                            {b.name}
                          </span>
                          {isRouteTarget ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-200">
                              <Crosshair className="h-2.5 w-2.5" />
                              Route target
                            </span>
                          ) : urgent ? (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              Urgent
                            </span>
                          ) : null}
                        </div>
                        {b.location ? (
                          <div className="mt-0.5 text-[11px] text-ink-500">
                            {b.location}
                          </div>
                        ) : null}
                        {virtual ? (
                          <div className="mt-1 text-[10px] font-semibold text-violet-700">
                            Virtual bin · manual fill
                          </div>
                        ) : null}
                        {routeStop ? (
                          <div className="mt-1 text-[10px] font-semibold text-brand-700">
                            Route stop #{routeStop.order}
                          </div>
                        ) : null}
                        {b.latest_image_url ? (
                          <img
                            className="mt-2 max-h-24 w-full rounded-lg object-cover ring-1 ring-slate-200"
                            src={b.latest_image_url}
                            alt=""
                          />
                        ) : null}
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                          <span className="text-ink-500">Fill</span>
                          <span className="font-semibold">
                            <span
                              className={`mr-1 rounded border px-1.5 py-0.5 text-[10px] capitalize ${fillBadgeClass(tierKey)}`}
                            >
                              {fillLabel(tier === "unknown" ? "" : tier)}
                            </span>
                            {fillPctText}
                          </span>
                          <span className="text-ink-500">Risk</span>
                          <span
                            className={`font-semibold ${riskTextClass(b.latest_risk_level)}`}
                          >
                            {b.latest_risk_level || "—"}
                          </span>
                          <span className="text-ink-500">Urgency</span>
                          <span className="font-semibold">
                            {collectionUrgency(b)}
                          </span>
                          <span className="text-ink-500">Updated</span>
                          <span className="font-medium">
                            {relativeCapture(b.latest_captured_at)}
                          </span>
                        </div>
                        <Link
                          className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-700"
                          to={`/bins/${b.id}`}
                        >
                          Bin details
                        </Link>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-card backdrop-blur-sm">
              <div className="pointer-events-auto">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  Legend
                </div>
                <ul className="space-y-1">
                  {LEGEND.map((l) => (
                    <li
                      key={l.label}
                      className="flex items-center gap-2 text-[11px] text-ink-700"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: l.color }}
                      />
                      {l.label}
                    </li>
                  ))}
                  <li className="flex items-center gap-2 border-t border-slate-100 pt-1 text-[11px] text-ink-700">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500 ring-2 ring-white" />
                    Your location
                  </li>
                  <li className="flex items-center gap-2 text-[11px] text-ink-700">
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-brand-600 bg-transparent" />
                    Route target ring
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
