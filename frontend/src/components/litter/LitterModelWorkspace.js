import { useRef, useState } from "react";
import {
  UploadCloud,
  Play,
  RotateCcw,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import Card from "../dashboard/Card";
import {
  btnPrimary,
  btnSecondary,
  labelClass,
} from "../dashboard/dashboardUi";

/**
 * Drag-drop upload + run/reset toolbar used by litter severity & littering-event pages.
 */
export default function LitterModelWorkspace({
  icon: HeaderIcon = ImageIcon,
  title,
  badge,
  accent = "brand",
  accept = "image/jpeg,image/png,image/webp",
  runLabel = "Run analysis",
  runningLabel = "Analyzing…",
  emptyHint = "Drop an image here or click to browse",
  emptySub = "JPEG, PNG, or WebP",
  hasFile,
  imageUrl,
  onPickFile,
  loading,
  onRun,
  onReset,
  disabledRun,
  children,
  previewExtra,
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const accentRing =
    accent === "orange"
      ? "border-orange-500/40 bg-orange-500/10 hover:border-orange-500/50"
      : "border-brand-500/40 bg-brand-500/10 hover:border-brand-500/40";

  const accentIcon =
    accent === "orange" ? "text-orange-400" : "text-brand-400";

  const pick = (next) => {
    if (!next || !next.type.startsWith("image/")) return;
    onPickFile(next);
  };

  return (
    <Card>
      <Card.Header
        icon={HeaderIcon}
        accent={accentIcon}
        title={title}
        right={
          badge ? (
            <span className="rounded-full border border-slate-700/50 bg-slate-900/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {badge}
            </span>
          ) : null
        }
      />

      <Card.Body className="space-y-4">
        {!hasFile ? (
          <div
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files[0]);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                fileInputRef.current?.click();
              }
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
              dragOver
                ? accentRing
                : "border-slate-700/50 bg-slate-950/40 hover:border-slate-600/60 hover:bg-slate-900/30"
            }`}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900/60 ring-1 ring-slate-700/50">
              <UploadCloud className={`h-7 w-7 ${accentIcon}`} />
            </div>
            <div className="text-sm font-semibold text-slate-100">{emptyHint}</div>
            <div className="text-xs text-slate-500">{emptySub}</div>
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={(e) => pick(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/40">
              <div className="border-b border-slate-700/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Source image
              </div>
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Upload preview"
                  className="block max-h-[360px] w-full object-contain"
                />
              ) : null}
            </div>
            {previewExtra || (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-700/50 bg-slate-950/30 px-6 py-10 text-center text-xs text-slate-500">
                Run analysis to see model output here.
              </div>
            )}
          </div>
        )}

        {children}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-4">
          <span className={labelClass}>Actions</span>
          <button
            type="button"
            disabled={!hasFile || loading || disabledRun}
            onClick={onRun}
            className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {runningLabel}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {runLabel}
              </>
            )}
          </button>
          <button
            type="button"
            disabled={!hasFile && !loading}
            onClick={onReset}
            className={btnSecondary}
          >
            <RotateCcw className="h-4 w-4" />
            Upload new
          </button>
        </div>
      </Card.Body>
    </Card>
  );
}

function SummaryChip({ icon: Icon, label, value, tone = "default", sub }) {
  const toneClass =
    tone === "brand"
      ? "border-brand-500/25 bg-brand-500/10 text-brand-300"
      : tone === "amber"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
        : tone === "red"
          ? "border-red-500/25 bg-red-500/10 text-red-300"
          : "border-slate-700/50 bg-slate-900/40 text-slate-300";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${toneClass}`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950/50 ring-1 ring-slate-700/40">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {label}
        </div>
        <div className="truncate text-lg font-bold tabular-nums">{value}</div>
        {sub ? (
          <div className="truncate text-[10px] opacity-70">{sub}</div>
        ) : null}
      </div>
    </div>
  );
}

export { SummaryChip };
