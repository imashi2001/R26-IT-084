import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  PawPrint,
  Bell,
  AlertTriangle,
  Volume2,
  RefreshCw,
  UploadCloud,
  Play,
  Loader2,
  RotateCcw,
  Bug,
  CalendarClock,
  Image as ImageIcon,
  ChevronRight,
  MapPin,
  Clock,
  Search,
  XCircle,
  Sparkles,
  Database,
} from "lucide-react";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
import {
  apiUrl,
  fetchBins,
  predictAnimal,
} from "../utils/apiBase";

/*
 * /animals  - Animal Detection center.
 *
 * Three core sections (under DashboardLayout, Tailwind cards):
 *
 *   1. Sighting summary chips (header) - 7-day totals: sightings,
 *      bins-with-sightings, top species, buzzer activations.
 *
 *   2. Model demo card (collapsible) - upload an image and run the
 *      animal microservice in isolation. Shows the annotated JPEG +
 *      every detection's label/confidence/box. Marked "Dev tool" so
 *      we can drop it later without touching anything else.
 *
 *   3. Weekly per-bin sightings cards - one card per installed bin
 *      with at least one detection in the last 7 days; shows the
 *      most-recent annotated thumbnail, sighting count, species mix,
 *      and a deep link to /bins/:id. Toggle to also show bins with
 *      zero sightings (so admins can confirm cameras work).
 *
 *   4. Buzzer activation log - derived events (no separate buzzer
 *      table in the backend yet). A buzzer event = capture where an
 *      animal was detected AND risk_level >= MEDIUM. Renders as
 *      "<time> <location> <date> buzzer activated" rows. Filterable
 *      by bin + search; CSV-friendly because every row is data-driven.
 *
 * All data sourced from GET /captures (animal_count, risk_level,
 * captured_at, device_id, weather_condition, has_image) + GET /devices
 * for the per-bin metadata. No new backend endpoints required.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* ============================ helpers ============================ */

function parseTs(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function relativeFromNow(iso) {
  const t = parseTs(iso);
  if (!t) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return `${Math.round(diff / 86400_000)}d ago`;
}

function riskBadgeClass(level) {
  switch ((level || "").toUpperCase()) {
    case "CRITICAL":
      return "bg-red-100 text-red-800 border-red-200";
    case "HIGH":
      return "bg-red-50 text-red-700 border-red-200";
    case "MEDIUM":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "LOW":
      return "bg-brand-50 text-brand-700 border-brand-200";
    default:
      return "bg-slate-100 text-ink-500 border-slate-200";
  }
}

function captureImageUrl(captureId) {
  try {
    return apiUrl(`/captures/${captureId}/image`);
  } catch {
    return null;
  }
}

function deriveBuzzerEvent(capture) {
  const risk = String(capture.risk_level || "").toUpperCase();
  if (!risk) return null;
  if (Number(capture.animal_count) <= 0) return null;
  if (risk !== "MEDIUM" && risk !== "HIGH" && risk !== "CRITICAL") return null;
  return { triggered: risk !== "MEDIUM", risk };
}

function topSpecies(captures) {
  const counts = new Map();
  for (const c of captures) {
    const arr = Array.isArray(c.predictions) ? c.predictions : [];
    for (const p of arr) {
      const label = String(p.label || p.class_name || "").toLowerCase();
      if (!label) continue;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

/* ============================ page ============================ */

export default function AnimalDetectionPage() {
  const [bins, setBins] = useState([]);
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbDisabled, setDbDisabled] = useState(false);
  const [showAllBins, setShowAllBins] = useState(false);
  const [demoOpen, setDemoOpen] = useState(true);

  /* --- load bins + captures --- */

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDbDisabled(false);
    try {
      const [{ bins: deviceList }, capResp] = await Promise.all([
        fetchBins(),
        fetch(apiUrl("/captures?limit=200")),
      ]);
      setBins(Array.isArray(deviceList) ? deviceList : []);

      if (capResp.status === 503) {
        setDbDisabled(true);
        setCaptures([]);
        return;
      }
      if (!capResp.ok) {
        const body = await capResp.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${capResp.status}`);
      }
      const body = await capResp.json();
      setCaptures(Array.isArray(body.captures) ? body.captures : []);
    } catch (e) {
      setError(e.message || "Could not load animal sightings.");
      setCaptures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* --- partition captures into "with animals (last 7d)" --- */

  const cutoff = Date.now() - WEEK_MS;
  const recentSightings = useMemo(() => {
    return captures.filter((c) => {
      if (Number(c.animal_count) <= 0) return false;
      const t = parseTs(c.captured_at);
      return t >= cutoff;
    });
  }, [captures, cutoff]);

  /* --- summary chips --- */

  const summary = useMemo(() => {
    const buzzerEvents = recentSightings.filter(deriveBuzzerEvent);
    const binsWithSightings = new Set(recentSightings.map((c) => c.device_id))
      .size;
    const species = topSpecies(recentSightings);
    return {
      totalSightings: recentSightings.length,
      buzzerEvents: buzzerEvents.length,
      binsWithSightings,
      topSpecies: species.slice(0, 5),
    };
  }, [recentSightings]);

  /* --- per-bin weekly buckets --- */

  const bucketsByBin = useMemo(() => {
    const map = new Map();
    for (const c of recentSightings) {
      const did = c.device_id ?? null;
      if (!map.has(did)) map.set(did, []);
      map.get(did).push(c);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => parseTs(b.captured_at) - parseTs(a.captured_at));
    }
    return map;
  }, [recentSightings]);

  const binCards = useMemo(() => {
    const list = bins.map((b) => {
      const caps = bucketsByBin.get(b.id) || [];
      return {
        bin: b,
        captures: caps,
        latest: caps[0] || null,
        sightingCount: caps.length,
      };
    });

    list.sort((a, b) => b.sightingCount - a.sightingCount);
    if (showAllBins) return list;
    return list.filter((row) => row.sightingCount > 0);
  }, [bins, bucketsByBin, showAllBins]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 lg:p-6">
        <PageHeader loading={loading} onRefresh={loadData} />

        {dbDisabled ? (
          <Banner
            tone="amber"
            icon={Database}
            title="Database not configured"
            body="Set DATABASE_URL on the backend service to load real animal sightings. The model demo below still works."
          />
        ) : null}

        {error ? (
          <Banner
            tone="red"
            icon={AlertTriangle}
            title="Could not load sightings"
            body={error}
          />
        ) : null}

        <SummaryRow summary={summary} loading={loading} />

        {/* Model demo (collapsible) */}
        <ModelDemoCard
          bins={bins}
          open={demoOpen}
          onToggle={() => setDemoOpen((v) => !v)}
        />

        {/* Per-bin weekly cards */}
        <BinSightingsSection
          loading={loading}
          dbDisabled={dbDisabled}
          rows={binCards}
          showAllBins={showAllBins}
          onToggleShowAll={() => setShowAllBins((v) => !v)}
        />

        {/* Buzzer log */}
        <BuzzerLogSection
          captures={recentSightings}
          bins={bins}
          loading={loading}
          dbDisabled={dbDisabled}
        />
      </div>
    </DashboardLayout>
  );
}

/* ============================ subcomponents ============================ */

function PageHeader({ loading, onRefresh }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          Animal Detection
        </h1>
        <p className="mt-0.5 max-w-3xl text-sm text-ink-500">
          Weekly snapshot of animals detected near every installed bin, plus a
          live log of when the deterrent buzzer fires. Use the demo panel to
          spot-check the YOLO animal model against any image; remove the panel
          when the system is in production.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <Link
          to="/hygienic-risk"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
        >
          Risk dashboard
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          to="/bin-level-detector"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
        >
          Bin Level Detector
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function SummaryRow({ summary, loading }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryChip
        icon={PawPrint}
        label="Sightings (7d)"
        value={loading ? "…" : summary.totalSightings}
        tone="brand"
      />
      <SummaryChip
        icon={MapPin}
        label="Bins w/ sightings"
        value={loading ? "…" : summary.binsWithSightings}
        tone="default"
      />
      <SummaryChip
        icon={Volume2}
        label="Buzzer events (7d)"
        value={loading ? "…" : summary.buzzerEvents}
        tone="amber"
      />
      <SummaryChip
        icon={Sparkles}
        label="Top species"
        value={
          loading
            ? "…"
            : summary.topSpecies.length
              ? summary.topSpecies[0].label
              : "—"
        }
        tone="default"
        sub={
          loading
            ? ""
            : summary.topSpecies.length
              ? `${summary.topSpecies[0].count} sighting${
                  summary.topSpecies[0].count > 1 ? "s" : ""
                }`
              : "no detections yet"
        }
      />
    </div>
  );
}

function SummaryChip({ icon: Icon, label, value, tone = "default", sub }) {
  const tones = {
    default: "bg-white border-slate-200 text-ink-700",
    brand: "bg-brand-50 border-brand-200 text-brand-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    risk: "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${tones[tone]}`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/70 ring-1 ring-white">
        <Icon className="h-4 w-4" />
      </div>
      <div className="leading-tight min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {label}
        </div>
        <div className="truncate text-lg font-bold capitalize tabular-nums">
          {value}
        </div>
        {sub ? (
          <div className="truncate text-[10px] opacity-70">{sub}</div>
        ) : null}
      </div>
    </div>
  );
}

function Banner({ tone, icon: Icon, title, body }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    brand: "border-brand-200 bg-brand-50 text-brand-800",
  };
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tones[tone]}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5 break-words">{body}</div>
      </div>
    </div>
  );
}

/* ============================ model demo ============================ */

function ModelDemoCard({ bins, open, onToggle }) {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [binId, setBinId] = useState("");
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setImageFile(file);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setResult(null);
    setError(null);
  }, []);

  const onFileChange = (e) => handleFile(e.target.files[0]);
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);

  const runDetection = async () => {
    if (!imageFile) return;
    setBusy(true);
    setError(null);
    try {
      const data = await predictAnimal(imageFile, binId || undefined);
      setResult(data);
      if (
        !data?.animal ||
        data.animal.error ||
        !Array.isArray(data.animal.detections)
      ) {
        setError(
          data?.animal?.error ||
            "Animal microservice did not return detections. Check MODEL_ANIMAL_URL."
        );
      }
    } catch (e) {
      setError(e.message || "Detection request failed.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setImageFile(null);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card>
      <Card.Header
        icon={Bug}
        title="Model demo — animal detector"
        right={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
              Dev tool
            </span>
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-ink-600 hover:bg-slate-50"
            >
              {open ? "Hide" : "Show"}
            </button>
          </div>
        }
      />
      {open ? (
        <Card.Body className="!mt-2 space-y-4">
          {error ? (
            <Banner
              tone="red"
              icon={AlertTriangle}
              title="Detector error"
              body={error}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {!imageUrl ? (
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    fileInputRef.current?.click();
                  }
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                  dragOver
                    ? "border-brand-500 bg-brand-50/60"
                    : "border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/40"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                  <UploadCloud className="h-6 w-6 text-brand-600" />
                </div>
                <div className="text-sm font-semibold text-ink-900">
                  Drop a test image
                </div>
                <div className="text-xs text-ink-500">
                  or click to browse — runs only the YOLO animal model
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  style={{ display: "none" }}
                />
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Source image
                </div>
                <img
                  src={imageUrl}
                  alt="Source"
                  className="block max-h-[360px] w-full object-contain"
                />
              </div>
            )}

            {result?.animal && !result.animal.error ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Animal YOLO ·{" "}
                  {typeof result.animal.detection_count === "number"
                    ? `${result.animal.detection_count} detection(s)`
                    : ""}
                </div>
                {result.animal.annotated_image_base64 ? (
                  <img
                    src={`data:image/jpeg;base64,${result.animal.annotated_image_base64}`}
                    alt="Annotated detection"
                    className="block max-h-[360px] w-full object-contain"
                  />
                ) : (
                  <div className="px-3 py-6 text-center text-xs text-ink-500">
                    No annotated image available.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-xs text-ink-500">
                Run detection to see the YOLO-annotated output here.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">
                Bin
              </span>
              <select
                value={binId}
                onChange={(e) => setBinId(e.target.value)}
                className="bg-transparent text-sm font-medium text-ink-900 focus:outline-none"
              >
                <option value="">No bin (just model)</option>
                {bins.map((b) => (
                  <option key={b.id} value={b.id}>
                    #{b.id} · {b.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={runDetection}
              disabled={!imageFile || busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Detecting…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run animal detection
                </>
              )}
            </button>

            {imageFile ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            ) : null}
          </div>

          {result?.animal &&
          !result.animal.error &&
          Array.isArray(result.animal.detections) &&
          result.animal.detections.length > 0 ? (
            <DetectionListInline detections={result.animal.detections} />
          ) : null}
        </Card.Body>
      ) : (
        <Card.Body className="!mt-1 text-xs text-ink-500">
          Demo panel is hidden. Click <strong>Show</strong> on the right to
          open it again.
        </Card.Body>
      )}
      <Card.Footer>
        This panel is intentionally easy to remove later — it only calls the
        animal microservice (<code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">model=animal</code>) and is not used by any other page.
      </Card.Footer>
    </Card>
  );
}

function DetectionListInline({ detections }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
        Detections ({detections.length})
      </div>
      <ul className="space-y-1.5">
        {detections.map((d, i) => {
          const conf = Number.isFinite(Number(d.confidence))
            ? `${(Number(d.confidence) * 100).toFixed(1)}%`
            : "—";
          return (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
            >
              <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold capitalize text-brand-800">
                {d.label || d.class_name || "animal"}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-ink-700">
                {conf}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================ weekly per-bin cards ============================ */

function BinSightingsSection({
  loading,
  dbDisabled,
  rows,
  showAllBins,
  onToggleShowAll,
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-ink-900">
            Weekly bin sightings
          </h2>
          <p className="text-xs text-ink-500">
            Latest animal sighting captured near each bin in the last 7 days.
            Cards auto-refresh from the capture history; older sightings drop
            off automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleShowAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
        >
          {showAllBins ? "Hide bins with no sightings" : "Show all bins"}
        </button>
      </div>

      {loading ? (
        <BinCardSkeletonGrid />
      ) : dbDisabled ? (
        <EmptyCard
          title="No sightings to show"
          body="Configure DATABASE_URL on the backend service to persist captures. Sightings will appear here as soon as the bridge or mobile uploads start firing."
        />
      ) : rows.length === 0 ? (
        <EmptyCard
          title={
            showAllBins
              ? "No bins registered yet"
              : "No animal sightings in the last 7 days"
          }
          body={
            showAllBins
              ? "Register bins on the Bin Status page before captures can be attributed."
              : "Either no animals approached the bins this week, or the captures are not associated with a device. Toggle “Show all bins” to confirm."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <BinSightingCard key={row.bin.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

function BinCardSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="h-32 w-full rounded-lg bg-slate-100" />
          <div className="mt-3 h-4 w-1/2 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function EmptyCard({ title, body }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
        <PawPrint className="h-5 w-5 text-ink-400" />
      </div>
      <div className="mt-2 text-sm font-semibold text-ink-900">{title}</div>
      <div className="mt-0.5 text-xs text-ink-500">{body}</div>
    </div>
  );
}

function BinSightingCard({ row }) {
  const { bin, captures, latest, sightingCount } = row;
  const species = topSpecies(captures);
  const top = species.slice(0, 4);
  const latestImg = latest ? captureImageUrl(latest.id) : null;
  const risk = latest?.risk_level || null;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="relative aspect-[16/10] w-full bg-slate-100">
        {sightingCount > 0 && latestImg ? (
          <img
            src={latestImg}
            alt={`Animal near ${bin.name}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-400">
            <ImageIcon className="h-7 w-7" />
            <span className="text-xs">No sighting this week</span>
          </div>
        )}
        {sightingCount > 0 ? (
          <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            <PawPrint className="h-3 w-3" />
            {sightingCount} sighting{sightingCount > 1 ? "s" : ""} · 7d
          </div>
        ) : null}
        {risk ? (
          <div
            className={`absolute right-2 top-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskBadgeClass(risk)}`}
          >
            Risk {risk}
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink-900">
              {bin.name}
            </div>
            <div className="text-[11px] text-ink-500">
              {latest
                ? `Latest sighting · ${formatTime(latest.captured_at)} · ${formatDate(latest.captured_at)}`
                : "No sightings yet this week"}
            </div>
          </div>
          <Link
            to={`/bins/${bin.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-ink-600 hover:bg-slate-50"
          >
            Details
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {top.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {top.map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-semibold capitalize text-brand-800"
              >
                {s.label}
                <span className="rounded-full bg-white/70 px-1 text-[9px] text-brand-700 ring-1 ring-brand-200">
                  {s.count}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-ink-400">No species labels yet</div>
        )}

        {latest ? (
          <div className="mt-1 text-[11px] text-ink-500">
            {latest.weather_condition ? (
              <span>{latest.weather_condition} · </span>
            ) : null}
            {relativeFromNow(latest.captured_at)}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/* ============================ buzzer activations ============================ */

function BuzzerLogSection({ captures, bins, loading, dbDisabled }) {
  const [query, setQuery] = useState("");
  const [binFilter, setBinFilter] = useState("all");

  const binsById = useMemo(() => {
    const m = new Map();
    for (const b of bins) m.set(b.id, b);
    return m;
  }, [bins]);

  const events = useMemo(() => {
    const list = [];
    for (const c of captures) {
      const ev = deriveBuzzerEvent(c);
      if (!ev) continue;
      const bin = c.device_id != null ? binsById.get(c.device_id) : null;
      list.push({
        id: c.id,
        captured_at: c.captured_at,
        device_id: c.device_id,
        bin_name: bin?.name || "Unbound capture",
        location: bin?.location || bin?.address || null,
        risk: ev.risk,
        triggered: ev.triggered,
        weather: c.weather_condition || null,
        animal_count: c.animal_count || 0,
      });
    }
    list.sort((a, b) => parseTs(b.captured_at) - parseTs(a.captured_at));
    return list;
  }, [captures, binsById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = events;
    if (binFilter !== "all") {
      const id = Number(binFilter);
      rows = rows.filter((r) => Number(r.device_id) === id);
    }
    if (q) {
      rows = rows.filter((r) => {
        const hay = [
          r.bin_name,
          r.location,
          r.risk,
          r.weather,
          formatDate(r.captured_at),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return rows;
  }, [events, binFilter, query]);

  const clearFilters = () => {
    setBinFilter("all");
    setQuery("");
  };

  return (
    <Card>
      <Card.Header
        icon={Volume2}
        title="Buzzer activations"
        right={
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            {filtered.length}
          </span>
        }
      />
      <Card.Body className="!mt-2 space-y-3">
        <p className="text-xs text-ink-500">
          Derived from captures where the YOLO model detected at least one
          animal and the rule-based risk engine flagged the moment as MEDIUM
          or higher. Until a dedicated buzzer event table exists, this is the
          most faithful reconstruction of when the deterrent would have fired.
        </p>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search bin name, location, date…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">
              Bin
            </span>
            <select
              value={binFilter}
              onChange={(e) => setBinFilter(e.target.value)}
              className="bg-transparent text-sm font-medium text-ink-900 focus:outline-none"
            >
              <option value="all">All bins</option>
              {bins.map((b) => (
                <option key={b.id} value={b.id}>
                  #{b.id} · {b.name}
                </option>
              ))}
            </select>
          </label>
          {(query || binFilter !== "all") && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-ink-600 hover:bg-slate-50"
            >
              <XCircle className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <ul className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <li
                key={i}
                className="animate-pulse rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="h-3 w-2/3 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
              </li>
            ))}
          </ul>
        ) : dbDisabled ? (
          <EmptyCard
            title="No buzzer events to show"
            body="Database is disabled, so captures aren't being persisted. Configure DATABASE_URL on the backend to enable this log."
          />
        ) : filtered.length === 0 ? (
          <EmptyCard
            title="No buzzer activations match the current filters"
            body="When animal sightings escalate to MEDIUM+ risk, an event appears here automatically. Adjust filters or clear them to see more."
          />
        ) : (
          <ul className="space-y-2">
            {filtered.map((ev) => (
              <BuzzerEventRow key={ev.id} ev={ev} />
            ))}
          </ul>
        )}
      </Card.Body>
      <Card.Footer>
        Drop a real buzzer-event table on the backend later and this list
        becomes a simple <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">GET /buzzer-events</code> without any UI changes.
      </Card.Footer>
    </Card>
  );
}

function BuzzerEventRow({ ev }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
            <Volume2 className="h-3 w-3" />
            Buzzer activated
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskBadgeClass(ev.risk)}`}
          >
            Risk {ev.risk}
          </span>
          {!ev.triggered ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-ink-500">
              MEDIUM threshold
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-sm font-semibold text-ink-900">
          {ev.bin_name}
          {ev.location ? (
            <span className="ml-1 text-[11px] font-normal text-ink-500">
              · {ev.location}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-ink-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(ev.captured_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {formatDate(ev.captured_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <PawPrint className="h-3 w-3" />
            {ev.animal_count} animal{ev.animal_count > 1 ? "s" : ""}
          </span>
          {ev.weather ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {ev.weather}
            </span>
          ) : null}
          <span>{relativeFromNow(ev.captured_at)}</span>
        </div>
      </div>
      {ev.device_id != null ? (
        <Link
          to={`/bins/${ev.device_id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
        >
          <Bell className="h-3.5 w-3.5" />
          Bin details
        </Link>
      ) : null}
    </li>
  );
}
