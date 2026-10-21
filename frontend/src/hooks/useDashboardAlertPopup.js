import { useCallback, useEffect, useRef, useState } from "react";
import useCaptureHistory from "./useCaptureHistory";
import useLitterPopupSettings from "./useLitterPopupSettings";
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

const LITTER_KINDS = new Set(["littering", "litter_add_bin", "litter_high"]);

function litterSettingsKey(s) {
  return [
    s.popup_illegal_dumping,
    s.popup_confirmed_only,
    s.popup_add_bin,
    s.popup_high_severity,
  ].join("|");
}

/** Poll captures and surface new illegal-dumping / animal alerts as a popup queue. */
export default function useDashboardAlertPopup(pollMs = 10_000) {
  const { captures, dbDisabled, lastUpdated } = useCaptureHistory(pollMs);
  const litterSettings = useLitterPopupSettings();
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const bootstrappedKey = useRef(null);

  useEffect(() => {
    try {
      // Wait for the first real fetch: bootstrapping on the initial empty list
      // would treat every historical capture as new and queue them ahead of live alerts.
      if (lastUpdated == null) return;
      const popupAlerts = buildDashboardPopupAlerts(captures, litterSettings);
      // Re-bootstrap when litter switches change so enabling a popup type
      // does not replay its whole history.
      const key = litterSettingsKey(litterSettings);
      if (bootstrappedKey.current !== key) {
        bootstrappedKey.current = key;
        const cutoff = Date.now() - BOOTSTRAP_RECENT_MS;
        markAllPopupSeen(
          popupAlerts
            .filter((a) => new Date(a.ts).getTime() < cutoff)
            .map((a) => a.id)
        );
      }
      const liveIds = new Set(popupAlerts.map((a) => a.id));
      const seen = getPopupSeenIds();
      const fresh = dbDisabled ? [] : popupAlerts.filter((a) => !seen.has(a.id));

      setQueue((prev) => {
        // Drop queued litter popups whose switch was turned off.
        const kept = prev.filter((a) => !LITTER_KINDS.has(a.kind) || liveIds.has(a.id));
        const existing = new Set(kept.map((a) => a.id));
        const added = fresh.filter((a) => !existing.has(a.id));
        if (!added.length && kept.length === prev.length) return prev;
        return [...added, ...kept];
      });
    } catch (e) {
      console.warn("[useDashboardAlertPopup]", e);
    }
  }, [captures, dbDisabled, lastUpdated, litterSettings]);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
    }
  }, [queue, current]);

  const lastPlayedRef = useRef(null);

  useEffect(() => {
    if (!current?.id || lastPlayedRef.current === current.id) return;
    lastPlayedRef.current = current.id;
    if (!current.silent) playDashboardAlertSound(current.kind);
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
