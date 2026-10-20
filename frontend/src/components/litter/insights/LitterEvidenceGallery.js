import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  FileDown,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  RefreshCw,
} from "lucide-react";
import { apiUrl } from "../../../utils/apiBase";
import { withAuthToken } from "../../../utils/authTransport";
import { formatLsi } from "../../../utils/litterSeverity";
import { formatDateTime } from "../../../utils/litterInsights";
import {
  fetchLitterEvidence,
  sendLitterFeedback,
  fetchCaptureImageDataUrl,
  apiErrorMessage,
} from "../../../utils/litterInsightsApi";
import { downloadEvidencePdf } from "../../../utils/litterEvidencePdf";
import {
  btnGhost,
  chipClass,
  chipActiveClass,
  riskBadgeClass,
  bannerTone,
} from "../../dashboard/dashboardUi";
import { emptyState } from "../../dashboard/dashboardTheme";

const TYPES = [
  { id: "littering", label: "Littering events" },
  { id: "high", label: "HIGH litter" },
  { id: "all", label: "All litter readings" },
];

const BOX_STROKE = { littering_action: "#f97316", litter: "#facc15" };
const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"];

function EvidenceImage({ item }) {
  const [size, setSize] = useState(null);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-44 items-center justify-center bg-slate-950/60 text-xs text-slate-500">
        Image unavailable
      </div>
    );
  }

  return (
    <div className="relative bg-slate-950/60">
      <img
        src={withAuthToken(apiUrl(item.image_path))}
        alt={`Capture ${item.capture_id}`}
        loading="lazy"
        className="block h-44 w-full object-contain"
        onLoad={(e) =>
          setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
        }
        onError={() => setFailed(true)}
      />
      {size ? (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {item.boxes.map((b, i) => (
            <rect
              key={i}
              x={b.box[0]}
              y={b.box[1]}
              width={Math.max(0, b.box[2] - b.box[0])}
              height={Math.max(0, b.box[3] - b.box[1])}
              fill="none"
              stroke={BOX_STROKE[b.model_type] || "#38bdf8"}
              strokeWidth={Math.max(2, size.w / 250)}
            />
          ))}
        </svg>
      ) : null}
    </div>
  );
}

function FeedbackRow({ item, onSaved }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const action = item.feedback?.action;
  const severity = item.feedback?.severity;

  const save = async (payload, key) => {
    setBusy(key);
    setError("");
    try {
      const fb = await sendLitterFeedback({ captureId: item.capture_id, ...payload });
      onSaved(item.capture_id, payload.model, fb);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not save review"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 border-t border-slate-800/60 pt-2">
      {item.littering.detected ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-500">Littering correct?</span>
          {[
            { verdict: "correct", Icon: ThumbsUp, label: "Yes" },
            { verdict: "incorrect", Icon: ThumbsDown, label: "False alarm" },
          ].map(({ verdict, Icon, label }) => (
            <button
              key={verdict}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => save({ model: "action", verdict }, `a-${verdict}`)}
              className={action?.verdict === verdict ? chipActiveClass : chipClass}
            >
              {busy === `a-${verdict}` ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Icon className="mr-1 h-3 w-3" />
              )}
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {item.litter.severity ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-500">Actual litter level:</span>
          {SEVERITY_OPTIONS.map((level) => (
            <button
              key={level}
              type="button"
              disabled={Boolean(busy)}
              onClick={() =>
                save({ model: "severity", correctedLabel: level }, `s-${level}`)
              }
              className={severity?.corrected_label === level ? chipActiveClass : chipClass}
            >
              {busy === `s-${level}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
              {level}
            </button>
          ))}
        </div>
      ) : null}
      {action || severity ? (
        <div className="inline-flex items-center gap-1 text-[10px] text-brand-300">
          <CheckCircle2 className="h-3 w-3" /> Reviewed
        </div>
      ) : null}
      {error ? <div className="text-[11px] text-red-300">{error}</div> : null}
    </div>
  );
}

function EvidenceCard({ item, onSaved }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/40">
      <EvidenceImage item={item} />
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">
              {item.bin_code}
              {item.bin_name ? (
                <span className="ml-1 font-normal text-slate-500">{item.bin_name}</span>
              ) : null}
            </div>
            <div className="text-[11px] text-slate-500">{formatDateTime(item.captured_at)}</div>
          </div>
          {item.litter.severity ? (
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskBadgeClass(item.litter.severity)}`}
            >
              {item.litter.severity} · {formatLsi(item.litter.lsi)}
            </span>
          ) : null}
        </div>
        {item.littering.detected ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span
              className={`rounded-full border px-2 py-0.5 font-semibold ${
                item.littering.confirmed
                  ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                  : "border-slate-600/50 bg-slate-800/50 text-slate-400"
              }`}
            >
              {item.littering.confirmed ? "Confirmed littering" : "Unconfirmed frame"}
            </span>
            <span className="text-slate-500">
              {(item.littering.max_confidence * 100).toFixed(0)}% ·{" "}
              {item.littering.episode_frames} frame
              {item.littering.episode_frames === 1 ? "" : "s"}
            </span>
          </div>
        ) : null}
        <FeedbackRow item={item} onSaved={onSaved} />
      </div>
    </div>
  );
}

export default function LitterEvidenceGallery({ days, deviceId, summary, onReviewed }) {
  const [type, setType] = useState("littering");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchLitterEvidence({ type, days, deviceId, limit: 24 });
      setItems(data.items || []);
    } catch (e) {
      setError(apiErrorMessage(e, "Could not load evidence"));
    } finally {
      setLoading(false);
    }
  }, [type, days, deviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSaved = useCallback(
    (captureId, model, fb) => {
      setItems((prev) =>
        prev.map((it) =>
          it.capture_id === captureId
            ? { ...it, feedback: { ...it.feedback, [model]: fb } }
            : it
        )
      );
      onReviewed?.();
    },
    [onReviewed]
  );

  const exportPdf = async () => {
    setExporting(true);
    setError("");
    try {
      await downloadEvidencePdf({
        items: items.slice(0, 12),
        summary,
        rangeLabel: `Last ${days} day(s) · ${TYPES.find((t) => t.id === type)?.label}`,
        fetchImage: fetchCaptureImageDataUrl,
      });
    } catch (e) {
      setError(apiErrorMessage(e, "PDF export failed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={type === t.id ? chipActiveClass : chipClass}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className={btnGhost} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportPdf}
            className={btnGhost}
            disabled={exporting || !items.length}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            Evidence PDF
          </button>
        </div>
      </div>

      {error ? (
        <div className={`rounded-xl border px-3 py-2 text-xs ${bannerTone("error")}`}>{error}</div>
      ) : null}

      {loading && !items.length ? (
        <div className="flex items-center justify-center py-10 text-xs text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading evidence…
        </div>
      ) : items.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <EvidenceCard key={item.capture_id} item={item} onSaved={onSaved} />
          ))}
        </div>
      ) : (
        <div className={emptyState}>
          <Camera className="mb-2 h-7 w-7 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">No captures to show</p>
          <p className="mt-1 text-xs text-slate-500">
            Nothing matched this filter in the last {days} day(s).
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Orange boxes: littering action · yellow boxes: litter objects. Reviews are saved as
        labelled samples for retraining. Images may show people — share the PDF only with
        authorised staff.
      </p>
    </div>
  );
}
