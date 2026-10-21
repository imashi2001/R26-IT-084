import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Crosshair,
  Loader2,
  MapPin,
  MousePointerClick,
  Navigation,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { apiUrl } from "../../utils/apiBase";
import { MAP_TILE_DARK, MAP_ATTRIBUTION } from "../dashboard/dashboardTheme";
import { btnGhost, btnSecondary, inputClass, labelClass } from "./binStatusUi";

const DEFAULT_CENTER = [7.8731, 80.7718];

const MODES = [
  { id: "map", label: "Click map", icon: MousePointerClick },
  { id: "search", label: "Search address", icon: Search },
  { id: "manual", label: "Enter coordinates", icon: SlidersHorizontal },
];

function MapClickHandler({ onPick, disabled }) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) {
      return;
    }
    map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center, zoom, map]);
  return null;
}

function parseCoord(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? n : null;
}

function validateCoords(lat, lng) {
  if (lat == null || lng == null) return { ok: false, msg: "Enter both latitude and longitude." };
  if (lat < -90 || lat > 90) return { ok: false, msg: "Latitude must be between -90 and 90." };
  if (lng < -180 || lng > 180) return { ok: false, msg: "Longitude must be between -180 and 180." };
  return { ok: true, msg: null };
}

export default function BinLocationPicker({
  latitude,
  longitude,
  geoQuery,
  onGeoQueryChange,
  onCoordsChange,
  onAddressPick,
  disabled = false,
}) {
  const [mode, setMode] = useState("map");
  const [geoResults, setGeoResults] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [manualLat, setManualLat] = useState(latitude || "");
  const [manualLng, setManualLng] = useState(longitude || "");
  const [coordMsg, setCoordMsg] = useState(null);

  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);
  const hasCoords = lat != null && lng != null;

  useEffect(() => {
    setManualLat(latitude || "");
    setManualLng(longitude || "");
  }, [latitude, longitude]);

  const mapCenter = useMemo(() => {
    if (hasCoords) return [lat, lng];
    return DEFAULT_CENTER;
  }, [hasCoords, lat, lng]);

  const mapZoom = hasCoords ? 15 : 7;

  const onPick = useCallback(
    (pickLat, pickLng) => {
      onCoordsChange(pickLat.toFixed(6), pickLng.toFixed(6));
      setCoordMsg(`Pinned ${pickLat.toFixed(5)}, ${pickLng.toFixed(5)}`);
      setGeoError(null);
    },
    [onCoordsChange]
  );

  const runSearch = async () => {
    const q = (geoQuery || "").trim();
    if (q.length < 2) {
      setGeoError("Type at least 2 characters to search.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    setGeoResults([]);
    try {
      const res = await fetch(apiUrl(`/geo/search?q=${encodeURIComponent(q)}`));
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      const list = Array.isArray(body.results) ? body.results : [];
      setGeoResults(list);
      if (!list.length) setGeoError("No places found — try a different search.");
    } catch (e) {
      setGeoError(e.message || "Search failed.");
    } finally {
      setGeoLoading(false);
    }
  };

  const pickSearchResult = (row) => {
    if (row.latitude == null || row.longitude == null) return;
    onCoordsChange(String(row.latitude), String(row.longitude));
    if (onAddressPick && row.label) onAddressPick(row.label);
    setCoordMsg(`Selected: ${row.label}`);
    setMode("map");
  };

  const applyManual = () => {
    const vLat = parseCoord(manualLat);
    const vLng = parseCoord(manualLng);
    const check = validateCoords(vLat, vLng);
    if (!check.ok) {
      setCoordMsg(check.msg);
      return;
    }
    onCoordsChange(vLat.toFixed(6), vLng.toFixed(6));
    setCoordMsg("Coordinates applied.");
    setMode("map");
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setCoordMsg("Geolocation is not supported in this browser.");
      return;
    }
    setCoordMsg("Getting your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPick(pos.coords.latitude, pos.coords.longitude);
      },
      () => setCoordMsg("Could not read GPS location. Allow location access or pick on the map."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800/60 bg-slate-950/40 p-1">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => setMode(id)}
            className={[
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition sm:flex-none sm:px-3",
              mode === id
                ? "bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/25"
                : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {mode === "search" ? (
        <div className="space-y-2 rounded-xl border border-slate-800/60 bg-slate-950/30 p-3">
          <label className="block">
            <span className={labelClass}>Search place or address</span>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={geoQuery || ""}
                onChange={(e) => onGeoQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), runSearch())}
                placeholder="e.g. Colombo Fort, Galle Face Green…"
                disabled={disabled || geoLoading}
                className={inputClass.replace("mt-1 ", "")}
              />
              <button
                type="button"
                onClick={runSearch}
                disabled={disabled || geoLoading}
                className={btnSecondary}
              >
                {geoLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </div>
          </label>
          {geoError ? (
            <p className="text-xs text-red-400">{geoError}</p>
          ) : null}
          {geoResults.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {geoResults.map((row, i) => (
                <li key={`${row.label}-${i}`}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => pickSearchResult(row)}
                    className="w-full rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2 text-left text-xs text-slate-300 hover:border-brand-500/30 hover:bg-brand-500/10 hover:text-brand-300"
                  >
                    <span className="line-clamp-2">{row.label}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {row.latitude?.toFixed?.(5) ?? row.latitude},{" "}
                      {row.longitude?.toFixed?.(5) ?? row.longitude}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {mode === "manual" ? (
        <div className="space-y-2 rounded-xl border border-slate-800/60 bg-slate-950/30 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Latitude</span>
              <input
                type="text"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="7.873100"
                disabled={disabled}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Longitude</span>
              <input
                type="text"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="80.771800"
                disabled={disabled}
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={applyManual}
            disabled={disabled}
            className={btnSecondary}
          >
            Apply coordinates
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-800/60">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60 bg-slate-950/50 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Crosshair className="h-3.5 w-3.5 text-brand-400" />
            {mode === "map"
              ? "Click the map to drop a pin"
              : "Map preview — switch to Click map to adjust pin"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={disabled}
              className={btnGhost}
            >
              <Navigation className="h-3.5 w-3.5" />
              My location
            </button>
          </div>
        </div>
        <div className="h-[280px] [&_.leaflet-container]:h-full [&_.leaflet-container]:bg-slate-950">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url={MAP_TILE_DARK} attribution={MAP_ATTRIBUTION} />
            <MapRecenter center={mapCenter} zoom={mapZoom} />
            <MapClickHandler onPick={onPick} disabled={disabled || mode !== "map"} />
            {hasCoords ? (
              <CircleMarker
                center={[lat, lng]}
                radius={11}
                pathOptions={{
                  color: "#ffffff",
                  weight: 2,
                  fillColor: "#22c55e",
                  fillOpacity: 0.95,
                }}
              />
            ) : null}
          </MapContainer>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/50 bg-slate-950/30 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-slate-400">
          <MapPin className="h-3.5 w-3.5 text-brand-400" />
          {hasCoords ? (
            <>
              <span className="font-mono text-slate-200">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </span>
            </>
          ) : (
            "No coordinates set — use map, search, or manual entry"
          )}
        </span>
        {hasCoords ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onCoordsChange("", "");
              setCoordMsg("Coordinates cleared.");
            }}
            className="text-slate-500 hover:text-red-400"
          >
            Clear pin
          </button>
        ) : null}
      </div>

      {coordMsg ? <p className="text-xs text-brand-400">{coordMsg}</p> : null}
    </div>
  );
}
