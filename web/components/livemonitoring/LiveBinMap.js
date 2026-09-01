"use client";
import React, { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Activity, Crosshair } from "lucide-react";
import { markerFillFromBin, fillLabel } from "../../utils/fillTier";

/*
 * Live Monitoring map.
 *
 * Visual rules:
 *   - One CircleMarker per bin, fill color from `markerFillFromBin` (matches
 *     the dashboard's LiveBinMapCard so legends stay consistent).
 *   - Inactive bins (no captures yet) are rendered with reduced opacity so
 *     they don't compete with active bins.
 *   - The nearest bin gets a translucent halo Circle (250 m radius) and a
 *     CSS-pulse class so admins can spot it instantly.
 *   - Markers open a Popup on mouseover (Leaflet handles auto-close on
 *     mouseout-with-grace). The popup carries fill + risk + last-seen and a
 *     "More details" button that bubbles up to the page.
 *   - When `focusBinId` changes (e.g. user clicked a list row) we fly the
 *     map to that bin and open its popup.
 */

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const LEGEND = [
  { color: "#22c55e", label: "Empty (low risk)" },
  { color: "#f59e0b", label: "Half (medium risk)" },
  { color: "#ef4444", label: "Overflow (high risk)" },
  { color: "#818cf8", label: "Unknown" },
];

function formatTs(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function FocusController({ bins, focusBinId, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (!focusBinId) return;
    const target = bins.find((b) => b.id === focusBinId);
    if (!target) return;
    map.flyTo([target.latitude, target.longitude], 16, { duration: 0.6 });
    const ref = markerRefs.current.get(focusBinId);
    if (ref) {
      // Defer the popup open so the flyTo animation has a head start.
      setTimeout(() => ref.openPopup(), 250);
    }
  }, [map, bins, focusBinId, markerRefs]);
  return null;
}

export default function LiveBinMap({
  bins,
  center,
  nearestBinId,
  userLocation,
  focusBinId,
  onSelectBin,
  height = "100%",
}) {
  const markerRefs = useRef(new Map());

  const nearestBin = useMemo(
    () => bins.find((b) => b.id === nearestBinId) || null,
    [bins, nearestBinId]
  );

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={userLocation ? 14 : 7}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />

        <FocusController
          bins={bins}
          focusBinId={focusBinId}
          markerRefs={markerRefs}
        />

        {/* User location pin (if granted) */}
        {userLocation ? (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={6}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: "#0ea5e9",
              fillOpacity: 1,
            }}
          >
            <Popup>You are here.</Popup>
          </CircleMarker>
        ) : null}

        {/* Nearest-bin halo (rendered first so it sits behind the marker) */}
        {nearestBin ? (
          <Circle
            center={[nearestBin.latitude, nearestBin.longitude]}
            radius={120}
            pathOptions={{
              color: "#22c55e",
              weight: 2,
              dashArray: "6 6",
              fillColor: "#22c55e",
              fillOpacity: 0.08,
            }}
            interactive={false}
          />
        ) : null}

        {/* Bin markers */}
        {bins.map((b) => {
          const color = markerFillFromBin(b);
          const isActive = b.status_inferred !== "inactive";
          const isNearest = b.id === nearestBinId;
          const fillPctText =
            b.latest_fill_percentage != null
              ? `${Math.round(b.latest_fill_percentage)}%`
              : "—";

          return (
            <CircleMarker
              key={b.id}
              center={[b.latitude, b.longitude]}
              radius={isNearest ? 11 : 9}
              pathOptions={{
                color: isNearest ? "#0f172a" : "#ffffff",
                weight: isNearest ? 3 : 2,
                fillColor: color,
                fillOpacity: isActive ? 0.95 : 0.45,
              }}
              ref={(ref) => {
                if (ref) markerRefs.current.set(b.id, ref);
                else markerRefs.current.delete(b.id);
              }}
              eventHandlers={{
                mouseover: (e) => e.target.openPopup(),
                click: (e) => e.target.openPopup(),
              }}
            >
              <Popup
                closeButton={false}
                autoPan={false}
                offset={[0, -6]}
              >
                <div className="text-xs leading-tight min-w-[200px]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold text-ink-900">
                      {b.name || `BIN${b.id}`}
                    </div>
                    {isNearest ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                        <Crosshair className="h-2.5 w-2.5" />
                        Nearest
                      </span>
                    ) : null}
                  </div>

                  {b.location ? (
                    <div className="mt-0.5 text-[11px] text-ink-500">
                      {b.location}
                    </div>
                  ) : null}

                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                    <span className="text-ink-500">Status</span>
                    <span className="font-semibold flex items-center gap-1">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          b.status_inferred === "active"
                            ? "bg-brand-500"
                            : b.status_inferred === "stale"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        }`}
                      />
                      {b.status_inferred === "active"
                        ? "Active"
                        : b.status_inferred === "stale"
                          ? "Stale"
                          : "Inactive"}
                    </span>

                    <span className="text-ink-500">Bin level</span>
                    <span className="font-semibold">
                      {fillLabel(b.latest_fill_level)} · {fillPctText}
                    </span>

                    <span className="text-ink-500">Hygienic risk</span>
                    <span
                      className={`font-semibold ${
                        b.latest_risk_level === "HIGH" ||
                        b.latest_risk_level === "CRITICAL"
                          ? "text-red-600"
                          : b.latest_risk_level === "MEDIUM"
                            ? "text-amber-600"
                            : "text-brand-700"
                      }`}
                    >
                      {b.latest_risk_level || "—"}
                    </span>

                    <span className="text-ink-500">Last capture</span>
                    <span className="font-medium">
                      {formatTs(b.latest_captured_at)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectBin) onSelectBin(b);
                    }}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-600 transition"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    More details
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 z-[400] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-card backdrop-blur-sm">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-1">
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
          {nearestBinId ? (
            <li className="flex items-center gap-2 text-[11px] text-ink-700 pt-1 border-t border-slate-100">
              <span className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-brand-500 bg-transparent" />
              Nearest bin
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
