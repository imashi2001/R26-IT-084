import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  RefreshCw,
  AlertTriangle,
  Database,
  ChevronRight,
  Save,
  Loader2,
  ShieldAlert,
  Image as ImageIcon,
  MapPin,
  Clock,
} from "lucide-react";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import PageShell from "../components/dashboard/PageShell";
import PageHeader from "../components/dashboard/PageHeader";
import FilterBar, { FilterChipGroup } from "../components/dashboard/FilterBar";
import ListRow from "../components/dashboard/ListRow";
import EmptyState from "../components/dashboard/EmptyState";
import {
  btnGhost,
  btnSecondary,
  btnPrimary,
  inputClass,
  selectClass,
  labelClass,
  chipClass,
  chipActiveClass,
  bannerTone,
  summaryTone,
} from "../components/dashboard/dashboardUi";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../utils/apiBase";

/*
 * /alerts — Alerts & notifications (dashboard shell).
 *
 * Data comes from GET /alerts (requires JWT). The backend syncs missing rows
 * from recent captures (risk HIGH+, buzzer policy, overflow, animals) then
 * returns paginated alerts with device + capture context. Admins PATCH
 * /alerts/:id to move items through the workflow: open → acknowledged →
 * actioned / rejected / dismissed, plus an optional admin note.
 */

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "acknowledged", label: "Acknowledged" },
  { id: "actioned", label: "Actioned" },
  { id: "rejected", label: "Rejected" },
  { id: "dismissed", label: "Dismissed" },
];

const STATUS_OPTIONS = [
  { id: "open", label: "Open" },
  { id: "acknowledged", label: "Acknowledged" },
  { id: "actioned", label: "Action taken" },
  { id: "rejected", label: "Rejected / false alarm" },
  { id: "dismissed", label: "Dismissed" },
];

const TYPE_LABELS = {
  risk_critical: "Critical risk",
  risk_high: "High risk",
  buzzer: "Deterrence / buzzer",
  overflow: "Bin overflow",
  littering_detected: "Illegal dumping",
  litter_severity_high: "High litter severity",
  litter_add_bin: "Add a new bin",
  animal: "Animal detected",
};

function severityTone(sev) {
  switch ((sev || "").toLowerCase()) {
    case "critical":
      return "bg-red-500/10 text-red-300 border-red-500/30";
    case "warning":
      return "bg-amber-500/10 text-amber-300 border-amber-500/30";
    default:
      return "bg-slate-900/40 text-slate-300 border-slate-700/50";
  }
}

function statusTone(st) {
  switch ((st || "").toLowerCase()) {
    case "open":
      return "bg-red-500/10 text-red-300 border-red-500/30";
    case "acknowledged":
      return "bg-amber-500/10 text-amber-300 border-amber-500/30";
    case "actioned":
      return "bg-brand-500/10 text-brand-300 border-brand-500/30";
    case "rejected":
      return "bg-slate-900/40 text-slate-400 border-slate-700/50";
    case "dismissed":
      return "bg-slate-950/40 text-slate-500 border-slate-700/50";
    default:
      return "bg-slate-900/40 text-slate-500 border-slate-700/50";
  }
}

function formatTs(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
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

export default function AlertsNotificationsPage() {
  const { user, authFetch } = useAuth();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState("open");
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbDisabled, setDbDisabled] = useState(false);

  const [draftById, setDraftById] = useState({});
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDbDisabled(false);
    try {
      const qs = new URLSearchParams();
      if (tab && tab !== "all") qs.set("status", tab);
      qs.set("limit", "80");
      const path = `/alerts?${qs.toString()}`;
      const res = await authFetch(path, { method: "GET" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setDbDisabled(true);
        setAlerts([]);
        setTotal(0);
        setStatusCounts({});
        return;
      }
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setAlerts(Array.isArray(body.alerts) ? body.alerts : []);
      setTotal(Number(body.total) || 0);
      setStatusCounts(body.status_counts || {});
    } catch (e) {
      setError(e.message || "Could not load alerts.");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const openCount = statusCounts.open ?? 0;

  useEffect(() => {
    setDraftById((prev) => {
      const next = { ...prev };
      for (const a of alerts) {
        next[a.id] = { status: a.status, admin_note: a.admin_note || "" };
      }
      const ids = new Set(alerts.map((a) => a.id));
      for (const k of Object.keys(next)) {
        if (!ids.has(Number(k))) delete next[k];
      }
      return next;
    });
  }, [alerts]);

  const setDraft = (id, patch) => {
    setDraftById((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const saveAlert = async (alertId) => {
    const d = draftById[alertId];
    if (!d) return;
    setSavingId(alertId);
    setError(null);
    try {
      const res = await authFetch(`/alerts/${alertId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: d.status,
          admin_note: d.admin_note || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        throw new Error("Admin role required to update alert status.");
      }
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e.message || "Save failed.");
    } finally {
      setSavingId(null);
    }
  };

  const summaryChips = useMemo(
    () => [
      { label: "Open", value: statusCounts.open ?? 0, tone: "risk" },
      {
        label: "Acknowledged",
        value: statusCounts.acknowledged ?? 0,
        tone: "amber",
      },
      { label: "Actioned", value: statusCounts.actioned ?? 0, tone: "brand" },
      { label: "Rejected", value: statusCounts.rejected ?? 0, tone: "slate" },
      {
        label: "Dismissed",
        value: statusCounts.dismissed ?? 0,
        tone: "slate",
      },
    ],
    [statusCounts]
  );

  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader
          title="Alerts & notifications"
          subtitle={
            <>
              Every operational alert derived from captures (hygienic risk,
              deterrence threshold, overflow, and animal activity). Sync runs
              automatically when you open this page.{" "}
              <strong className="text-slate-300">Admins</strong> can change status
              and leave audit notes; other roles have read-only access.
            </>
          }
          actions={
            <>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className={btnSecondary}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Syncing…" : "Refresh"}
              </button>
              <Link to="/dashboard" className={btnGhost}>
                Dashboard
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </>
          }
        />

        {dbDisabled ? (
          <Banner
            icon={Database}
            title="Database not configured"
            body="Set DATABASE_URL on the backend and run with DB_SYNC=true (or DB_SYNC_ALTER=true) once so the alerts table is created. Until then, no alerts can be stored."
          />
        ) : null}

        {error ? (
          <Banner
            icon={AlertTriangle}
            title="Request error"
            body={error}
            tone="red"
          />
        ) : null}

        {!isAdmin ? (
          <Banner
            icon={ShieldAlert}
            title="Read-only"
            body="You can view every alert. Ask an admin to acknowledge, action, reject, or dismiss items."
            tone="amber"
          />
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {summaryChips.map((c) => (
            <SummaryChip key={c.label} {...c} />
          ))}
        </div>

        <FilterBar className="flex-col items-stretch gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={labelClass}>Filter by status</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {total} in view
            </span>
          </div>
          <FilterChipGroup>
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={tab === t.id ? chipActiveClass : chipClass}
              >
                {t.label}
                {t.id === "open" && openCount > 0 ? (
                  <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500/20 px-1 text-[10px]">
                    {openCount}
                  </span>
                ) : null}
              </button>
            ))}
          </FilterChipGroup>
        </FilterBar>

        {loading && !alerts.length ? (
          <ListSkeleton />
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No alerts yet"
            message="Alerts appear when captures exceed risk, fill, animal, or buzzer thresholds. Send a few /predict captures with the bridge or Bin Level Detector, then hit Refresh."
          />
        ) : (
          <ul className="space-y-4">
            {alerts.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                isAdmin={isAdmin}
                draft={draftById[a.id]}
                onDraftChange={setDraft}
                onSave={() => saveAlert(a.id)}
                saving={savingId === a.id}
              />
            ))}
          </ul>
        )}
      </PageShell>
    </DashboardLayout>
  );
}

function Banner({ icon: Icon, title, body, tone = "amber" }) {
  const toneKey = tone === "red" ? "error" : "warn";
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${bannerTone(toneKey)}`}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-sm">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function SummaryChip({ label, value, tone }) {
  const tones = {
    risk: summaryTone("risk"),
    amber: summaryTone("amber"),
    brand: summaryTone("brand"),
    slate: summaryTone("default"),
  };
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${tones[tone] || tones.slate}`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-4">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="animate-pulse rounded-xl border border-slate-700/50 bg-slate-950/40 p-5"
        >
          <div className="h-4 w-1/3 rounded bg-slate-700" />
          <div className="mt-3 h-3 w-full rounded bg-slate-800" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-800" />
        </li>
      ))}
    </ul>
  );
}

function AlertCard({
  alert: a,
  isAdmin,
  draft,
  onDraftChange,
  onSave,
  saving,
}) {
  const typeLabel =
    TYPE_LABELS[a.alert_type] ||
    a.alert_type?.replace(/_/g, " ") ||
    "Alert";
  const dev = a.device;
  const cap = a.capture;
  const img = captureThumbUrl(a.capture_id);

  return (
    <li>
      <ListRow className="overflow-hidden !p-0">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-stretch lg:p-5">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityTone(
                  a.severity
                )}`}
              >
                {a.severity}
              </span>
              <span className="rounded-full border border-slate-700/50 bg-slate-900/40 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                {typeLabel}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusTone(
                  a.status
                )}`}
              >
                {a.status}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" />
                {formatTs(a.created_at)}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100">{a.title}</h2>
            {a.summary ? (
              <p className="text-sm leading-relaxed text-slate-400">{a.summary}</p>
            ) : null}

            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              {dev ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <Link
                    to={`/bins/${dev.id}`}
                    className="font-semibold text-brand-400 hover:text-brand-300"
                  >
                    {dev.name}
                  </Link>
                  {dev.location ? <span>· {dev.location}</span> : null}
                </span>
              ) : (
                <span>Unbound device</span>
              )}
              {cap?.captured_at ? (
                <span>
                  Capture #{cap.id} · {formatTs(cap.captured_at)}
                  {dev?.id ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link
                        to={`/bins/${dev.id}`}
                        className="font-semibold text-brand-400 hover:text-brand-300"
                      >
                        Bin details
                      </Link>
                    </>
                  ) : null}
                </span>
              ) : null}
              {cap?.risk_level ? (
                <span>Risk {cap.risk_level}</span>
              ) : null}
              {cap?.animal_count != null ? (
                <span>{cap.animal_count} animal(s)</span>
              ) : null}
            </div>

            {a.admin_note ? (
              <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs text-slate-300">
                <span className="font-semibold text-slate-500">Admin note · </span>
                {a.admin_note}
              </div>
            ) : null}
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 border-t border-slate-700/50 pt-4 lg:w-72 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            {img ? (
              <div className="overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/40">
                <img
                  src={img}
                  alt=""
                  className="h-36 w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-700/50 bg-slate-950/40 text-slate-500">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}

            {isAdmin && draft ? (
              <div className="space-y-2 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Workflow status
                </label>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    onDraftChange(a.id, { status: e.target.value })
                  }
                  className={selectClass}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <label className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Admin note (audit trail)
                </label>
                <textarea
                  value={draft.admin_note}
                  onChange={(e) =>
                    onDraftChange(a.id, { admin_note: e.target.value })
                  }
                  rows={3}
                  placeholder="e.g. Crew dispatched 14:30 · bin emptied"
                  className={`${inputClass} resize-y text-xs`}
                />
                <button
                  type="button"
                  onClick={onSave}
                  disabled={
                    saving ||
                    (draft.status === a.status &&
                      (draft.admin_note || "") === (a.admin_note || ""))
                  }
                  className={`${btnPrimary} w-full disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save status
                    </>
                  )}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </ListRow>
    </li>
  );
}
