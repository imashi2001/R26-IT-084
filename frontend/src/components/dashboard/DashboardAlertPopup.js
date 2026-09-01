import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  X,
  MapPin,
  Trash2,
  ShieldAlert,
  Clock,
  ExternalLink,
  Bell,
  ImageOff,
} from "lucide-react";
import { alertTone } from "./dashboardTheme";
import { apiUrl } from "../../utils/apiBase";
import { fillLabel } from "../../utils/fillTier";

function formatTs(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function captureThumbUrl(captureId) {
  if (!captureId) return null;
  try {
    return apiUrl(`/captures/${captureId}/image`);
  } catch {
    return null;
  }
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="font-semibold text-slate-100">{value || "—"}</div>
      </div>
    </div>
  );
}

export default function DashboardAlertPopup({
  alert,
  pendingCount = 0,
  onDismiss,
  onDismissAll,
}) {
  useEffect(() => {
    if (!alert) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onDismiss?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [alert, onDismiss]);

  if (!alert) return null;

  const tone = alertTone[alert.tone] || alertTone.warn;
  const Icon = alert.Icon;
  const thumb = captureThumbUrl(alert.captureId);
  const fillTxt =
    alert.fillPercentage != null
      ? `${Math.round(Number(alert.fillPercentage))}% · ${fillLabel(alert.fillLevel || alert.fillPercentage)}`
      : fillLabel(alert.fillLevel) || "—";

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      aria-labelledby="dashboard-alert-title"
      onClick={onDismiss}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`absolute inset-x-0 top-0 h-1 ${alert.kind === "animal" ? "bg-amber-500" : "bg-red-500"}`}
        />

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800/90 text-slate-400 transition hover:bg-slate-700 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-6 pt-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center">
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full text-white animate-pulse ${tone.ring}`}
            >
              <Icon className="h-8 w-8" strokeWidth={2.2} />
            </span>
          </div>

          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Security Alert
          </p>
          <h2
            id="dashboard-alert-title"
            className={`mt-1 font-display text-xl font-extrabold tracking-tight ${tone.fg}`}
          >
            {alert.title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{alert.summary}</p>
          {alert.detail ? (
            <p className="mt-0.5 text-xs font-medium text-slate-500">{alert.detail}</p>
          ) : null}
        </div>

        <div className="border-t border-slate-800 bg-slate-950/60 px-6 py-5">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Trash2 className="h-3.5 w-3.5" />
            Bin details
          </div>

          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/50">
              {thumb ? (
                <img
                  src={thumb}
                  alt="Capture from bin camera"
                  className="aspect-[4/3] h-full w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-slate-600">
                  <ImageOff className="h-8 w-8" />
                  <span className="text-[10px] font-medium">No image</span>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow icon={Trash2} label="Bin" value={alert.binName || alert.binId} />
              <DetailRow
                icon={MapPin}
                label="Location"
                value={alert.location || "—"}
              />
              <DetailRow icon={ShieldAlert} label="Fill level" value={fillTxt} />
              <DetailRow
                icon={Bell}
                label="Risk"
                value={String(alert.riskLevel || "LOW").toUpperCase()}
              />
              <DetailRow
                icon={Clock}
                label="Detected at"
                value={formatTs(alert.ts)}
              />
              {alert.kind === "animal" && alert.animalCount != null ? (
                <DetailRow
                  icon={Icon}
                  label="Animals"
                  value={String(alert.animalCount)}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-6 py-4">
          <div className="text-xs text-slate-500">
            {pendingCount > 1 ? `${pendingCount - 1} more alert(s) queued` : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingCount > 1 ? (
              <button
                type="button"
                onClick={onDismissAll}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                Dismiss all
              </button>
            ) : null}
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Dismiss
            </button>
            {alert.deviceId != null ? (
              <Link
                to={`/bins/${alert.deviceId}`}
                onClick={onDismiss}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-500"
              >
                View bin
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            ) : null}
            <Link
              to="/alerts"
              onClick={onDismiss}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/10 px-4 py-2 text-xs font-semibold text-brand-400 transition hover:bg-brand-500/20"
            >
              All alerts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
