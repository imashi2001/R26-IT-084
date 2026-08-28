"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";

/*
 * useCaptureHistory
 * -----------------
 * Pulls the most recent N captures from `GET /captures?limit=100` and slices
 * them into client-side windows used by Row 2 (env sparklines) and Row 3
 * (risk trend chart, recent alerts).
 *
 * Refresh cadence: 2 minutes by default (history rarely changes fast).
 *
 * Return shape:
 *   {
 *     captures: Capture[],          // sorted DESC by captured_at
 *     last24h:  Capture[],          // ASC for chart axes
 *     last7d:   Capture[],          // ASC
 *     loading,  error,              // strings
 *     dbDisabled,                   // true when /captures returned 503
 *     refresh,
 *   }
 *
 * Each Capture has: { id, captured_at, waste_label, waste_confidence,
 *   animal_count, risk_level, risk_case, rotting_hours, temp_c, humidity_pct,
 *   weather_condition, fill_level, fill_percentage, source_type, device_id, ... }
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function parseTs(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function useCaptureHistory(intervalMs = 2 * 60 * 1000) {
  const [captures, setCaptures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbDisabled, setDbDisabled] = useState(false);

  const fetchOnce = useCallback(async () => {
    try {
      const { data } = await axios.get(apiUrl("/captures"), {
        params: { limit: 100 },
        timeout: 10_000,
      });
      const list = Array.isArray(data?.captures) ? data.captures : [];
      list.sort((a, b) => parseTs(b.captured_at) - parseTs(a.captured_at));
      setCaptures(list);
      setError(null);
      setDbDisabled(false);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 503) {
        setDbDisabled(true);
        setError(null);
        setCaptures([]);
      } else {
        setError(e?.message || "Failed to fetch /captures");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnce();
    const t = setInterval(fetchOnce, intervalMs);
    return () => clearInterval(t);
  }, [fetchOnce, intervalMs]);

  const slices = useMemo(() => {
    const now = Date.now();
    const asc = [...captures].sort(
      (a, b) => parseTs(a.captured_at) - parseTs(b.captured_at)
    );
    const last24h = asc.filter(
      (c) => now - parseTs(c.captured_at) <= DAY_MS
    );
    const last7d = asc.filter(
      (c) => now - parseTs(c.captured_at) <= 7 * DAY_MS
    );
    return { last24h, last7d };
  }, [captures]);

  return {
    captures,
    last24h: slices.last24h,
    last7d: slices.last7d,
    loading,
    error,
    dbDisabled,
    refresh: fetchOnce,
  };
}
