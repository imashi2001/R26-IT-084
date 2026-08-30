import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";

/**
 * Polls GET /devices?latest=1 for dashboard fleet overview.
 */
export default function useDevicesOverview(intervalMs = 60_000) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbDisabled, setDbDisabled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { data, status } = await axios.get(apiUrl("/devices"), {
        params: { latest: 1 },
        timeout: 10_000,
        validateStatus: (s) => s === 200 || s === 503,
      });
      if (status === 503) {
        setDbDisabled(true);
        setDevices([]);
        setError(null);
        return;
      }
      setDevices(Array.isArray(data?.devices) ? data.devices : []);
      setDbDisabled(false);
      setError(null);
    } catch (e) {
      setError(e?.message || "Could not load bins.");
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => clearInterval(t);
  }, [refresh, intervalMs]);

  return { devices, loading, error, dbDisabled, refresh };
}
