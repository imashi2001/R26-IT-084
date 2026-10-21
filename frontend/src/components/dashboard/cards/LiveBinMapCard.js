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
import { Map as MapIcon, Database, ExternalLink } from "lucide-react";
import Card from "../Card";
import { MAP_TILE_DARK, MAP_ATTRIBUTION } from "../dashboardTheme";
import { apiUrl } from "../../../utils/apiBase";
import { markerFillFromBin, fillLabel } from "../../../utils/fillTier";
import { isVirtualBin } from "../../../utils/collectionRoute";
import {
  ADD_BIN_STREAK,
  formatLsi,
  litterSeverityMeta,
} from "../../../utils/litterSeverity";

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
    <Card className="h-full">
      <Card.Header
        icon={MapIcon}
        accent="text-sky-400"
        title="Live Bin Map"
        subtitle="Colombo region · color-coded by fill risk"
        right={
          <Link
            to="/map"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300"
          >
            View Full Map
            <ExternalLink className="h-3 w-3" />
          </Link>
        }
      />

      <Card.Body className="flex min-h-0 flex-1 flex-col p-0">
        <div className="relative min-h-[14rem] flex-1 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/60">
        {dbDisabled ? (
          <div className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
            <Database className="h-6 w-6 text-slate-600" />
            <div className="font-medium text-slate-300">DB not configured</div>
            <div className="text-xs">
              Set{" "}
              <code className="rounded bg-slate-800 px-1 text-brand-400">
                DATABASE_URL
              </code>{" "}
              on the backend to register bins and see them here.
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[14rem] items-center justify-center text-sm text-red-400">
            {error}
          </div>
        ) : !hasBins && !loading ? (
          <div className="flex h-full min-h-[14rem] items-center justify-center text-sm text-slate-500">
            No bins registered yet. Add one from the Admin page.
          </div>
        ) : (
          <div className="absolute inset-0 [&_.leaflet-container]:h-full [&_.leaflet-container]:rounded-xl [&_.leaflet-container]:bg-slate-950">
            <MapContainer
              center={SRI_LANKA_CENTER}
              zoom={7}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url={MAP_TILE_DARK} attribution={MAP_ATTRIBUTION} />
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
                const virtual = isVirtualBin(b);
                const litter = litterSeverityMeta(b);
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
                      dashArray: virtual ? "4 6" : undefined,
                    }}
                  >
                    <Popup>
                      <div className="text-xs leading-tight">
                        <div className="text-sm font-bold">
                          {b.name || `BIN${b.id}`}
                        </div>
                        {virtual ? (
                          <div className="text-[10px] font-semibold text-violet-600">
                            Virtual · manual fill
                          </div>
                        ) : null}
                        {b.location ? (
                          <div className="text-[11px] text-slate-500">
                            {b.location}
                          </div>
                        ) : null}
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
                          <span className="text-slate-500">Fill</span>
                          <span className="font-semibold">
                            {fillLabel(b.latest_fill_level)} · {fillPctText}
                          </span>
                          <span className="text-slate-500">Risk</span>
                          <span className="font-semibold">
                            {b.latest_risk_level || "—"}
                          </span>
                          <span className="text-slate-500">Litter</span>
                          <span className="font-semibold">
                            {litter.label}
                            {b.latest_litter_lsi != null
                              ? ` · LSI ${formatLsi(b.latest_litter_lsi)}`
                              : ""}
                          </span>
                          <span className="text-slate-500">Updated</span>
                          <span>{formatTs(b.latest_captured_at)}</span>
                        </div>
                        {(b.litter_add_bin_recommended ||
                          (b.litter_high_streak || 0) >= ADD_BIN_STREAK) && (
                          <Link
                            to="/bins"
                            className="mt-2 inline-block text-xs font-semibold text-red-600 underline"
                          >
                            Add a new bin here
                          </Link>
                        )}
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
        {hasBins ? (
          <div className="absolute right-2 top-2 rounded-lg border border-slate-700/60 bg-slate-900/90 px-2 py-1 text-[10px] font-medium text-slate-400 backdrop-blur-sm">
            {bins.length} bin{bins.length === 1 ? "" : "s"}
          </div>
        ) : null}
        </div>
      </Card.Body>

      <Card.Footer>
        <div className="flex flex-wrap items-center gap-3">
          {LEGEND.map((l) => (
            <div key={l.tier} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full shadow-sm"
                style={{
                  backgroundColor: l.color,
                  boxShadow: `0 0 6px ${l.color}88`,
                }}
              />
              <span>{l.label}</span>
            </div>
          ))}
        </div>
      </Card.Footer>
    </Card>
  );
}
