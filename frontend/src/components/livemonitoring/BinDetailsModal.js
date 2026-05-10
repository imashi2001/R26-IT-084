import React, { useEffect, useState } from "react";
import {
  X,
  MapPin,
  Trash2,
  ShieldAlert,
  Thermometer,
  Droplets,
  PawPrint,
  Cpu,
  Calendar,
  Activity,
  ImageOff,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";
import { apiUrl } from "../../utils/apiBase";
import { fillLabel, markerFillFromBin } from "../../utils/fillTier";

/*
 * Modal: every detail an admin needs about a bin.
 *
 *   - Loads /devices/:id/latest          -> latest capture image, predictions,
 *                                           weather, risk, fill_level, etc.
 *   - Loads /devices/:id/captures?limit=8 -> recent capture timeline.
 *
 * Both calls run in parallel on open; we show partial content as soon as
 * either resolves so the modal feels snappy on slow links.
 *
 * Closes on Escape, on backdrop click, and via the X button. Locks body
 * scroll while open (set/restore overflow on document.body).
 */

const RISK_BADGE = {
  LOW: "bg-brand-50 text-brand-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-red-50 text-red-700",
  CRITICAL: "bg-red-100 text-red-800",
};

function formatTs(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function MetaTile({ icon: Icon, label, value, valueClass = "" }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
        <Icon className="h-4 w-4 text-ink-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          {label}
        </div>
        <div className={`text-sm font-semibold text-ink-900 truncate ${valueClass}`}>
          {value ?? "—"}
        </div>
      </div>
    </div>
  );
}

export default function BinDetailsModal({ bin, onClose }) {
  const [latest, setLatest] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bin) return undefined;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setLatest(null);
    setCaptures([]);

    Promise.allSettled([
      axios.get(apiUrl(`/devices/${bin.id}/latest`), { timeout: 8000 }),
      axios.get(apiUrl(`/devices/${bin.id}/captures`), {
        params: { limit: 8 },
        timeout: 8000,
      }),
    ]).then((results) => {
      if (cancelled) return;
      const [latestRes, captsRes] = results;

      if (latestRes.status === "fulfilled") {
        setLatest(latestRes.value.data);
      } else if (latestRes.reason?.response?.status !== 503) {
        setError(latestRes.reason?.message || "Could not load bin details.");
      }

      if (captsRes.status === "fulfilled") {
        setCaptures(
          Array.isArray(captsRes.value.data?.captures)
            ? captsRes.value.data.captures
            : []
        );
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [bin]);

  // Escape to close + body scroll lock.
  useEffect(() => {
    if (!bin) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [bin, onClose]);

  if (!bin) return null;

  const extras = latest?.latest?.extras || {};
  const capturedAt = latest?.latest?.captured_at || bin.latest_captured_at;
  const imageUrl = latest?.latest?.image?.url || bin.latest_image_url;
  const fillTier =
    latest?.latest?.fill_level || bin.latest_fill_level || null;
  const fillPct =
    extras.fill_percentage ?? bin.latest_fill_percentage ?? null;
  const riskLevel = extras.risk_level || bin.latest_risk_level || null;
  const animalCount = extras.animal_count ?? null;
  const wasteLabel = extras.waste_label || bin.latest_waste_label || null;
  const wasteConf = extras.waste_confidence ?? null;
  const tempC = extras.temp_c ?? null;
  const humidity = extras.humidity_pct ?? null;
  const condition = extras.weather_condition || null;
  const sourceType =
    extras.source_type || bin.latest_source_type || null;
  const rottingHours = extras.rotting_hours ?? null;
  const accentColor = markerFillFromBin(bin);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bin-details-title"
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-ink-900/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${accentColor}22` }}
            >
              <Trash2 className="h-5 w-5" style={{ color: accentColor }} />
            </span>
            <div className="min-w-0">
              <h2
                id="bin-details-title"
                className="text-lg font-bold text-ink-900 truncate"
              >
                {bin.name || `BIN${bin.id}`}
              </h2>
              <div className="text-xs text-ink-500 truncate">
                {bin.location || bin.address || `Bin #${bin.id}`}
                {bin.esp32_id ? ` · ${bin.esp32_id}` : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {riskLevel ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  RISK_BADGE[riskLevel] || "bg-slate-100 text-ink-700"
                }`}
              >
                <ShieldAlert className="h-3 w-3" />
                {riskLevel}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-slate-200 hover:text-ink-900 transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Image */}
            <div className="lg:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
                Latest capture
              </div>
              <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {loading && !imageUrl ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-ink-400" />
                  </div>
                ) : imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`Latest capture for ${bin.name}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-400">
                    <ImageOff className="h-8 w-8" />
                    <div className="text-xs">No capture yet</div>
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
                <span>{formatTs(capturedAt)}</span>
                {sourceType ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-ink-700">
                    {sourceType}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Stats */}
            <div className="lg:col-span-3 space-y-5">
              <section>
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
                  Bin status
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetaTile
                    icon={Trash2}
                    label="Bin level"
                    value={
                      fillTier
                        ? `${fillLabel(fillTier)}${
                            fillPct != null ? ` · ${Math.round(fillPct)}%` : ""
                          }`
                        : fillPct != null
                          ? `${Math.round(fillPct)}%`
                          : "—"
                    }
                  />
                  <MetaTile
                    icon={ShieldAlert}
                    label="Hygienic risk"
                    value={riskLevel || "—"}
                    valueClass={
                      riskLevel === "HIGH" || riskLevel === "CRITICAL"
                        ? "text-red-600"
                        : riskLevel === "MEDIUM"
                          ? "text-amber-600"
                          : ""
                    }
                  />
                  <MetaTile
                    icon={PawPrint}
                    label="Animals detected"
                    value={
                      animalCount != null ? `${animalCount}` : "—"
                    }
                  />
                  <MetaTile
                    icon={Activity}
                    label="Waste type"
                    value={
                      wasteLabel
                        ? `${wasteLabel}${
                            wasteConf != null
                              ? ` · ${Math.round(Number(wasteConf) * 100)}%`
                              : ""
                          }`
                        : "—"
                    }
                  />
                </div>
              </section>

              <section>
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
                  Environment
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <MetaTile
                    icon={Thermometer}
                    label="Temp"
                    value={tempC != null ? `${tempC}°C` : "—"}
                  />
                  <MetaTile
                    icon={Droplets}
                    label="Humidity"
                    value={
                      humidity != null
                        ? `${Math.round(humidity)}%`
                        : "—"
                    }
                  />
                  <MetaTile
                    icon={Calendar}
                    label="Rotting est."
                    value={
                      rottingHours != null
                        ? `${rottingHours} h`
                        : "—"
                    }
                  />
                </div>
                {condition ? (
                  <div className="mt-2 text-xs text-ink-500">
                    Conditions: <span className="text-ink-900 font-medium">{condition}</span>
                  </div>
                ) : null}
              </section>

              <section>
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
                  Device
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetaTile
                    icon={Cpu}
                    label="ESP32 id"
                    value={bin.esp32_id || "—"}
                  />
                  <MetaTile
                    icon={MapPin}
                    label="Coordinates"
                    value={
                      bin.latitude != null && bin.longitude != null
                        ? `${Number(bin.latitude).toFixed(5)}, ${Number(
                            bin.longitude
                          ).toFixed(5)}`
                        : "—"
                    }
                  />
                </div>
                {bin.address ? (
                  <div className="mt-2 text-xs text-ink-500">
                    Address: <span className="text-ink-900 font-medium">{bin.address}</span>
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          {/* Recent captures */}
          <section className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Recent captures
              </div>
              {captures.length > 0 ? (
                <span className="text-[11px] text-ink-400">
                  {captures.length} shown
                </span>
              ) : null}
            </div>

            {loading && captures.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-ink-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading capture history…
              </div>
            ) : captures.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-ink-500">
                No captures recorded for this bin yet.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                {captures.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <span className="text-ink-500 shrink-0">
                      {formatTs(c.captured_at)}
                    </span>
                    <span className="flex-1 truncate text-ink-700">
                      {c.waste_label || "—"}
                      {c.fill_level ? ` · ${fillLabel(c.fill_level)}` : ""}
                      {c.animal_count != null
                        ? ` · ${c.animal_count} animal(s)`
                        : ""}
                    </span>
                    {c.risk_level ? (
                      <span
                        className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          RISK_BADGE[c.risk_level] ||
                          "bg-slate-100 text-ink-500"
                        }`}
                      >
                        {c.risk_level}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <Link
            to={`/bins/${bin.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-600"
            onClick={onClose}
          >
            Open full bin page
            <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-ink-900 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
