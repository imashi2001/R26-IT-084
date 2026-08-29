import { useMemo } from "react";
import useCaptureHistory from "./useCaptureHistory";
import { buildAlerts } from "../components/dashboard/cards/RecentAlertsCard";

/** Count actionable alerts (high/warn) from recent captures for nav badges. */
export default function useAlertBadgeCount() {
  const { captures, dbDisabled } = useCaptureHistory();
  return useMemo(() => {
    if (dbDisabled) return 0;
    return buildAlerts(captures).filter(
      (a) => a.tone === "high" || a.tone === "warn"
    ).length;
  }, [captures, dbDisabled]);
}
