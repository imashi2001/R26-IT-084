import { useCallback, useState } from "react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import LitteringBBoxCanvas from "../components/LitteringBBoxCanvas";
import { btnPrimary, labelClass, bannerTone } from "../components/dashboard/dashboardUi";
import { analyzeLitterSeverity, analyzeLitteringAction } from "../utils/apiBase";
import { summarizeLitteringAction } from "../utils/litteringAction";

/**
 * Litter Severity page — two isolated analysis tools:
 *  1. Littering Event Detection (person/action near bin)
 *  2. Outside-Bin Litter Severity Index (individual litter objects + LSI)
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
  const [lsiFile, setLsiFile] = useState(null);
  const [lsiLoading, setLsiLoading] = useState(false);
  const [lsiError, setLsiError] = useState("");
  const [lsiResult, setLsiResult] = useState(null);
  const [severityHistory, setSeverityHistory] = useState([]);

  const [eventFile, setEventFile] = useState(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState("");
  const [eventResult, setEventResult] = useState(null);

  const onLsiFile = useCallback((e) => {
    setLsiFile(e.target.files?.[0] || null);
    setLsiResult(null);
    setLsiError("");
  }, []);

  const onEventFile = useCallback((e) => {
    setEventFile(e.target.files?.[0] || null);
    setEventResult(null);
    setEventError("");
  }, []);

  const runLsi = useCallback(async () => {
    if (!lsiFile) return;
    setLsiLoading(true);
    setLsiError("");
    setLsiResult(null);
    try {
      const data = await analyzeLitterSeverity(lsiFile);
      setLsiResult(data);
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
      setLsiError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLsiLoading(false);
    }
  }, [lsiFile]);

  const runEvent = useCallback(async () => {
    if (!eventFile) return;
    setEventLoading(true);
    setEventError("");
    setEventResult(null);
    try {
      const data = await analyzeLitteringAction(eventFile);
      setEventResult(data);
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.message ||
        "Request failed";
      setEventError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setEventLoading(false);
    }
  }, [eventFile]);

  const eventSummary = eventResult ? summarizeLitteringAction(eventResult) : null;

  const elevatedStreak =
    lsiResult && !lsiResult.error
      ? trailingElevatedStreak(severityHistory)
      : 0;
  const showConsistentSignageCallout =
    elevatedStreak >= ELEVATED_STREAK_FOR_SIGNAGE &&
    isElevatedSeverity(lsiResult?.severity);

  return (
    <DashboardLayout>
      <PageShell className="max-w-3xl">
        <PageHeader
          title="Litter Analysis"
          subtitle={
            <>
              Two separate models: <strong>littering-event detection</strong> (person/action)
              and <strong>outside-bin litter severity</strong> (individual litter objects + LSI).
            </>
          }
        />

        <section className="rounded-xl border border-orange-500/30 bg-slate-950/40 p-6">
          <h2 className="text-lg font-semibold text-orange-200">
            1. Littering Event Detection
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Frame-level detector for a person visually throwing or leaving garbage near a bin.
            Requires{" "}
            <code className="rounded bg-slate-900/60 px-1 text-slate-300">
              MODEL_LITTERING_ACTION_URL
            </code>
            . This is <em>not</em> the LSI litter-object counter.
          </p>

          <label className="mt-4 block">
            <span className={labelClass}>Image</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onEventFile}
              className="mt-2 block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-orange-500"
            />
          </label>
          <button
            type="button"
            disabled={!eventFile || eventLoading}
            onClick={runEvent}
            className={`${btnPrimary} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {eventLoading ? "Detecting…" : "Run littering-event detection"}
          </button>
          {eventError ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {eventError}
            </p>
          ) : null}

          {eventSummary?.ok ? (
            <div className="mt-4 space-y-4">
              <div
                className={`rounded-xl border p-4 ${
                  eventSummary.eventDetected
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-100"
                    : "border-slate-700/50 bg-slate-900/40 text-slate-300"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                  Result
                </p>
                <p className="text-2xl font-bold">
                  {eventSummary.eventDetected
                    ? "Littering event detected"
                    : "No littering event detected"}
                </p>
                <div className="mt-3 flex flex-wrap gap-6 text-sm">
                  <span>
                    Confidence:{" "}
                    <strong>{(eventSummary.maxConfidence * 100).toFixed(1)}%</strong>
                  </span>
                  <span>
                    Detections: <strong>{eventSummary.eventCount}</strong>
                  </span>
                </div>
              </div>

              {eventFile && eventSummary.detections.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950">
                  <LitteringBBoxCanvas
                    imageFile={eventFile}
                    detections={eventSummary.detections}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="mt-8 rounded-xl border border-brand-500/30 bg-slate-950/40 p-6">
          <h2 className="text-lg font-semibold text-brand-200">
            2. Outside-Bin Litter Severity Index
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Detects individual litter objects around a bin and computes LSI (count, coverage,
            spread). Requires{" "}
            <code className="rounded bg-slate-900/60 px-1 text-slate-300">
              MODEL_LITTER_URL
            </code>
            .
          </p>

          <label className="mt-4 block">
            <span className={labelClass}>Image</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onLsiFile}
              className="mt-2 block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-500"
            />
          </label>
          <button
            type="button"
            disabled={!lsiFile || lsiLoading}
            onClick={runLsi}
            className={`${btnPrimary} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {lsiLoading ? "Analyzing…" : "Run LSI analysis"}
          </button>
          {lsiError ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {lsiError}
            </p>
          ) : null}
        </section>

        {lsiResult && !lsiResult.error ? (
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

            {lsiResult.signage_advisory ? (
              <div
                className={`rounded-xl border p-4 text-sm leading-relaxed ${
                  lsiResult.signage_advisory.warning_signs_recommended
                    ? bannerTone("warn")
                    : "border-slate-700/50 bg-slate-900/40 text-slate-300"
                }`}
              >
                <p className="font-semibold text-slate-100">
                  {lsiResult.signage_advisory.headline}
                </p>
                <p className="mt-2">{lsiResult.signage_advisory.detail}</p>
              </div>
            ) : null}

            <div
              className={`rounded-xl border p-4 ${severityClass(lsiResult.severity)}`}
            >
              <div className="flex flex-wrap items-baseline gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                    LSI Severity
                  </p>
                  <p className="text-2xl font-bold">{lsiResult.severity || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                    LSI (0–100)
                  </p>
                  <p className="text-2xl font-bold">
                    {lsiResult.lsi != null ? Number(lsiResult.lsi).toFixed(1) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                    Litter objects
                  </p>
                  <p className="text-2xl font-bold">
                    {lsiResult.detection_count ?? lsiResult.detections?.length ?? 0}
                  </p>
                </div>
              </div>
            </div>

            {lsiResult.annotated_image_base64 ? (
              <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950">
                <img
                  src={`data:image/jpeg;base64,${lsiResult.annotated_image_base64}`}
                  alt="Outside-bin litter objects and LSI overlay"
                  className="mx-auto max-h-[70vh] w-full object-contain"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </PageShell>
    </DashboardLayout>
  );
}
