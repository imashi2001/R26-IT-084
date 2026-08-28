import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  AlertTriangle,
  PawPrint,
  Trash2,
  Smartphone,
  Leaf,
} from "lucide-react";
import Card from "../Card";
import { alertTone } from "../dashboardTheme";

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

  for (const c of captures) {
    const ts = c.captured_at;
    const binId =
      c.device_id != null ? `BIN-${String(c.device_id).padStart(2, "0")}` : "BIN—";

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
    <Card className="min-h-[320px]">
      <Card.Header
        icon={Bell}
        accent="text-amber-400"
        title="Recent Alerts"
        right={
          <Link
            to="/alerts"
            className="text-[11px] font-semibold text-brand-400 hover:text-brand-300"
          >
            View All
          </Link>
        }
      />

      <Card.Body>
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
