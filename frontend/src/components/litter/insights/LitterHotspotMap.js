import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_TILE_DARK, MAP_ATTRIBUTION } from "../../dashboard/dashboardTheme";
import {
  binStatusMeta,
  hotspotRadius,
  lsiColor,
  trendMeta,
  formatDateTime,
} from "../../../utils/litterInsights";
import { formatLsi } from "../../../utils/litterSeverity";

const DEFAULT_CENTER = [6.9271, 79.8612];

const LEGEND = [
  { color: "#22c55e", label: "Avg LSI ≤ 30" },
  { color: "#f59e0b", label: "31–53" },
  { color: "#ef4444", label: "> 53" },
];

function hasCoords(b) {
  return Number.isFinite(Number(b.latitude)) && Number.isFinite(Number(b.longitude));
}

/** Bins sized by litter pressure and coloured by average LSI over the range. */
export default function LitterHotspotMap({ bins, height = 360 }) {
  const placed = useMemo(() => (bins || []).filter(hasCoords), [bins]);
  const center = placed.length
    ? [
        placed.reduce((s, b) => s + Number(b.latitude), 0) / placed.length,
        placed.reduce((s, b) => s + Number(b.longitude), 0) / placed.length,
      ]
    : DEFAULT_CENTER;

  return (
    <div className="space-y-2">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-700/50"
        style={{ height }}
      >
        <MapContainer
          center={center}
          zoom={placed.length ? 13 : 8}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url={MAP_TILE_DARK} attribution={MAP_ATTRIBUTION} />
          {placed.map((b) => {
            const color = lsiColor(b.avg_lsi);
            const status = binStatusMeta(b.status);
            const trend = trendMeta(b.trend);
            return (
              <CircleMarker
                key={b.device_id}
                center={[Number(b.latitude), Number(b.longitude)]}
                radius={hotspotRadius(b)}
                pathOptions={{
                  color,
                  weight: b.status === "persistent" ? 3 : 1.5,
                  fillColor: color,
                  fillOpacity: 0.35,
                }}
              >
                <Popup>
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold">
                      {b.bin_code} · {b.name}
                    </div>
                    {b.location ? <div>{b.location}</div> : null}
                    <div>
                      Avg LSI <strong>{formatLsi(b.avg_lsi)}</strong> · max{" "}
                      {formatLsi(b.max_lsi)}
                    </div>
                    <div>
                      HIGH readings: {b.high} · confirmed littering:{" "}
                      {b.littering_confirmed}
                    </div>
                    <div>
                      Status: {status.label} · trend {trend.arrow} {trend.label}
                    </div>
                    <div>Last reading: {formatDateTime(b.latest_at)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
        {!placed.length ? (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-slate-950/60 text-xs text-slate-400">
            No bins with coordinates and litter data in this range.
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
          </span>
        ))}
        <span>Bigger circle = more litter and littering events · thick ring = needs action</span>
      </div>
    </div>
  );
}
