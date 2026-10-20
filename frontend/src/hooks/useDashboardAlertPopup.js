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

/** Alerts newer than this on first load still pop up instead of being marked seen. */
const BOOTSTRAP_RECENT_MS = 2 * 60 * 1000;

/** Poll captures and surface new illegal-dumping / animal alerts as a popup queue. */
export default function useDashboardAlertPopup(pollMs = 10_000) {
  const { captures, dbDisabled, lastUpdated } = useCaptureHistory(pollMs);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    try {
      // Wait for the first real fetch: bootstrapping on the initial empty list
      // would treat every historical capture as new and queue them ahead of live alerts.
      if (lastUpdated == null) return;
      const popupAlerts = buildDashboardPopupAlerts(captures);
      if (!bootstrapped.current) {
        bootstrapped.current = true;
        const cutoff = Date.now() - BOOTSTRAP_RECENT_MS;
        markAllPopupSeen(
          popupAlerts
            .filter((a) => new Date(a.ts).getTime() < cutoff)
            .map((a) => a.id)
        );
      }
      if (dbDisabled || !popupAlerts.length) return;

      const seen = getPopupSeenIds();
      const fresh = popupAlerts.filter((a) => !seen.has(a.id));
      if (!fresh.length) return;

      setQueue((prev) => {
        const existing = new Set(prev.map((a) => a.id));
        const added = fresh.filter((a) => !existing.has(a.id));
        return added.length ? [...added, ...prev] : prev;
      });
    } catch (e) {
      console.warn("[useDashboardAlertPopup]", e);
    }
  }, [captures, dbDisabled, lastUpdated]);

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
