import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Trash2,
  AlertTriangle,
  ChevronRight,
  Gauge,
  Layers,
  MapPin,
  Sparkles,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import Card from "../components/dashboard/Card";
import LitterModelWorkspace, {
  SummaryChip,
} from "../components/litter/LitterModelWorkspace";
import {
  btnGhost,
  bannerTone,
  riskBadgeClass,
} from "../components/dashboard/dashboardUi";
import { analyzeLitterSeverity } from "../utils/apiBase";
import { formatLsi } from "../utils/litterSeverity";

const SEVERITY_HISTORY_CAP = 8;
const ELEVATED_STREAK_FOR_SIGNAGE = 3;

function severityClass(sev) {
  const s = (sev || "").toString().toUpperCase();
  if (s === "HIGH") return "text-red-300 bg-red-500/10 border-red-500/30";
  if (s === "MEDIUM") return "text-amber-300 bg-amber-500/10 border-amber-500/30";
  return "text-brand-300 bg-brand-500/10 border-brand-500/30";
}

function isElevatedSeverity(sev) {
  const s = (sev || "").toString().toUpperCase();
  return s === "HIGH" || s === "MEDIUM";
}

function trailingElevatedStreak(severities) {
  let n = 0;
  for (let i = severities.length - 1; i >= 0; i -= 1) {
    if (isElevatedSeverity(severities[i])) n += 1;
    else break;
  }
  return n;
}

function trailingHighStreak(severities) {
  let n = 0;
  for (let i = severities.length - 1; i >= 0; i -= 1) {
    if ((severities[i] || "").toString().toUpperCase() === "HIGH") n += 1;
    else break;
  }
  return n;
}

function Banner({ tone, icon: Icon, title, body, action }) {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 ${bannerTone(tone)}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm">
          <div className="font-semibold">{title}</div>
          <div className="mt-0.5 leading-relaxed opacity-90">{body}</div>
        </div>
      </div>
      {action}
    </div>
  );
}

export default function LitterSeverityPage() {
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [severityHistory, setSeverityHistory] = useState([]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const pickFile = useCallback((next) => {
    setFile(next);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next ? URL.createObjectURL(next) : null;
    });
    setResult(null);
    setError("");
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResult(null);
    setError("");
  }, []);

  const run = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await analyzeLitterSeverity(file);
      setResult(data);
      const sev = (data.severity || "").toString().trim();
      if (sev) {
        setSeverityHistory((prev) => [...prev, sev].slice(-SEVERITY_HISTORY_CAP));
      }
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.message ||
        "Request failed";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }, [file]);

  const elevatedStreak =
    result && !result.error ? trailingElevatedStreak(severityHistory) : 0;
  const highStreak =
    result && !result.error ? trailingHighStreak(severityHistory) : 0;
  const showConsistentSignageCallout =
    elevatedStreak >= ELEVATED_STREAK_FOR_SIGNAGE &&
    isElevatedSeverity(result?.severity);
  const showAddBinCallout =
    highStreak >= ELEVATED_STREAK_FOR_SIGNAGE &&
    (result?.severity || "").toString().toUpperCase() === "HIGH";

  const lastSev = result?.severity || "—";
  const lastLsi = result?.lsi != null ? formatLsi(result.lsi) : "—";
  const objectCount =
    result?.detection_count ?? result?.detections?.length ?? "—";

  const previewExtra =
    result && !result.error ? (
      <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/40">
        <div className="border-b border-slate-700/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          LSI overlay · {lastSev}
        </div>
        {result.annotated_image_base64 ? (
          <img
            src={`data:image/jpeg;base64,${result.annotated_image_base64}`}
            alt="Litter severity annotated output"
            className="block max-h-[360px] w-full object-contain"
          />
        ) : (
          <div className="px-3 py-10 text-center text-xs text-slate-500">
            No annotated image returned.
          </div>
        )}
      </div>
    ) : null;

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          title="Litter Severity (LSI)"
          subtitle={
            <>
              Detects individual litter objects around a bin and computes the
              Litter Severity Index (0–100). Requires{" "}
              <code className="rounded bg-slate-900/60 px-1 text-slate-300">
                MODEL_LITTER_URL
              </code>{" "}
              on the backend. Pair with{" "}
              <Link
                to="/littering-event"
                className="font-semibold text-orange-400 hover:underline"
              >
                Littering Event Detection
              </Link>{" "}
              for action-level events.
            </>
          }
          actions={
            <>
              <Link to="/dashboard" className={btnGhost}>
                Dashboard
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/littering-event" className={btnGhost}>
                Littering events
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryChip
            icon={Gauge}
            label="Last severity"
            value={lastSev}
            tone={
              lastSev === "HIGH"
                ? "red"
                : lastSev === "MEDIUM"
                  ? "amber"
                  : "brand"
            }
          />
          <SummaryChip
            icon={Sparkles}
            label="LSI score"
            value={lastLsi}
            sub="0–100 index"
          />
          <SummaryChip
            icon={Layers}
            label="Litter objects"
            value={objectCount}
          />
          <SummaryChip
            icon={MapPin}
            label="HIGH streak"
            value={highStreak}
            sub="this session"
            tone={highStreak >= 3 ? "red" : "default"}
          />
        </div>

        {error ? (
          <Banner
            tone="error"
            icon={AlertTriangle}
            title="Analysis failed"
            body={error}
          />
        ) : null}

        {showAddBinCallout ? (
          <Banner
            tone="error"
            icon={AlertTriangle}
            title="Add a new bin at this location"
            body={`The last ${highStreak} LSI analyses in a row were HIGH. Outside-bin litter pressure is continuous — register another bin nearby.`}
            action={
              <Link
                to="/bins"
                className="inline-flex shrink-0 items-center rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500"
              >
                Register bin
              </Link>
            }
          />
        ) : null}

        {showConsistentSignageCallout ? (
          <Banner
            tone="warn"
            icon={Trash2}
            title="Consistent MEDIUM or HIGH litter in this session"
            body={`The last ${elevatedStreak} analyses were MEDIUM or HIGH. Consider signage and bin placement review.`}
          />
        ) : null}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <LitterModelWorkspace
              icon={Trash2}
              title="LSI analysis workspace"
              badge="YOLO + LSI"
              runLabel="Run LSI analysis"
              runningLabel="Analyzing…"
              emptyHint="Drag & drop a bin-area photo"
              emptySub="Outside-bin litter · JPEG, PNG, WebP"
              hasFile={Boolean(file)}
              imageUrl={imageUrl}
              onPickFile={pickFile}
              loading={loading}
              onRun={run}
              onReset={reset}
              previewExtra={previewExtra}
            />

            {result && !result.error ? (
              <Card>
                <Card.Header icon={Gauge} title="Score breakdown" />
                <Card.Body>
                  <div
                    className={`rounded-xl border p-4 ${severityClass(result.severity)}`}
                  >
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Metric label="Severity" value={result.severity || "—"} />
                      <Metric
                        label="LSI"
                        value={
                          result.lsi != null
                            ? Number(result.lsi).toFixed(1)
                            : "—"
                        }
                      />
                      <Metric
                        label="Objects"
                        value={
                          result.detection_count ??
                          result.detections?.length ??
                          0
                        }
                      />
                      <Metric
                        label="Coverage"
                        value={
                          result.metrics?.coverage_fraction != null
                            ? `${(Number(result.metrics.coverage_fraction) * 100).toFixed(1)}%`
                            : "—"
                        }
                      />
                    </div>
                  </div>

                  {Array.isArray(result.detections) &&
                  result.detections.length > 0 ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-800/60">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Label</th>
                            <th className="px-3 py-2">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.detections.slice(0, 12).map((d, i) => (
                            <tr
                              key={`${d.label}-${i}`}
                              className="border-t border-slate-800/40"
                            >
                              <td className="px-3 py-2 text-slate-500">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2 text-slate-200">
                                {d.label || "litter"}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-slate-300">
                                {(Number(d.confidence) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {result.signage_advisory ? (
                    <div
                      className={`mt-4 rounded-xl border p-4 text-sm ${result.signage_advisory.warning_signs_recommended ? bannerTone("warn") : "border-slate-700/50 bg-slate-900/40 text-slate-300"}`}
                    >
                      <p className="font-semibold text-slate-100">
                        {result.signage_advisory.headline}
                      </p>
                      <p className="mt-2 leading-relaxed opacity-90">
                        {result.signage_advisory.detail}
                      </p>
                    </div>
                  ) : null}
                </Card.Body>
              </Card>
            ) : null}
          </div>

          <div className="space-y-5">
            <Card>
              <Card.Header icon={MapPin} title="Severity bands" />
              <Card.Body className="space-y-2 text-sm text-slate-400">
                <BandRow
                  label="LOW"
                  range="LSI ≤ 30"
                  className={riskBadgeClass("LOW")}
                />
                <BandRow
                  label="MEDIUM"
                  range="30 < LSI ≤ 53"
                  className={riskBadgeClass("MEDIUM")}
                />
                <BandRow
                  label="HIGH"
                  range="LSI > 53"
                  className={riskBadgeClass("HIGH")}
                />
                <p className="pt-2 text-xs leading-relaxed text-slate-500">
                  HIGH litter on the main dashboard triggers alerts. Three
                  consecutive HIGH readings recommend adding a bin at that
                  location.
                </p>
              </Card.Body>
              <Card.Footer>
                <Link
                  to="/dashboard"
                  className="text-xs font-semibold text-brand-400 hover:underline"
                >
                  View fleet litter status on Dashboard →
                </Link>
              </Card.Footer>
            </Card>

            {result?.metrics ? (
              <Card>
                <Card.Header icon={Layers} title="LSI components" />
                <Card.Body className="space-y-2 text-sm">
                  <MetricRow
                    label="Count score"
                    value={result.metrics.count_score}
                  />
                  <MetricRow
                    label="Area score"
                    value={result.metrics.area_score}
                  />
                  <MetricRow
                    label="Spread score"
                    value={result.metrics.spread_score}
                  />
                </Card.Body>
              </Card>
            ) : null}
          </div>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-800/40 py-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold tabular-nums text-slate-200">
        {value != null ? Number(value).toFixed(1) : "—"}
      </span>
    </div>
  );
}

function BandRow({ label, range, className }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span
        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}
      >
        {label}
      </span>
      <span className="text-xs text-slate-500">{range}</span>
    </div>
  );
}
