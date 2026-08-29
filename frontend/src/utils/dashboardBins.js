import { effectiveFillTier } from "./fillTier";

export function formatBinCode(id) {
  if (id == null) return "BIN—";
  const num = Number(id);
  if (!Number.isFinite(num)) return String(id);
  return `BIN-${String(num).padStart(2, "0")}`;
}

export function parseTs(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function relativeFromNow(iso) {
  const t = parseTs(iso);
  if (!t) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}h ago`;
  return `${Math.round(diff / 86400_000)}d ago`;
}

export function fillPercent(device) {
  const p = Number(device?.latest_fill_percentage);
  return Number.isFinite(p) ? Math.round(p) : null;
}

export function binStatusMeta(device) {
  const tier = effectiveFillTier(device);
  const pct = fillPercent(device);
  if (tier === "overflow" || (pct != null && pct >= 70)) {
    return { label: "Overflow", tone: "danger", tier };
  }
  if (tier === "half" || (pct != null && pct >= 40)) {
    return { label: "Near Full", tone: "warn", tier };
  }
  if (tier === "empty" || (pct != null && pct < 40)) {
    return { label: "Normal", tone: "ok", tier };
  }
  return { label: "Unknown", tone: "muted", tier: "unknown" };
}

export const STATUS_PILL = {
  ok: "border-brand-500/30 bg-brand-500/15 text-brand-400",
  warn: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  danger: "border-red-500/30 bg-red-500/15 text-red-400",
  muted: "border-slate-600/50 bg-slate-800/50 text-slate-400",
};

export function fillBarColor(pct) {
  if (pct == null) return "#475569";
  if (pct >= 70) return "#ef4444";
  if (pct >= 40) return "#f59e0b";
  return "#22c55e";
}

export function computeFleetStats(devices = []) {
  const list = Array.isArray(devices) ? devices : [];
  const active = list.filter(
    (d) => String(d.status || "").toLowerCase() === "active"
  ).length;
  const online = list.filter((d) => d.camera_online).length;
  const pcts = list
    .map((d) => fillPercent(d))
    .filter((p) => p != null);
  const avgFill =
    pcts.length > 0
      ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
      : null;
  const nearFull = list.filter((d) => {
    const s = binStatusMeta(d);
    return s.tone === "warn";
  }).length;
  const overflow = list.filter((d) => {
    const s = binStatusMeta(d);
    return s.tone === "danger";
  }).length;

  return {
    total: list.length,
    active,
    online,
    avgFill,
    nearFull,
    overflow,
  };
}

export function greetingForHour(h = new Date().getHours()) {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
