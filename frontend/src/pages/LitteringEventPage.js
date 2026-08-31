import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import LitteringBBoxCanvas from "../components/LitteringBBoxCanvas";
import { btnPrimary, labelClass, bannerTone } from "../components/dashboard/dashboardUi";
import { analyzeLitteringAction } from "../utils/apiBase";
import { summarizeLitteringAction } from "../utils/litteringAction";

/**
 * /littering-event — YOLO11 littering-event detector (trained best.pt).
 * Detects a person/action visually throwing or leaving garbage near a bin.
 * Not the LSI litter-object model (see /litter-severity).
 */
export default function LitteringEventPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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
      const data = await analyzeLitteringAction(file);
      setResult(data);
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

  const summary = result ? summarizeLitteringAction(result) : null;

  return (
    <DashboardLayout>
      <PageShell className="max-w-3xl">
        <PageHeader
          title="Littering Event Detection"
          subtitle={
            <>
              Your trained YOLO11 model detects frame-level littering events (person/action
              near a bin). Requires{" "}
              <code className="rounded bg-slate-900/60 px-1 text-slate-300">
                MODEL_LITTERING_ACTION_URL
              </code>{" "}
              on the backend. This is separate from the{" "}
              <Link to="/litter-severity" className="text-brand-400 hover:underline">
                Litter Severity (LSI)
              </Link>{" "}
              model.
            </>
          }
        />

        <div className="rounded-xl border border-orange-500/30 bg-slate-950/40 p-6">
          <label className="block">
            <span className={labelClass}>Upload image</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFile}
              className="mt-2 block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-orange-500"
            />
          </label>
          <button
            type="button"
            disabled={!file || loading}
            onClick={run}
            className={`${btnPrimary} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {loading ? "Detecting…" : "Run detection"}
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        {summary?.ok ? (
          <div className="mt-6 space-y-4">
            <div
              className={`rounded-xl border p-4 ${
                summary.eventDetected
                  ? "border-orange-500/40 bg-orange-500/10 text-orange-100"
                  : "border-slate-700/50 bg-slate-900/40 text-slate-300"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                Model result
              </p>
              <p className="text-2xl font-bold">
                {summary.eventDetected
                  ? "Littering event detected"
                  : "No littering event detected"}
              </p>
              <div className="mt-3 flex flex-wrap gap-6 text-sm">
                <span>
                  Max confidence:{" "}
                  <strong>{(summary.maxConfidence * 100).toFixed(1)}%</strong>
                </span>
                <span>
                  Detections: <strong>{summary.eventCount}</strong>
                </span>
              </div>
            </div>

            {summary.eventDetected ? (
              <div
                className={`rounded-xl border p-4 ${bannerTone("warn")}`}
                role="status"
              >
                <p className="text-sm font-semibold">
                  Repeated littering at a site may need extra bin capacity
                </p>
                <p className="mt-2 text-sm leading-relaxed opacity-90">
                  A littering event was detected on this capture. If this location
                  sees frequent events, consider registering another bin nearby.
                </p>
                <Link
                  to="/bins"
                  className="mt-3 inline-block text-sm font-semibold text-brand-300 hover:underline"
                >
                  Register new bin →
                </Link>
              </div>
            ) : null}

            {file && summary.detections.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950">
                <LitteringBBoxCanvas
                  imageFile={file}
                  detections={summary.detections}
                />
              </div>
            ) : null}

            {result?.model ? (
              <details className="rounded-xl border border-slate-700/50 bg-slate-950/40 p-4 text-sm">
                <summary className="cursor-pointer font-medium text-slate-200">
                  Model metadata
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto rounded bg-slate-900/60 p-3 text-xs text-slate-400">
                  {JSON.stringify(
                    {
                      task: result.model?.task,
                      class_names: result.model?.class_names,
                      inference_ms: result.inference_ms,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </PageShell>
    </DashboardLayout>
  );
}
