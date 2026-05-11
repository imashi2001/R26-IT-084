import { useCallback, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import { analyzeLitterSeverity } from "../utils/apiBase";

/**
 * Litter Severity — VisionWaste dashboard page.
 * Uploads an image to POST /litter-severity (Express proxies to litter microservice).
 */

const SEVERITY_HISTORY_CAP = 8;
const ELEVATED_STREAK_FOR_SIGNAGE = 3;

function severityClass(sev) {
  const s = (sev || "").toString().toUpperCase();
  if (s === "HIGH") return "text-red-600 bg-red-50 border-red-200";
  if (s === "MEDIUM") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

function isElevatedSeverity(sev) {
  const s = (sev || "").toString().toUpperCase();
  return s === "HIGH" || s === "MEDIUM";
}

/** Count trailing consecutive MEDIUM/HIGH from the end of the list. */
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
    const f = e.target.files?.[0];
    setFile(f || null);
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
        setSeverityHistory((prev) =>
          [...prev, sev].slice(-SEVERITY_HISTORY_CAP)
        );
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
    result && !result.error
      ? trailingElevatedStreak(severityHistory)
      : 0;
  const showConsistentSignageCallout =
    elevatedStreak >= ELEVATED_STREAK_FOR_SIGNAGE &&
    isElevatedSeverity(result?.severity);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Litter Severity</h1>
          <p className="mt-1 text-sm text-ink-500">
            Detect litter around bins and compute the Litter Severity Index (LSI).
            Requires the litter microservice (
            <code className="rounded bg-slate-100 px-1">MODEL_LITTER_URL</code> on
            the backend).
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
          <label className="block text-sm font-medium text-ink-700">
            Image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFile}
              className="mt-2 block w-full text-sm text-ink-600 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-600"
            />
          </label>
          <button
            type="button"
            disabled={!file || loading}
            onClick={run}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Run analysis"}
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {result && !result.error ? (
          <div className="space-y-4">
            {showConsistentSignageCallout ? (
              <div
                className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-amber-950 shadow-card"
                role="status"
              >
                <p className="text-sm font-semibold">
                  Consistent MEDIUM or HIGH littering in this session
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  The last {elevatedStreak} image analyses in a row were MEDIUM
                  or HIGH. It is recommended to add visible warning signs in
                  the area (for example “No littering”, “Use the bin”) and to
                  review bin placement and collection if this matches the site in
                  real life.
                </p>
              </div>
            ) : null}

            {result.signage_advisory ? (
              <div
                className={`rounded-xl border p-4 text-sm leading-relaxed shadow-card ${
                  result.signage_advisory.warning_signs_recommended
                    ? "border-amber-300 bg-amber-50/80 text-ink-900"
                    : "border-slate-200 bg-slate-50 text-ink-800"
                }`}
              >
                <p className="font-semibold text-ink-900">
                  {result.signage_advisory.headline}
                </p>
                <p className="mt-2">{result.signage_advisory.detail}</p>
                {result.signage_advisory.for_this_assessment ? (
                  <p className="mt-2 text-ink-600">
                    {result.signage_advisory.for_this_assessment}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div
              className={`rounded-xl border p-4 ${severityClass(result.severity)}`}
            >
              <div className="flex flex-wrap items-baseline gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                    Severity
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
                    Detections
                  </p>
                  <p className="text-2xl font-bold">
                    {result.detection_count ?? result.detections?.length ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {result.annotated_image_base64 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-card">
                <img
                  src={`data:image/jpeg;base64,${result.annotated_image_base64}`}
                  alt="Litter detections and LSI overlay"
                  className="mx-auto max-h-[70vh] w-full object-contain"
                />
              </div>
            ) : null}

            {result.metrics ? (
              <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                <summary className="cursor-pointer font-medium text-ink-800">
                  Metrics (JSON)
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-50 p-3 text-xs text-ink-700">
                  {JSON.stringify(result.metrics, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
