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
  Filter,
} from "lucide-react";

import DashboardLayout from "../components/dashboard/DashboardLayout";
import Card from "../components/dashboard/Card";
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
  animal: "Animal activity",
};

function severityTone(sev) {
  switch ((sev || "").toLowerCase()) {
    case "critical":
      return "bg-red-50 text-red-800 border-red-200";
    case "warning":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-ink-700 border-slate-200";
  }
}

function statusTone(st) {
  switch ((st || "").toLowerCase()) {
    case "open":
      return "bg-red-50 text-red-700 border-red-200";
    case "acknowledged":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "actioned":
      return "bg-brand-50 text-brand-800 border-brand-200";
    case "rejected":
      return "bg-slate-100 text-ink-600 border-slate-200";
    case "dismissed":
      return "bg-slate-50 text-ink-500 border-slate-200";
    default:
      return "bg-slate-100 text-ink-500 border-slate-200";
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
      <div className="space-y-6 p-4 lg:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">
              Alerts &amp; notifications
            </h1>
            <p className="mt-0.5 max-w-3xl text-sm text-ink-500">
              Every operational alert derived from captures (hygienic risk,
              deterrence threshold, overflow, and animal activity). Sync runs
              automatically when you open this page.{" "}
              <strong>Admins</strong> can change status and leave audit notes;
              other roles have read-only access.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Syncing…" : "Refresh"}
            </button>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-slate-50"
            >
              Dashboard
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

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

        <Card>
          <Card.Header
            icon={Filter}
            title="Filter by status"
            right={
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {total} in view
              </span>
            }
          />
          <Card.Body className="!mt-2">
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    tab === t.id
                      ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-ink-600 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                  {t.id === "open" && openCount > 0 ? (
                    <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-white/20 px-1 text-[10px]">
                      {openCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </Card.Body>
        </Card>

        {loading && !alerts.length ? (
          <ListSkeleton />
        ) : alerts.length === 0 ? (
          <Card>
            <Card.Body className="py-12 text-center text-sm text-ink-500">
              <Bell className="mx-auto h-10 w-10 text-ink-300" />
              <p className="mt-3 font-semibold text-ink-800">No alerts yet</p>
              <p className="mt-1 text-xs">
                Alerts appear when captures exceed risk, fill, animal, or
                buzzer thresholds. Send a few /predict captures with the bridge
                or Bin Level Detector, then hit <strong>Refresh</strong>.
              </p>
            </Card.Body>
          </Card>
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
      </div>
    </DashboardLayout>
  );
}

function Banner({ icon: Icon, title, body, tone = "amber" }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${tones[tone]}`}
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
    risk: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    brand: "border-brand-200 bg-brand-50 text-brand-800",
    slate: "border-slate-200 bg-slate-50 text-ink-700",
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
          className="animate-pulse rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
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
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityTone(
                  a.severity
                )}`}
              >
                {a.severity}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                {typeLabel}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusTone(
                  a.status
                )}`}
              >
                {a.status}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
                <Clock className="h-3 w-3" />
                {formatTs(a.created_at)}
              </span>
            </div>
            <h2 className="text-lg font-bold text-ink-900">{a.title}</h2>
            {a.summary ? (
              <p className="text-sm leading-relaxed text-ink-600">{a.summary}</p>
            ) : null}

            <div className="flex flex-wrap gap-3 text-xs text-ink-500">
              {dev ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <Link
                    to={`/bins/${dev.id}`}
                    className="font-semibold text-brand-700 hover:text-brand-600"
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
                        className="font-semibold text-brand-700 hover:text-brand-600"
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
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-ink-700">
                <span className="font-semibold text-ink-500">Admin note · </span>
                {a.admin_note}
              </div>
            ) : null}
          </div>

          <div className="flex w-full shrink-0 flex-col gap-3 border-t border-slate-100 pt-4 lg:w-72 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            {img ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <img
                  src={img}
                  alt=""
                  className="h-36 w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-ink-400">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}

            {isAdmin && draft ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Workflow status
                </label>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    onDraftChange(a.id, { status: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-medium text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <label className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Admin note (audit trail)
                </label>
                <textarea
                  value={draft.admin_note}
                  onChange={(e) =>
                    onDraftChange(a.id, { admin_note: e.target.value })
                  }
                  rows={3}
                  placeholder="e.g. Crew dispatched 14:30 · bin emptied"
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={onSave}
                  disabled={
                    saving ||
                    (draft.status === a.status &&
                      (draft.admin_note || "") === (a.admin_note || ""))
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
      </Card>
    </li>
  );
}
