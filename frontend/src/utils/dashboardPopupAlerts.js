import { AlertTriangle, PawPrint } from "lucide-react";
import { formatBinCode } from "./dashboardBins";

/**
 * Build popup-worthy alerts from captures (illegal dumping + animal detection only).
 */
export function buildDashboardPopupAlerts(captures) {
  const alerts = [];

  for (const c of captures || []) {
    if (!c?.id) continue;

    const binId = formatBinCode(c.device_id);
    const location =
      (c.location || c.device_location || c.address || "").trim() || null;
    const base = {
      captureId: c.id,
      deviceId: c.device_id,
      ts: c.captured_at,
      binId,
      binName: c.device_name || binId,
      location,
      fillLevel: c.fill_level,
      fillPercentage: c.fill_percentage,
      riskLevel: c.risk_level,
      wasteLabel: c.waste_label,
      sourceType: c.source_type,
    };

    if (Boolean(c.littering_event_detected)) {
      const count = Number(c.littering_event_count) || 0;
      const conf = Number(c.littering_max_confidence) || 0;
      alerts.push({
        ...base,
        id: `${c.id}-littering`,
        kind: "littering",
        title: "Illegal Dumping Detected",
        summary: `${count} dumping event${count === 1 ? "" : "s"} detected near this bin`,
        detail: `${(conf * 100).toFixed(0)}% model confidence`,
        Icon: AlertTriangle,
        tone: "warn",
      });
    }

    if ((Number(c.animal_count) || 0) > 0) {
      const count = Number(c.animal_count);
      alerts.push({
        ...base,
        id: `${c.id}-animal`,
        kind: "animal",
        title: "Animal Detected",
        summary: `${count} animal${count === 1 ? "" : "s"} spotted near this bin`,
        detail: `Risk level ${String(c.risk_level || "LOW").toUpperCase()}`,
        animalCount: count,
        Icon: PawPrint,
        tone: "warn",
      });
    }
  }

  return alerts.sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );
}

const SEEN_KEY = "vw_dashboard_popup_seen";

export function getPopupSeenIds() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function markPopupSeen(id) {
  const seen = getPopupSeenIds();
  seen.add(id);
  const trimmed = [...seen].slice(-300);
  sessionStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
}

export function markAllPopupSeen(ids) {
  const seen = getPopupSeenIds();
  ids.forEach((id) => seen.add(id));
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)));
}
