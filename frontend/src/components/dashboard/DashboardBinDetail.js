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
import { buildAlerts } from "./cards/RecentAlertsCard";
import { alertTone } from "./dashboardTheme";

const TABS = [
  { id: "overview", label: "Overview", icon: Trash2 },
  { id: "live", label: "Live Feed", icon: Camera },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
  { id: "alerts", label: "Alerts", icon: Bell },
];

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
      <Card className="min-h-[420px]">
        <Card.Header icon={Trash2} title="Bin Detail" />
        <Card.Body className="flex flex-col items-center justify-center py-16 text-center">
          <Trash2 className="h-10 w-10 text-slate-700" />
          <p className="mt-3 text-sm text-slate-500">
            Select a bin from the table to view details.
          </p>
        </Card.Body>
      </Card>
    );
  }

  const pct = fillPercent(device);
  const status = binStatusMeta(device);
  const imageUrl = `${apiUrl(`/devices/${device.id}/image/latest`)}?t=${encodeURIComponent(device.latest_captured_at || Date.now())}`;
  const online = device.camera_online;

  return (
    <Card className="min-h-[420px]" glow={status.tone === "danger"}>
      <Card.Header
        icon={Trash2}
        accent={
          status.tone === "danger"
            ? "text-red-400"
            : status.tone === "warn"
              ? "text-amber-400"
              : "text-brand-400"
        }
        title={`${formatBinCode(device.id)}${device.name ? ` · ${device.name}` : ""}`}
        right={
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_PILL[status.tone]}`}
          >
            {status.label}
          </span>
        }
      />

      <div className="mt-3 flex flex-wrap gap-1 border-b border-slate-800/80 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
              tab === id
                ? "bg-brand-500/15 text-brand-400"
                : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300",
            ].join(" ")}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      <Card.Body className="space-y-4">
        {tab === "overview" || tab === "live" ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-slate-500">Fill Level</div>
                <div
                  className={`text-4xl font-bold ${
                    status.tone === "danger"
                      ? "text-red-400"
                      : status.tone === "warn"
                        ? "text-amber-400"
                        : "text-brand-400"
                  }`}
                >
                  {pct != null ? `${pct}%` : "—"}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>{device.location || "No location set"}</div>
                <div className="mt-0.5">
                  Updated {relativeFromNow(device.latest_captured_at)}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>Live Feed</span>
                <span className="flex items-center gap-1">
                  <Wifi
                    className={`h-3 w-3 ${online ? "text-brand-400" : "text-slate-600"}`}
                  />
                  {online ? "Online" : "Offline"}
                </span>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/80">
                {device.latest_captured_at ? (
                  <img
                    src={imageUrl}
                    alt={`${formatBinCode(device.id)} latest capture`}
                    className="h-36 w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-36 items-center justify-center text-sm text-slate-600">
                    No capture yet
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Wifi
                  className={`h-3.5 w-3.5 ${online ? "text-brand-400" : "text-slate-600"}`}
                />
                Device: {online ? "Online" : "Offline"}
              </div>
              {device.esp32_id ? (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Battery className="h-3.5 w-3.5 text-brand-400" />
                  ESP32 · {device.esp32_id}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {tab === "analytics" ? (
          <div className="py-6 text-center text-sm text-slate-500">
            Open{" "}
            <Link to="/reports" className="text-brand-400 hover:underline">
              Reports
            </Link>{" "}
            for full analytics on this bin.
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="py-6 text-center text-sm text-slate-500">
            <Link
              to={`/bins/${device.id}`}
              className="text-brand-400 hover:underline"
            >
              View capture history
            </Link>{" "}
            on the bin detail page.
          </div>
        ) : null}

        {(tab === "overview" || tab === "alerts") && binAlerts.length > 0 ? (
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
                    <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone.fg}`} />
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
        ) : tab === "alerts" && binAlerts.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No recent alerts for this bin.
          </div>
        ) : null}
      </Card.Body>

      <Card.Footer>
        <Link
          to={`/bins/${device.id}`}
          className="inline-flex items-center gap-1 font-semibold text-brand-400 hover:text-brand-300"
        >
          View Full Details
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Card.Footer>
    </Card>
  );
}
