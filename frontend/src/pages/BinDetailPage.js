import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  Volume2,
} from "lucide-react";
import ImageCanvas from "../components/ImageCanvas";
import PredictionList from "../components/PredictionList";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import Card from "../components/dashboard/Card";
import EmptyState from "../components/dashboard/EmptyState";
import PageSkeleton from "../components/dashboard/PageSkeleton";
import AudioTrackTestPanel from "../components/dashboard/AudioTrackTestPanel";
import useAudioSettings from "../hooks/useAudioSettings";
import { useAuth } from "../context/AuthContext";
import StatusBanner from "../components/dashboard/StatusBanner";
import {
  btnGhost,
  btnSecondary,
  statusBadgeClass,
} from "../components/dashboard/dashboardUi";
import { apiUrl } from "../utils/apiBase";

function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

function formatConfidenceSummary(c) {
  if (c.prediction_class) return c.prediction_class;
  if (c.waste_label != null && Number.isFinite(Number(c.waste_confidence))) {
    const pct = Math.round(Number(c.waste_confidence) * 100);
    return `${c.waste_label} (${pct}%)`;
  }
  const preds = Array.isArray(c.predictions) ? c.predictions : [];
  let best = null;
  for (const p of preds) {
    if (!best || Number(p.confidence) > Number(best.confidence)) best = p;
  }
  if (best) {
    const pct = Math.round(Number(best.confidence) * 100);
    return `${best.label} (${pct}%)`;
  }
  if (c.animal_count != null && c.animal_count > 0) {
    return `${c.animal_count} animal(s)`;
  }
  if (c.risk_level) return `risk: ${c.risk_level}`;
  return "—";
}

function formatGps(c) {
  const lat = c.latitude;
  const lon = c.longitude;
  if (
    lat != null &&
    lon != null &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lon))
  ) {
    return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
  }
  return "—";
}

function MetaItem({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 px-3 py-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-200">{value}</dd>
    </div>
  );
}

export default function BinDetailPage() {
  const { id } = useParams();
  const { user, authFetch } = useAuth();
  const { testTracks } = useAudioSettings();
  const [data, setData] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHistoryError(null);
    try {
      const [latestRes, capRes] = await Promise.all([
        fetch(apiUrl(`/devices/${id}/latest`)),
        fetch(apiUrl(`/devices/${id}/captures?limit=50`)),
      ]);
      const latestBody = await latestRes.json().catch(() => ({}));
      const capBody = await capRes.json().catch(() => ({}));

      if (!latestRes.ok) {
        throw new Error(latestBody.error || `HTTP ${latestRes.status}`);
      }
      setData(latestBody);

      if (!capRes.ok) {
        setHistoryError(capBody.error || `HTTP ${capRes.status}`);
        setCaptures([]);
      } else {
        setCaptures(Array.isArray(capBody.captures) ? capBody.captures : []);
      }
    } catch (e) {
      setError(e.message || "Failed to load bin.");
      setCaptures([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = data?.latest;
  const extras = latest?.extras || {};
  const imageUrl = latest?.image?.url || null;
  const predictions = Array.isArray(latest?.predictions)
    ? latest.predictions
    : [];
  const isAdmin = user?.role === "admin";

  return (
    <DashboardLayout>
      {loading && !data ? (
        <PageSkeleton rows={5} />
      ) : (
        <PageShell
          banner={
            error
              ? { tone: "error", text: error, onRetry: load }
              : historyError
                ? { tone: "warn", text: historyError }
                : null
          }
        >
          <PageHeader
            title={data?.device?.name || "Bin detail"}
            subtitle={
              data?.device?.address ||
              data?.device?.location ||
              "Latest capture and history for this bin"
            }
            actions={
              <>
                <Link to="/bins" className={btnSecondary}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Bin registry
                </Link>
                <Link to="/map" className={btnGhost}>
                  <MapPin className="h-3.5 w-3.5" />
                  Map
                </Link>
                <button type="button" onClick={load} className={btnGhost}>
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </>
            }
          />

          {data?.device ? (
            <>
              <Card>
                <Card.Header
                  title="Device overview"
                  subtitle={`Status: ${data.device.status || "—"}`}
                  right={
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(data.device.status)}`}
                    >
                      {data.device.status || "unknown"}
                    </span>
                  }
                />
                <Card.Body>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    <MetaItem label="Fill level" value={latest?.fill_level || "—"} />
                    <MetaItem
                      label="Fill estimate"
                      value={
                        extras.fill_percentage != null &&
                        Number.isFinite(Number(extras.fill_percentage))
                          ? `${Math.round(Number(extras.fill_percentage))}%`
                          : "—"
                      }
                    />
                    <MetaItem
                      label="Last capture"
                      value={formatTs(latest?.captured_at)}
                    />
                    <MetaItem label="Source" value={extras.source_type || "—"} />
                    <MetaItem
                      label="Report GPS"
                      value={
                        extras.capture_latitude != null &&
                        extras.capture_longitude != null
                          ? `${Number(extras.capture_latitude).toFixed(5)}, ${Number(extras.capture_longitude).toFixed(5)}`
                          : "—"
                      }
                    />
                    <MetaItem
                      label="ESP32 ID"
                      value={data.device.esp32_id || "—"}
                    />
                    <MetaItem
                      label="Bridge / Laptop ID"
                      value={
                        data.device.bridge_instance_id ? (
                          <code className="text-xs text-brand-400">
                            {data.device.bridge_instance_id}
                          </code>
                        ) : (
                          "Any matching bridge"
                        )
                      }
                    />
                  </dl>
                </Card.Body>
              </Card>

              <Card>
                <Card.Header
                  icon={Volume2}
                  title="Speaker / audio test"
                  subtitle="Play each assigned MP3 track on this bin's DFPlayer"
                  accent="text-brand-400"
                />
                <Card.Body>
                  <AudioTrackTestPanel
                    device={data.device}
                    tracks={testTracks}
                    authFetch={authFetch}
                    isAdmin={isAdmin}
                  />
                </Card.Body>
              </Card>

              <Card>
                <Card.Header title="Latest capture" />
                <Card.Body>
                  {imageUrl ? (
                    <div className="overflow-hidden rounded-xl border border-slate-700/50">
                      <ImageCanvas imageUrl={imageUrl} predictions={predictions} />
                    </div>
                  ) : (
                    <EmptyState
                      title="No image yet"
                      message="Send a capture from the bridge or mobile report."
                      action={
                        <Link to="/mobile-report" className={btnSecondary}>
                          Mobile report
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      }
                    />
                  )}
                  {predictions.length > 0 ? (
                    <div className="mt-4">
                      <PredictionList predictions={predictions} />
                    </div>
                  ) : null}
                </Card.Body>
              </Card>

              <Card>
                <Card.Header
                  title="Capture history"
                  subtitle={`${captures.length} recent captures`}
                />
                <Card.Body className="overflow-x-auto">
                  {captures.length === 0 ? (
                    <EmptyState title="No captures recorded" />
                  ) : (
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="pb-2 pr-3">Time</th>
                          <th className="pb-2 pr-3">Source</th>
                          <th className="pb-2 pr-3">Fill %</th>
                          <th className="pb-2 pr-3">Summary</th>
                          <th className="pb-2 pr-3">GPS</th>
                          <th className="pb-2">Thumb</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {captures.map((c) => (
                          <tr key={c.id} className="text-slate-300">
                            <td className="py-2 pr-3">{formatTs(c.captured_at)}</td>
                            <td className="py-2 pr-3">{c.source_type || "—"}</td>
                            <td className="py-2 pr-3">
                              {c.fill_percentage != null
                                ? `${Math.round(Number(c.fill_percentage))}%`
                                : "—"}
                            </td>
                            <td className="py-2 pr-3">
                              {formatConfidenceSummary(c)}
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs">
                              {formatGps(c)}
                            </td>
                            <td className="py-2">
                              {c.has_image ? (
                                <a
                                  href={apiUrl(`/captures/${c.id}/image`)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={apiUrl(`/captures/${c.id}/image`)}
                                    alt=""
                                    className="h-10 w-10 rounded-lg border border-slate-700/50 object-cover"
                                  />
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card.Body>
              </Card>
            </>
          ) : !loading && !error ? (
            <EmptyState
              title="Bin not found"
              action={
                <Link to="/bins" className={btnSecondary}>
                  Back to registry
                </Link>
              }
            />
          ) : null}
        </PageShell>
      )}
    </DashboardLayout>
  );
}
