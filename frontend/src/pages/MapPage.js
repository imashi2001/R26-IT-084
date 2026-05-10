import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  Polyline,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { apiUrl } from "../utils/apiBase";

const NEAREST_FILL_LEVELS = new Set(["empty", "half"]);

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

function normalizeFill(level) {
  return (level || "").trim().toLowerCase();
}

/**
 * Pin colors and % bands stay aligned: <40 → empty, <70 → half, else overflow.
 * When the backend only stores risk-derived fill_percentage, latest_fill_level may be empty.
 */
function tierFromFillPercentage(pct) {
  const p = Number(pct);
  if (!Number.isFinite(p)) return null;
  if (p < 40) return "empty";
  if (p < 70) return "half";
  return "overflow";
}

/** Single source of truth for badges, eligibility, and marker tint fallbacks. */
function effectiveFillTier(b) {
  const lvl = normalizeFill(b.latest_fill_level);
  if (lvl === "empty" || lvl === "half" || lvl === "overflow") return lvl;
  const inferred = tierFromFillPercentage(b.latest_fill_percentage);
  if (inferred) return inferred;
  return lvl || "unknown";
}

function fillLabel(level) {
  const k = normalizeFill(level);
  if (!k) return "Unknown";
  return k.charAt(0).toUpperCase() + k.slice(1);
}

async function fetchWalkingRoute(from, to) {
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
    const url = `https://router.project-osrm.org/route/v1/foot/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
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

function fillColor(level) {
  const key = (level || "").toLowerCase();
  if (key === "overflow") return "#f87171";
  if (key === "half") return "#fbbf24";
  if (key === "empty") return "#34d399";
  return "#818cf8";
}

function markerFillFromBin(b) {
  const tier = effectiveFillTier(b);
  if (tier !== "unknown") return fillColor(tier);
  return "#818cf8";
}

function IconRefresh() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
      />
    </svg>
  );
}

function IconNavigate() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2zm1 11.59l3.3 3.3-3.3-.82v-2.47zm-2 2.47v2.47l-3.3.82 3.3-3.3z"
      />
    </svg>
  );
}

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? 15, { duration: 0.85 });
  }, [map, center, zoom]);
  return null;
}

function FitRouteBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    const b = L.latLngBounds(positions);
    map.fitBounds(b, { padding: [88, 88], maxZoom: 16 });
  }, [map, positions]);
  return null;
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

  const defaultCenter = useMemo(() => [7.8731, 80.7718], []);

  const clearNavigationUi = useCallback(() => {
    setToast(null);
    setRouteSummary(null);
    setUserLatLng(null);
    setRoutePath(null);
    setRouteApproximate(false);
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

  const onNearest = () => {
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
          const eligible = results.filter((r) =>
            NEAREST_FILL_LEVELS.has(effectiveFillTier(r))
          );
          if (!eligible.length) {
            setToast({
              tone: "warn",
              message:
                "No bins with available capacity nearby (empty / half, or a low fill estimate under 70%). Try another area or check bins reporting higher fullness.",
            });
            setUserLatLng(me);
            return;
          }
          const top = eligible[0];
          const binLatLng = [top.latitude, top.longitude];
          const { path, approximate } = await fetchWalkingRoute(me, binLatLng);
          setUserLatLng(me);
          setRoutePath(path);
          setRouteApproximate(approximate);
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${lat},${lng}`)}&destination=${encodeURIComponent(`${top.latitude},${top.longitude}`)}&travelmode=walking`;
          setRouteSummary({
            name: top.name,
            distanceM: top.distance_meters,
            fillTier: effectiveFillTier(top),
            fillPct: top.latest_fill_percentage,
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
  };

  return (
    <div className="page map-page map-page-modern">
      <header className="map-page-hero">
        <div className="map-hero-text">
          <p className="map-hero-kicker">Live bins</p>
          <h1>Map &amp; navigation</h1>
          <p className="map-hero-desc">
            Voyager base map with fill-colored pins. Find the closest bin that
            has <strong>capacity</strong> (level empty/half, or fill estimate
            under 70%), preview the walking path, then open turn-by-turn
            directions.
          </p>
        </div>
      </header>

      {error ? <div className="map-error-banner">{error}</div> : null}

      <div className="map-shell-modern">
        {toast ? (
          <div className={`map-toast map-toast--${toast.tone}`} role="status">
            <span>{toast.message}</span>
            <button
              type="button"
              className="map-toast-dismiss"
              onClick={() => setToast(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="map-float-toolbar">
          <button
            type="button"
            className="map-pill-btn map-pill-btn--ghost"
            onClick={loadMap}
            disabled={loading}
          >
            <IconRefresh />
            {loading ? "Loading…" : "Refresh bins"}
          </button>
          <button
            type="button"
            className="map-pill-btn map-pill-btn--accent"
            onClick={onNearest}
          >
            <IconNavigate />
            Nearest with space
          </button>
        </div>

        <div className="map-frame map-frame-modern">
          <MapContainer
            center={defaultCenter}
            zoom={7}
            scrollWheelZoom
            className="map-canvas-modern"
            style={{ height: "min(62vh, 560px)", width: "100%" }}
          >
            <TileLayer attribution={TILE_ATTR} url={TILE_URL} />
            {userLatLng && !routePath?.length ? (
              <FlyTo center={userLatLng} zoom={14} />
            ) : null}
            {routePath?.length ? (
              <>
                <Polyline
                  positions={routePath}
                  pathOptions={{
                    color: "#22d3ee",
                    weight: 6,
                    opacity: routeApproximate ? 0.55 : 0.92,
                    lineCap: "round",
                    lineJoin: "round",
                    dashArray: routeApproximate ? "10 14" : undefined,
                  }}
                />
                <FitRouteBounds positions={routePath} />
              </>
            ) : null}
            {userLatLng ? (
              <CircleMarker
                center={userLatLng}
                radius={13}
                pathOptions={{
                  color: "#fff",
                  weight: 3,
                  fillColor: "#0ea5e9",
                  fillOpacity: 1,
                }}
              >
                <Popup className="map-popup-root">
                  <div className="map-popup-card map-popup-card--compact">
                    <span className="map-popup-title">You</span>
                    <span className="map-popup-muted">Current location</span>
                  </div>
                </Popup>
              </CircleMarker>
            ) : null}
            {bins.map((b) => {
              const tier = effectiveFillTier(b);
              const tierKey = normalizeFill(tier) || "unknown";
              return (
              <CircleMarker
                key={b.id}
                center={[b.latitude, b.longitude]}
                radius={12}
                pathOptions={{
                  color: "rgba(255,255,255,0.95)",
                  weight: 2,
                  fillColor: markerFillFromBin(b),
                  fillOpacity: 0.95,
                }}
              >
                <Popup className="map-popup-root">
                  <div className="map-popup-card">
                    {b.latest_image_url ? (
                      <img
                        className="map-popup-thumb"
                        src={b.latest_image_url}
                        alt=""
                      />
                    ) : null}
                    <strong className="map-popup-title">{b.name}</strong>
                    <span className={`map-fill-badge map-fill-badge--${tierKey}`}>
                      {fillLabel(tier === "unknown" ? "" : tier)}
                    </span>
                    {b.latest_fill_percentage != null &&
                    Number.isFinite(Number(b.latest_fill_percentage)) ? (
                      <span className="map-popup-muted">
                        Fill estimate: {Math.round(Number(b.latest_fill_percentage))}%
                      </span>
                    ) : null}
                    {b.latest_source_type ? (
                      <span className="map-popup-muted">
                        Source: {b.latest_source_type}
                      </span>
                    ) : null}
                    {b.latest_captured_at ? (
                      <span className="map-popup-muted">{b.latest_captured_at}</span>
                    ) : null}
                    <Link className="map-popup-cta" to={`/bins/${b.id}`}>
                      Bin details
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
              );
            })}
          </MapContainer>

          {routeSummary ? (
            <aside className="map-route-sheet" aria-live="polite">
              <div className="map-route-sheet-header">
                <span className="map-route-sheet-label">Suggested bin</span>
                <span className="map-route-sheet-ready">Ready</span>
              </div>
              <h2 className="map-route-sheet-title">{routeSummary.name}</h2>
              <div className="map-route-sheet-meta">
                <span className="map-route-chip">
                  ~{routeSummary.distanceM} m
                </span>
                <span
                  className={`map-fill-badge map-fill-badge--${normalizeFill(routeSummary.fillTier) || "unknown"}`}
                >
                  {fillLabel(
                    routeSummary.fillTier === "unknown"
                      ? ""
                      : routeSummary.fillTier
                  )}
                </span>
              </div>
              {routeSummary.fillPct != null &&
              Number.isFinite(Number(routeSummary.fillPct)) ? (
                <p className="map-route-sheet-fillpct">
                  Fill estimate: {Math.round(Number(routeSummary.fillPct))}%
                </p>
              ) : null}
              {routeSummary.approximate ? (
                <p className="map-route-sheet-hint">
                  Straight-line preview — enable routing or open Maps for paths on streets.
                </p>
              ) : (
                <p className="map-route-sheet-hint map-route-sheet-hint--ok">
                  Walking route preview on map (OpenStreetMap roads).
                </p>
              )}
              <a
                className="map-route-primary-btn"
                href={routeSummary.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Start navigation in Google Maps
              </a>
            </aside>
          ) : null}
        </div>
      </div>

      <section className="map-list map-list-modern">
        <div className="map-list-header">
          <h2>Bins on map</h2>
          <span className="map-list-count">{bins.length}</span>
        </div>
        <ul className="bin-chip-list">
          {bins.map((b) => {
            const tier = effectiveFillTier(b);
            const tierKey = normalizeFill(tier) || "unknown";
            return (
            <li key={b.id}>
              <Link className="bin-chip" to={`/bins/${b.id}`}>
                <div className="bin-chip-row">
                  <span className="bin-chip-name">{b.name}</span>
                  <span
                    className={`map-fill-badge map-fill-badge--sm map-fill-badge--${tierKey}`}
                  >
                    {fillLabel(tier === "unknown" ? "" : tier)}
                  </span>
                </div>
                <span className="bin-chip-meta">
                  {b.latest_fill_percentage != null &&
                  Number.isFinite(Number(b.latest_fill_percentage))
                    ? `${Math.round(Number(b.latest_fill_percentage))}%`
                    : "—"}
                  {" · "}
                  {b.latest_source_type || "—"}
                </span>
              </Link>
            </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
