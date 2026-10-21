"use client";
import { useMemo } from "react";
import { Link } from "@/lib/react-router-compat";
import {
  Bell,
  AlertTriangle,
  PawPrint,
  Trash2,
  Smartphone,
  Leaf,
} from "lucide-react";
import Card from "../Card";

/*
 * Recent Alerts card.
 *
 * Synthesizes a feed from the captures history we already fetched. Each
 * alert is a derived event (one capture can produce multiple alerts):
 *
 *   risk_level === HIGH/CRITICAL          -> "High risk detected"
 *   animal_count > 0                       -> "Animal activity"
 *   bin_fill === Overflow OR pct >= 70     -> "Bin overflowing"
 *   source_type === "mobile"               -> "Mobile report received"
 *   waste_label === organic                -> "Organic waste detected"
 *   else                                   -> "Capture recorded" (low-noise)
 *
 * Last 6 alerts shown so the card height stays reasonable inside the grid.
 */

const ALERT_TONE = {
  high: { bg: "bg-red-50", fg: "text-red-700", icon: AlertTriangle, ring: "bg-red-500" },
  warn: { bg: "bg-amber-50", fg: "text-amber-700", icon: AlertTriangle, ring: "bg-amber-500" },
  info: { bg: "bg-sky-50", fg: "text-sky-700", icon: Bell, ring: "bg-sky-500" },
  ok: { bg: "bg-brand-50", fg: "text-brand-700", icon: Leaf, ring: "bg-brand-500" },
};

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
    const binId = c.device_id != null ? `BIN${String(c.device_id).padStart(3, "0")}` : "BIN—";

    const lvl = String(c.risk_level || "").toUpperCase();
    if (lvl === "HIGH" || lvl === "CRITICAL") {
      alerts.push({
        ts,
        binId,
        title: `${lvl === "CRITICAL" ? "Critical" : "High"} risk detected`,
        sub: `${binId} flagged ${lvl} (${c.risk_case || "rule fired"})`,
        Icon: AlertTriangle,
        tone: lvl === "CRITICAL" ? "high" : "warn",
      });
    }

    if ((c.animal_count || 0) > 0) {
      alerts.push({
        ts,
        binId,
        title: "Animal activity",
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
    if (overflowing) {
      alerts.push({
        ts,
        binId,
        title: "Bin overflowing",
        sub: `${binId} reached ${
          c.fill_percentage != null ? Math.round(c.fill_percentage) + "%" : "Overflow"
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
        sub: `${binId} - keep covered`,
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
        accent="text-amber-500"
        title="Recent Alerts"
        right={
          <Link
            to="/alerts"
            className="text-[11px] font-semibold text-brand-600 hover:underline"
          >
            View All
          </Link>
        }
      />

      <Card.Body>
        {dbDisabled ? (
          <div className="text-xs text-ink-500">
            DB off — alerts will appear once captures are persisted.
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-xs text-ink-500">
            No alert-worthy events in the last 100 captures.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => {
              const tone = ALERT_TONE[a.tone] || ALERT_TONE.info;
              const Icon = a.Icon || tone.icon;
              return (
                <li
                  key={`${a.ts || i}-${a.title}-${i}`}
                  className={`flex items-start gap-3 rounded-lg ${tone.bg} px-3 py-2`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.ring} text-white`}
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
                      <span className="shrink-0 text-[11px] text-ink-500">
                        {isoTime(a.ts)}
                      </span>
                    </div>
                    <div className="text-xs text-ink-500 truncate">{a.sub}</div>
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
