import { useCallback, useEffect, useRef, useState } from "react";
import useCaptureHistory from "./useCaptureHistory";
import {
  buildDashboardPopupAlerts,
  getPopupSeenIds,
  markAllPopupSeen,
  markPopupSeen,
} from "../utils/dashboardPopupAlerts";
import {
  playDashboardAlertSound,
  showDashboardBrowserNotification,
} from "../utils/alertSound";

/** Poll captures and surface new illegal-dumping / animal alerts as a popup queue. */
export default function useDashboardAlertPopup(pollMs = 30_000) {
  const { captures, dbDisabled } = useCaptureHistory(pollMs);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    try {
      const popupAlerts = buildDashboardPopupAlerts(captures);
      if (!bootstrapped.current) {
        markAllPopupSeen(popupAlerts.map((a) => a.id));
        bootstrapped.current = true;
        return;
      }
      if (dbDisabled || !popupAlerts.length) return;

      const seen = getPopupSeenIds();
      const fresh = popupAlerts.filter((a) => !seen.has(a.id));
      if (!fresh.length) return;

      setQueue((prev) => {
        const existing = new Set(prev.map((a) => a.id));
        const merged = [...prev];
        for (const alert of fresh) {
          if (!existing.has(alert.id)) merged.push(alert);
        }
        return merged;
      });
    } catch (e) {
      console.warn("[useDashboardAlertPopup]", e);
    }
  }, [captures, dbDisabled]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
    }
  }, [queue, current]);

  const lastPlayedRef = useRef(null);

  useEffect(() => {
    if (!current?.id || lastPlayedRef.current === current.id) return;
    lastPlayedRef.current = current.id;
    playDashboardAlertSound(current.kind);
    showDashboardBrowserNotification(current);
  }, [current]);

  const dismiss = useCallback(() => {
    if (!current) return;
    markPopupSeen(current.id);
    setQueue((prev) => prev.filter((a) => a.id !== current.id));
    setCurrent(null);
  }, [current]);

  const dismissAll = useCallback(() => {
    queue.forEach((a) => markPopupSeen(a.id));
    if (current) markPopupSeen(current.id);
    setQueue([]);
    setCurrent(null);
  }, [queue, current]);

  return {
    alert: current,
    pendingCount: queue.length,
    dismiss,
    dismissAll,
    dbDisabled,
  };
}
