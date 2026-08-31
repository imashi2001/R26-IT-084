import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Trash2,
  Camera,
  BarChart3,
  History,
  Bell,
  ChevronRight,
  Wifi,
  Battery,
  AlertTriangle,
  MapPin,
  Clock,
} from "lucide-react";
import Card from "./Card";
import { apiUrl } from "../../utils/apiBase";
import {
  binStatusMeta,
  fillPercent,
  formatBinCode,
  relativeFromNow,
  STATUS_PILL,
} from "../../utils/dashboardBins";
import {
  ADD_BIN_STREAK,
  formatLsi,
  litterSeverityMeta,
} from "../../utils/litterSeverity";
import { buildAlerts } from "./cards/RecentAlertsCard";
import { alertTone } from "./dashboardTheme";

const TABS = [
  { id: "overview", label: "Overview", icon: Trash2 },
  { id: "live", label: "Live Feed", icon: Camera },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
  { id: "alerts", label: "Alerts", icon: Bell },
];

function MetaRow({ icon: Icon, label, value, valueClass = "text-slate-200" }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-800/40 py-2 last:border-0">
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
      <span className={`truncate text-right text-xs font-semibold ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function TabBar({ tab, setTab }) {
  return (
    <div className="mt-3 flex shrink-0 flex-wrap gap-1 border-b border-slate-800/60 pb-2">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          className={[
            "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
            tab === id
              ? "bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/25"
              : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300",
          ].join(" ")}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardBinDetail({ device, history }) {
  const [tab, setTab] = useState("overview");

  const binAlerts = useMemo(() => {
    if (!device?.id) return [];
    return buildAlerts(history || [])
      .filter((a) => a.binId === formatBinCode(device.id))
      .slice(0, 3);
  }, [device?.id, history]);

  if (!device) {
    return (
      <Card className="h-full">
        <Card.Header
          icon={Trash2}
          title="Bin Detail"
          subtitle="Select a row from the table"
        />
        <Card.Body className="flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800/60">
            <Trash2 className="h-8 w-8 text-slate-600" />
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Click any bin to preview fill level, live feed, and alerts.
          </p>
        </Card.Body>
      </Card>
    );
  }

  const pct = fillPercent(device);
  const status = binStatusMeta(device);
  const litter = litterSeverityMeta(device);
  const showAddBin =
    Boolean(device.litter_add_bin_recommended) ||
    (Number(device.litter_high_streak) || 0) >= ADD_BIN_STREAK;
  const imageUrl = `${apiUrl(`/devices/${device.id}/image/latest`)}?t=${encodeURIComponent(device.latest_captured_at || Date.now())}`;
  const online = device.camera_online;
  const zone = device.location || device.address || "—";
  const accent =
    status.tone === "danger"
      ? "text-red-400"
      : status.tone === "warn"
        ? "text-amber-400"
        : "text-brand-400";

  return (
    <Card className="h-full" glow={status.tone === "danger"}>
      <Card.Header
        icon={Trash2}
        accent={accent}
        title={`${formatBinCode(device.id)} · ${device.name || "Unnamed"}`}
        subtitle={zone}
        right={
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_PILL[status.tone]}`}
          >
            {status.label}
          </span>
        }
      />

      <TabBar tab={tab} setTab={setTab} />

      <Card.Body className="overflow-y-auto">
        <div className="space-y-4">
          {(tab === "overview" || tab === "live") && (
            <>
              <div className="rounded-xl border border-slate-800/50 bg-slate-950/30 p-4 text-center">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Fill Level
                </div>
                <div className={`mt-1 text-5xl font-bold tabular-nums ${accent}`}>
                  {pct != null ? `${pct}%` : "—"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/50 bg-slate-950/30 px-3 py-1">
                <MetaRow icon={MapPin} label="Zone" value={zone} />
                <MetaRow
                  icon={Clock}
                  label="Last Updated"
                  value={relativeFromNow(device.latest_captured_at)}
                />
                <MetaRow
                  icon={Trash2}
                  label="Litter severity"
                  value={litter.label}
                  valueClass={
                    litter.tone === "danger"
                      ? "text-red-400"
                      : litter.tone === "warn"
                        ? "text-amber-400"
                        : litter.tone === "ok"
                          ? "text-brand-400"
                          : "text-slate-500"
                  }
                />
                <MetaRow
                  icon={AlertTriangle}
                  label="LSI"
                  value={
                    device.latest_litter_lsi != null
                      ? `${formatLsi(device.latest_litter_lsi)} · ${device.latest_litter_detection_count ?? 0} obj`
                      : "—"
                  }
                />
                <MetaRow
                  icon={Bell}
                  label="Littering event"
                  value={
                    device.latest_littering_event_detected ? "Detected" : "None"
                  }
                  valueClass={
                    device.latest_littering_event_detected
                      ? "text-amber-400"
                      : "text-slate-500"
                  }
                />
                <MetaRow
                  icon={Wifi}
                  label="Device Status"
                  value={online ? "Online" : "Offline"}
                  valueClass={online ? "text-brand-400" : "text-slate-500"}
                />
                {device.esp32_id ? (
                  <MetaRow
                    icon={Battery}
                    label="ESP32 ID"
                    value={device.esp32_id}
                    valueClass="text-slate-300"
                  />
                ) : null}
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Live Feed
                </div>
                <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950">
                  {device.latest_captured_at ? (
                    <img
                      src={imageUrl}
                      alt={`${formatBinCode(device.id)} camera`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full min-h-[8rem] items-center justify-center text-sm text-slate-600">
                      No capture yet
                    </div>
                  )}
                  {online ? (
                    <span className="absolute left-2 top-2 rounded-full border border-brand-500/40 bg-brand-500/20 px-2 py-0.5 text-[10px] font-bold text-brand-400">
                      LIVE
                    </span>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {tab === "analytics" && (
            <div className="flex min-h-[10rem] items-center justify-center text-sm text-slate-500">
              <Link to="/reports" className="text-brand-400 hover:underline">
                Open Reports
              </Link>{" "}
              for analytics.
            </div>
          )}

          {tab === "history" && (
            <div className="flex min-h-[10rem] items-center justify-center text-sm text-slate-500">
              <Link
                to={`/bins/${device.id}`}
                className="text-brand-400 hover:underline"
              >
                View full history
              </Link>
            </div>
          )}

          {(tab === "overview" || tab === "alerts") && showAddBin && (
            <div
              className={`rounded-xl border px-3 py-2.5 ${alertTone.high.bg}`}
            >
              <div className={`text-xs font-semibold ${alertTone.high.fg}`}>
                Add a new bin at this location
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                HIGH litter around this bin continues on recent captures. Register
                another bin nearby.
              </p>
              <Link
                to="/bins"
                className="mt-2 inline-block text-xs font-semibold text-brand-400 hover:underline"
              >
                Register new bin →
              </Link>
            </div>
          )}

          {(tab === "overview" || tab === "alerts") && binAlerts.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Recent Alerts
              </div>
              <ul className="space-y-2">
                {binAlerts.map((a, i) => {
                  const tone = alertTone[a.tone] || alertTone.info;
                  return (
                    <li
                      key={`${a.title}-${i}`}
                      className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${tone.bg}`}
                    >
                      <AlertTriangle
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone.fg}`}
                      />
                      <div className="min-w-0">
                        <div className={`text-xs font-semibold ${tone.fg}`}>
                          {a.title}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">
                          {a.sub}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {tab === "alerts" && binAlerts.length === 0 && (
            <div className="flex min-h-[10rem] items-center justify-center text-sm text-slate-500">
              No recent alerts for this bin.
            </div>
          )}
        </div>
      </Card.Body>

      <Card.Footer>
        <Link
          to={`/bins/${device.id}`}
          className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-glow-brand hover:bg-brand-500"
        >
          View Full Details
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Card.Footer>
    </Card>
  );
}
