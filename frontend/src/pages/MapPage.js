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

function normalizeFill(level) {
  return (level || "").trim().toLowerCase();
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
  if (key === "overflow") return "#e53935";
  if (key === "half") return "#ffa726";
  if (key === "empty") return "#43a047";
  return "#5c6bc0";
}

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? 15, { duration: 0.9 });
  }, [map, center, zoom]);
  return null;
}

function FitRouteBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    const b = L.latLngBounds(positions);
    map.fitBounds(b, { padding: [56, 56], maxZoom: 16 });
  }, [map, positions]);
  return null;
}

export default function MapPage() {
  const [bins, setBins] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nearestMsg, setNearestMsg] = useState(null);
  const [userLatLng, setUserLatLng] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [routeApproximate, setRouteApproximate] = useState(false);
  const [directionsUrl, setDirectionsUrl] = useState(null);

  const defaultCenter = useMemo(() => [7.8731, 80.7718], []);

  const loadMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNearestMsg(null);
    setUserLatLng(null);
    setRoutePath(null);
    setRouteApproximate(false);
    setDirectionsUrl(null);
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
  }, []);

  useEffect(() => {
    loadMap();
  }, [loadMap]);

  const onNearest = () => {
    setNearestMsg(null);
    setUserLatLng(null);
    setRoutePath(null);
    setRouteApproximate(false);
    setDirectionsUrl(null);
    if (!navigator.geolocation) {
      setNearestMsg("Geolocation is not supported in this browser.");
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
            setNearestMsg("No bins with coordinates found.");
            return;
          }
          const eligible = results.filter((r) =>
            NEAREST_FILL_LEVELS.has(normalizeFill(r.latest_fill_level))
          );
          if (!eligible.length) {
            setNearestMsg(
              "No bins with latest level empty or half (needs a recent capture). Try again after the bridge sends images."
            );
            setUserLatLng(me);
            return;
          }
          const top = eligible[0];
          const binLatLng = [top.latitude, top.longitude];
          const { path, approximate } = await fetchWalkingRoute(me, binLatLng);
          setUserLatLng(me);
          setRoutePath(path);
          setRouteApproximate(approximate);
          const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${lat},${lng}`)}&destination=${encodeURIComponent(`${top.latitude},${top.longitude}`)}&travelmode=walking`;
          setDirectionsUrl(gmaps);
          setNearestMsg(
            `Nearest empty/half: ${top.name} (~${top.distance_meters} m) — fill: ${top.latest_fill_level}`
          );
        } catch (e) {
          setNearestMsg(e.message || "Nearest lookup failed.");
        }
      },
      () => {
        setNearestMsg("Location permission denied or unavailable.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="page map-page">
      <header className="page-header">
        <h1>Bin map</h1>
        <p className="subtitle">
          OpenStreetMap tiles — markers show latest fill level when available.
        </p>
        <p className="subtitle map-page-hint">
          “Find nearest” picks the closest bin whose latest level is{" "}
          <strong>empty</strong> or <strong>half</strong>, draws a walking route on the map,
          and can open Google Maps for turn-by-turn directions.
        </p>
        <div className="map-toolbar">
          <button type="button" className="btn btn-primary" onClick={loadMap} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onNearest}>
            Find nearest (empty / half)
          </button>
        </div>
        {nearestMsg && (
          <div className="info-banner">
            <div>{nearestMsg}</div>
            {routeApproximate && routePath?.length ? (
              <div className="map-route-note">
                Showing a straight line — walking paths unavailable (offline routing).
              </div>
            ) : null}
            {directionsUrl ? (
              <div className="map-nav-actions">
                <a
                  className="map-nav-link"
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open walking directions in Google Maps
                </a>
              </div>
            ) : null}
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}
      </header>

      <div className="map-frame">
        <MapContainer
          center={defaultCenter}
          zoom={7}
          scrollWheelZoom
          style={{ height: "480px", width: "100%", borderRadius: "12px" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {userLatLng && !routePath?.length ? (
            <FlyTo center={userLatLng} zoom={14} />
          ) : null}
          {routePath?.length ? (
            <>
              <Polyline
                positions={routePath}
                pathOptions={{
                  color: "#38bdf8",
                  weight: 5,
                  opacity: routeApproximate ? 0.65 : 0.92,
                  dashArray: routeApproximate ? "8 10" : undefined,
                }}
              />
              <FitRouteBounds positions={routePath} />
            </>
          ) : null}
          {userLatLng ? (
            <CircleMarker
              center={userLatLng}
              radius={12}
              pathOptions={{
                color: "#e0f2fe",
                weight: 3,
                fillColor: "#0284c7",
                fillOpacity: 1,
              }}
            >
              <Popup>Your location</Popup>
            </CircleMarker>
          ) : null}
          {bins.map((b) => (
            <CircleMarker
              key={b.id}
              center={[b.latitude, b.longitude]}
              radius={11}
              pathOptions={{
                color: "#fff",
                weight: 2,
                fillColor: fillColor(b.latest_fill_level),
                fillOpacity: 0.9,
              }}
            >
              <Popup>
                <strong>{b.name}</strong>
                <div>Level: {b.latest_fill_level || "—"}</div>
                {b.latest_captured_at && (
                  <div className="popup-muted">{b.latest_captured_at}</div>
                )}
                <div style={{ marginTop: 8 }}>
                  <Link className="popup-link" to={`/bins/${b.id}`}>
                    Open bin detail
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <section className="map-list">
        <h2>Bins on map ({bins.length})</h2>
        <ul className="bin-list">
          {bins.map((b) => (
            <li key={b.id}>
              <Link to={`/bins/${b.id}`}>{b.name}</Link>
              <span className="bin-meta">
                {" "}
                — {b.latest_fill_level || "unknown"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
