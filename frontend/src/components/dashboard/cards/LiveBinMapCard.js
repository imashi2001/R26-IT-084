import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import { Map as MapIcon, Database } from "lucide-react";
import Card from "../Card";
import { apiUrl } from "../../../utils/apiBase";
import { markerFillFromBin, fillLabel } from "../../../utils/fillTier";

/*
 * Live Bin Map card.
 *
 * Mirrors the MapPage's data fetch (`GET /devices/map`) but uses a smaller
 * fixed-height map sized for the dashboard grid. Markers are CircleMarkers
 * colored by the same `fillTier.js` palette teammate Charuka established, so
 * legend stays consistent across pages.
 *
 * 503 (DB off) is handled by rendering an empty-state with a CTA hint instead
 * of a red error - lots of demo deployments will run without Postgres.
 */

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const SRI_LANKA_CENTER = [7.8731, 80.7718];

const LEGEND = [
  { tier: "empty", color: "#22c55e", label: "Low Risk" },
  { tier: "half", color: "#f59e0b", label: "Medium Risk" },
  { tier: "overflow", color: "#ef4444", label: "High Risk" },
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

export default function LiveBinMapCard() {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbDisabled, setDbDisabled] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await axios.get(apiUrl("/devices/map"), {
          timeout: 8000,
        });
        if (cancelled) return;
        setBins(Array.isArray(data?.bins) ? data.bins : []);
        setError(null);
        setDbDisabled(false);
      } catch (e) {
        if (cancelled) return;
        if (e?.response?.status === 503) {
          setDbDisabled(true);
          setError(null);
        } else {
          setError(e?.message || "Could not load bins.");
        }
        setBins([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const hasBins = bins.length > 0;

  return (
    <Card className="min-h-[320px]">
      <Card.Header
        icon={MapIcon}
        accent="text-sky-500"
        title="Live Bin Map"
        right={
          <span className="text-[11px] font-medium text-ink-400">
            {hasBins ? `${bins.length} bin${bins.length === 1 ? "" : "s"}` : ""}
          </span>
        }
      />

      <Card.Body className="relative overflow-hidden rounded-lg bg-slate-100">
        {dbDisabled ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-ink-500">
            <Database className="h-6 w-6 text-ink-400" />
            <div className="font-medium text-ink-700">DB not configured</div>
            <div className="text-xs">
              Set <code className="rounded bg-slate-200 px-1">DATABASE_URL</code>{" "}
              on the backend to register bins and see them here.
            </div>
          </div>
        ) : error ? (
          <div className="flex h-64 items-center justify-center text-sm text-red-600">
            {error}
          </div>
        ) : !hasBins && !loading ? (
          <div className="flex h-64 items-center justify-center text-sm text-ink-500">
            No bins registered yet. Add one from the Admin page.
          </div>
        ) : (
          <div className="h-64">
            <MapContainer
              center={SRI_LANKA_CENTER}
              zoom={7}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
              {bins.map((b) => {
                if (
                  b.latitude == null ||
                  b.longitude == null ||
                  !Number.isFinite(Number(b.latitude)) ||
                  !Number.isFinite(Number(b.longitude))
                ) {
                  return null;
                }
                const color = markerFillFromBin(b);
                const fillPctText =
                  b.latest_fill_percentage != null
                    ? `${Math.round(b.latest_fill_percentage)}%`
                    : "—";
                return (
                  <CircleMarker
                    key={b.id}
                    center={[Number(b.latitude), Number(b.longitude)]}
                    radius={9}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 2,
                      fillColor: color,
                      fillOpacity: 0.95,
                    }}
                  >
                    <Popup>
                      <div className="text-xs leading-tight">
                        <div className="text-sm font-bold">
                          {b.name || `BIN${b.id}`}
                        </div>
                        {b.location ? (
                          <div className="text-[11px] text-ink-500">
                            {b.location}
                          </div>
                        ) : null}
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
                          <span className="text-ink-500">Fill</span>
                          <span className="font-semibold">
                            {fillLabel(b.latest_fill_level)} · {fillPctText}
                          </span>
                          <span className="text-ink-500">Risk</span>
                          <span className="font-semibold">
                            {b.latest_risk_level || "—"}
                          </span>
                          <span className="text-ink-500">Updated</span>
                          <span>{formatTs(b.latest_captured_at)}</span>
                        </div>
                        <Link
                          to={`/bins/${b.id}`}
                          className="mt-2 inline-block text-brand-600 underline"
                        >
                          View Details
                        </Link>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        )}
      </Card.Body>

      <Card.Footer>
        <div className="flex flex-wrap items-center gap-3">
          {LEGEND.map((l) => (
            <div key={l.tier} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: l.color }}
              />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      </Card.Footer>
    </Card>
  );
}
