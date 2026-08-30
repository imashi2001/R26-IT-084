import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import { btnPrimary, labelClass, bannerTone } from "../components/dashboard/dashboardUi";
import { analyzeLitterSeverity } from "../utils/apiBase";

/**
 * /litter-severity — Outside-bin Litter Severity Index (LSI) only.
 * For littering-event detection (YOLO11 best.pt), see /littering-event.
 */

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

export default function LitterSeverityPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [severityHistory, setSeverityHistory] = useState([]);

  const onFile = useCallback((e) => {
    setFile(e.target.files?.[0] || null);
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
  const showConsistentSignageCallout =
    elevatedStreak >= ELEVATED_STREAK_FOR_SIGNAGE &&
    isElevatedSeverity(result?.severity);

  return (
    <DashboardLayout>
      <PageShell className="max-w-3xl">
        <PageHeader
          title="Litter Severity (LSI)"
          subtitle={
            <>
              Detects individual litter objects around a bin and computes the Litter
              Severity Index. Requires{" "}
              <code className="rounded bg-slate-900/60 px-1 text-slate-300">
                MODEL_LITTER_URL
              </code>
              . For your trained littering-event model, use{" "}
              <Link to="/littering-event" className="text-orange-400 hover:underline">
                Littering Event Detection
              </Link>
              .
            </>
          }
        />

        <div className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-6">
          <label className="block">
            <span className={labelClass}>Image</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFile}
              className="mt-2 block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-500"
            />
          </label>
          <button
            type="button"
            disabled={!file || loading}
            onClick={run}
            className={`${btnPrimary} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {loading ? "Analyzing…" : "Run LSI analysis"}
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {result && !result.error ? (
          <div className="mt-6 space-y-4">
            {showConsistentSignageCallout ? (
              <div
                className={`rounded-xl border p-4 ${bannerTone("warn")}`}
                role="status"
              >
                <p className="text-sm font-semibold">
                  Consistent MEDIUM or HIGH outside-bin litter in this session
                </p>
                <p className="mt-2 text-sm leading-relaxed opacity-90">
                  The last {elevatedStreak} LSI analyses in a row were MEDIUM or HIGH.
                  Consider signage and bin placement review for the site.
                </p>
              </div>
            ) : null}

            {result.signage_advisory ? (
              <div
                className={`rounded-xl border p-4 text-sm leading-relaxed ${
                  result.signage_advisory.warning_signs_recommended
                    ? bannerTone("warn")
                    : "border-slate-700/50 bg-slate-900/40 text-slate-300"
                }`}
              >
                <p className="font-semibold text-slate-100">
                  {result.signage_advisory.headline}
                </p>
                <p className="mt-2">{result.signage_advisory.detail}</p>
              </div>
            ) : null}

            <div
              className={`rounded-xl border p-4 ${severityClass(result.severity)}`}
            >
              <div className="flex flex-wrap items-baseline gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                    LSI Severity
                  </p>
                  <p className="text-2xl font-bold">{result.severity || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                    LSI (0–100)
                  </p>
                  <p className="text-2xl font-bold">
                    {result.lsi != null ? Number(result.lsi).toFixed(1) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                    Litter objects
                  </p>
                  <p className="text-2xl font-bold">
                    {result.detection_count ?? result.detections?.length ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {result.annotated_image_base64 ? (
              <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950">
                <img
                  src={`data:image/jpeg;base64,${result.annotated_image_base64}`}
                  alt="Outside-bin litter objects and LSI overlay"
                  className="mx-auto max-h-[70vh] w-full object-contain"
                />
              </div>
            ) : null}

            {result.metrics ? (
              <details className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-4 text-sm">
                <summary className="cursor-pointer font-medium text-slate-200">
                  Metrics (JSON)
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-900/60 p-3 text-xs text-slate-400">
                  {JSON.stringify(result.metrics, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </PageShell>
    </DashboardLayout>
  );
}
