import {
  Bot,
  Layers,
  PackageOpen,
  PawPrint,
  ShieldAlert,
  Trash2,
  UserRoundX,
} from "lucide-react";
import { badge } from "./dashboardTheme";
import {
  buildCaptureModelResults,
  modelResultRows,
} from "../../utils/captureModelResults";

const ICONS = {
  waste: PackageOpen,
  fill: Layers,
  animal: PawPrint,
  litter_severity: Trash2,
  littering_action: UserRoundX,
};

const STATUS_CLASS = {
  ok: "border-brand-500/25 bg-brand-500/5",
  warn: "border-amber-500/25 bg-amber-500/5",
  danger: "border-red-500/25 bg-red-500/5",
  muted: "border-slate-700/50 bg-slate-950/40",
};

const STATUS_TEXT = {
  ok: "text-brand-400",
  warn: "text-amber-400",
  danger: "text-red-400",
  muted: "text-slate-500",
};

function ModelTile({ model }) {
  const Icon = ICONS[model.key] || Bot;
  const tone = model.status || "muted";
  return (
    <div
      className={`rounded-xl border p-3 ${STATUS_CLASS[tone] || STATUS_CLASS.muted}`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/60 ${STATUS_TEXT[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {model.title}
          </div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={`text-sm font-bold ${STATUS_TEXT[tone]}`}>
              {model.primary}
            </span>
            {model.secondary ? (
              <span className="text-xs font-semibold text-slate-400">
                {model.secondary}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            {model.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CaptureModelResultsPanel({ latest }) {
  const built = latest ? buildCaptureModelResults(latest) : null;
  const rows = modelResultRows(built);

  if (!built) {
    return (
      <p className="text-sm text-slate-500">
        No capture yet — model results will appear after the next ESP32 photo.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {built.modelsRun?.length ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="font-semibold uppercase tracking-wider">Models run</span>
          {built.modelsRun.map((name) => (
            <span key={name} className={badge.info}>
              {name.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((model) => (
          <ModelTile key={model.key} model={model} />
        ))}
      </div>

      {built.risk?.level ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
          <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
          <span>
            Combined risk:{" "}
            <span className="font-semibold text-slate-200">{built.risk.level}</span>
            {built.risk.case ? ` · case ${built.risk.case}` : ""}
          </span>
        </div>
      ) : null}
    </div>
  );
}
