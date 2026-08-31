import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldAlert,
  AlertTriangle,
  ChevronRight,
  Target,
  Users,
  Zap,
  CheckCircle2,
} from "lucide-react";
import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import Card from "../components/dashboard/Card";
import LitterModelWorkspace, {
  SummaryChip,
} from "../components/litter/LitterModelWorkspace";
import LitteringBBoxCanvas from "../components/LitteringBBoxCanvas";
import {
  btnGhost,
  bannerTone,
} from "../components/dashboard/dashboardUi";
import { analyzeLitteringAction } from "../utils/apiBase";
import { summarizeLitteringAction } from "../utils/litteringAction";

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

export default function LitteringEventPage() {
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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

  const previewExtra =
    summary?.ok && file && summary.detections.length > 0 ? (
      <div className="overflow-hidden rounded-xl border border-orange-500/30 bg-slate-950/40">
        <div className="border-b border-orange-500/20 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-orange-300/80">
          YOLO11 detections · {summary.eventCount} event
          {summary.eventCount === 1 ? "" : "s"}
        </div>
        <LitteringBBoxCanvas
          imageFile={file}
          detections={summary.detections}
          className="max-h-[360px] w-full"
        />
      </div>
    ) : summary?.ok ? (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/50 bg-slate-950/30 px-6 py-10 text-center">
        <CheckCircle2 className="mb-2 h-8 w-8 text-brand-400" />
        <p className="text-sm font-semibold text-slate-200">
          No littering event detected
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Model ran successfully — no action boxes on this frame.
        </p>
      </div>
    ) : null;

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          title="Littering Event Detection"
          subtitle={
            <>
              Frame-level littering events (person/action near a bin) using your
              trained YOLO11 model. Requires{" "}
              <code className="rounded bg-slate-900/60 px-1 text-slate-300">
                MODEL_LITTERING_ACTION_URL
              </code>
              . For outside-bin litter objects and LSI, use{" "}
              <Link
                to="/litter-severity"
                className="font-semibold text-brand-400 hover:underline"
              >
                Litter Severity (LSI)
              </Link>
              .
            </>
          }
          actions={
            <>
              <Link to="/dashboard" className={btnGhost}>
                Dashboard
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link to="/litter-severity" className={btnGhost}>
                Litter severity
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </>
          }
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryChip
            icon={ShieldAlert}
            label="Event status"
            value={
              summary?.ok
                ? summary.eventDetected
                  ? "Detected"
                  : "Clear"
                : "—"
            }
            tone={summary?.eventDetected ? "amber" : "brand"}
          />
          <SummaryChip
            icon={Target}
            label="Max confidence"
            value={
              summary?.ok
                ? `${(summary.maxConfidence * 100).toFixed(1)}%`
                : "—"
            }
          />
          <SummaryChip
            icon={Users}
            label="Detections"
            value={summary?.ok ? summary.eventCount : "—"}
          />
          <SummaryChip
            icon={Zap}
            label="Inference"
            value={
              result?.inference_ms != null
                ? `${Math.round(result.inference_ms)} ms`
                : "—"
            }
            sub="last run"
          />
        </div>

        {error ? (
          <Banner
            tone="error"
            icon={AlertTriangle}
            title="Detection failed"
            body={error}
          />
        ) : null}

        {summary?.eventDetected ? (
          <Banner
            tone="warn"
            icon={AlertTriangle}
            title="Repeated littering may need extra bin capacity"
            body="A littering event was detected on this capture. If this location sees frequent events, register another bin nearby."
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

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <LitterModelWorkspace
              icon={ShieldAlert}
              title="Littering event workspace"
              badge="YOLO11 · best.pt"
              accent="orange"
              runLabel="Run detection"
              runningLabel="Detecting…"
              emptyHint="Drag & drop a camera frame"
              emptySub="Person/action near bin · JPEG, PNG, WebP"
              hasFile={Boolean(file)}
              imageUrl={imageUrl}
              onPickFile={pickFile}
              loading={loading}
              onRun={run}
              onReset={reset}
              previewExtra={previewExtra}
            />

            {summary?.ok ? (
              <Card glow={summary.eventDetected}>
                <Card.Header
                  icon={ShieldAlert}
                  accent={
                    summary.eventDetected ? "text-orange-400" : "text-brand-400"
                  }
                  title="Detection summary"
                />
                <Card.Body className="space-y-4">
                  <div
                    className={`rounded-xl border p-4 ${
                      summary.eventDetected
                        ? "border-orange-500/40 bg-orange-500/10 text-orange-100"
                        : "border-brand-500/30 bg-brand-500/10 text-brand-100"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                      Result
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {summary.eventDetected
                        ? "Littering event detected"
                        : "No littering event detected"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-6 text-sm">
                      <span>
                        Confidence:{" "}
                        <strong>
                          {(summary.maxConfidence * 100).toFixed(1)}%
                        </strong>
                      </span>
                      <span>
                        Boxes: <strong>{summary.detections.length}</strong>
                      </span>
                    </div>
                  </div>

                  {summary.detections.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-800/60">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Class</th>
                            <th className="px-3 py-2">Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.detections.map((d, i) => (
                            <tr
                              key={`${d.class_name}-${i}`}
                              className="border-t border-slate-800/40"
                            >
                              <td className="px-3 py-2 text-slate-500">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2 text-slate-200">
                                {d.class_name || d.label || "littering"}
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
                </Card.Body>
              </Card>
            ) : null}
          </div>

          <div className="space-y-5">
            <Card>
              <Card.Header icon={ShieldAlert} title="What this model detects" />
              <Card.Body className="space-y-3 text-sm leading-relaxed text-slate-400">
                <p>
                  Detects a <strong className="text-slate-200">littering action</strong>{" "}
                  — a person visibly throwing or leaving waste near a bin — not
                  individual litter objects on the ground.
                </p>
                <p>
                  Use{" "}
                  <Link
                    to="/litter-severity"
                    className="font-semibold text-brand-400 hover:underline"
                  >
                    Litter Severity (LSI)
                  </Link>{" "}
                  to score how much litter surrounds a bin (LOW / MEDIUM / HIGH).
                </p>
                <p className="text-xs text-slate-500">
                  Repeated events at one site appear on the main dashboard and
                  can recommend registering an additional bin.
                </p>
              </Card.Body>
              <Card.Footer>
                <Link
                  to="/alerts"
                  className="text-xs font-semibold text-brand-400 hover:underline"
                >
                  View litter alerts →
                </Link>
              </Card.Footer>
            </Card>

            {result?.model ? (
              <Card>
                <Card.Header icon={Zap} title="Model info" />
                <Card.Body className="space-y-2 text-sm text-slate-400">
                  <InfoRow label="Task" value={result.model?.task || "detect"} />
                  <InfoRow
                    label="Classes"
                    value={
                      Array.isArray(result.model?.class_names)
                        ? result.model.class_names.join(", ")
                        : "littering"
                    }
                  />
                  {result.inference_ms != null ? (
                    <InfoRow
                      label="Last inference"
                      value={`${Math.round(result.inference_ms)} ms`}
                    />
                  ) : null}
                </Card.Body>
              </Card>
            ) : null}
          </div>
        </div>
      </PageShell>
    </DashboardLayout>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-slate-800/40 py-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[12rem] truncate text-right font-medium text-slate-200">
        {value}
      </span>
    </div>
  );
}
