import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  AlertTriangle,
  PawPrint,
  Trash2,
  Smartphone,
  Leaf,
  MapPin,
} from "lucide-react";
import Card from "../Card";
import { alertTone } from "../dashboardTheme";
import { formatBinCode } from "../../../utils/dashboardBins";
import {
  ADD_BIN_STREAK,
  capturesForDevice,
  formatLsi,
  isHighSeverity,
  qualifiesForAddBinAlert,
} from "../../../utils/litterSeverity";

function isoTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function buildAlerts(captures) {
  const alerts = [];
  const addBinSeen = new Set();

  for (const c of captures) {
    const ts = c.captured_at;
    const binId =
      c.device_id != null ? formatBinCode(c.device_id) : "BIN—";
    const location =
      (c.location || c.device_location || c.address || "").trim() || null;

    const deviceHistory = capturesForDevice(captures, c.device_id);
    const addBinKey = c.device_id != null ? String(c.device_id) : binId;
    if (
      c.device_id != null &&
      qualifiesForAddBinAlert(deviceHistory) &&
      !addBinSeen.has(addBinKey)
    ) {
      addBinSeen.add(addBinKey);
      alerts.push({
        ts,
        binId,
        title: "Add a new bin at this location",
        sub: `${binId}${location ? ` · ${location}` : ""} — HIGH litter around the bin on ${ADD_BIN_STREAK} captures in a row`,
        Icon: MapPin,
        tone: "high",
      });
    }

    if (isHighSeverity(c.litter_severity)) {
      const lsi = formatLsi(c.litter_lsi);
      const count = Number(c.litter_detection_count) || 0;
      alerts.push({
        ts,
        binId,
        title: "High litter severity",
        sub: `${binId}${location ? ` · ${location}` : ""} · LSI ${lsi} · ${count} object${count === 1 ? "" : "s"}`,
        Icon: Trash2,
        tone: "high",
      });
    }

    if (Boolean(c.littering_event_detected)) {
      const count = Number(c.littering_event_count) || 0;
      const conf = Number(c.littering_max_confidence) || 0;
      alerts.push({
        ts,
        binId,
        title: "Illegal dumping detected",
        sub: `${binId}${location ? ` · ${location}` : ""} · ${count} event${count === 1 ? "" : "s"} (${(conf * 100).toFixed(0)}% conf)`,
        Icon: AlertTriangle,
        tone: "warn",
      });
    }

    const lvl = String(c.risk_level || "").toUpperCase();
    if (lvl === "HIGH" || lvl === "CRITICAL") {
      alerts.push({
        ts,
        binId,
        title:
          lvl === "CRITICAL"
            ? "Critical risk detected"
            : "High fill level detected",
        sub: `${binId} flagged ${lvl}${c.risk_case ? ` · ${c.risk_case}` : ""}`,
        Icon: AlertTriangle,
        tone: lvl === "CRITICAL" ? "high" : "warn",
      });
    }

    if ((c.animal_count || 0) > 0) {
      alerts.push({
        ts,
        binId,
        title: "Animal detected",
        sub: `${c.animal_count} animal${c.animal_count > 1 ? "s" : ""} near ${binId}`,
        Icon: PawPrint,
        tone: "warn",
      });
    }

    const fillTier = String(c.fill_level || "").toLowerCase();
    const overflowing =
      fillTier === "overflow" ||
      (Number.isFinite(Number(c.fill_percentage)) &&
        Number(c.fill_percentage) >= 70);
    if (overflowing && lvl !== "HIGH" && lvl !== "CRITICAL") {
      alerts.push({
        ts,
        binId,
        title: "Overflow risk",
        sub: `${binId} reached ${
          c.fill_percentage != null
            ? Math.round(c.fill_percentage) + "%"
            : "Overflow"
        }`,
        Icon: Trash2,
        tone: "high",
      });
    }

    if (String(c.source_type || "").toLowerCase() === "mobile") {
      alerts.push({
        ts,
        binId,
        title: "Mobile report received",
        sub: `Citizen submitted a capture for ${binId}`,
        Icon: Smartphone,
        tone: "info",
      });
    }

    if (
      String(c.waste_label || "").toLowerCase() === "organic" &&
      (c.animal_count || 0) === 0 &&
      lvl !== "HIGH" &&
      lvl !== "CRITICAL" &&
      !overflowing
    ) {
      alerts.push({
        ts,
        binId,
        title: "Organic waste detected",
        sub: `${binId} — keep covered`,
        Icon: Leaf,
        tone: "ok",
      });
    }
  }

  return alerts;
}

export default function RecentAlertsCard({ history, dbDisabled }) {
  const alerts = useMemo(
    () => buildAlerts(history || []).slice(0, 6),
    [history]
  );

  return (
    <Card className="h-full">
      <Card.Header
        icon={Bell}
        accent="text-amber-400"
        title="Recent Alerts"
        subtitle="Latest events across all bins"
        right={
          <Link
            to="/alerts"
            className="text-[11px] font-semibold text-brand-400 hover:text-brand-300"
          >
            View All
          </Link>
        }
      />

      <Card.Body className="overflow-y-auto">
        {dbDisabled ? (
          <div className="text-xs text-slate-500">
            DB off — alerts will appear once captures are persisted.
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-xs text-slate-500">
            No alert-worthy events in the last 100 captures.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => {
              const tone = alertTone[a.tone] || alertTone.info;
              const Icon = a.Icon || Bell;
              return (
                <li
                  key={`${a.ts || i}-${a.title}-${i}`}
                  className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${tone.bg}`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${tone.ring}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`flex items-center justify-between gap-2 ${tone.fg}`}
                    >
                      <span className="truncate text-sm font-semibold">
                        {a.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500">
                        {isoTime(a.ts)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {a.sub}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

/** Exported for sidebar badge count. */
export { buildAlerts };
