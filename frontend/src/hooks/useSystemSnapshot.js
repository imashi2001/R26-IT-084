import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { apiUrl } from "../utils/apiBase";

/*
 * useSystemSnapshot
 * -----------------
 * Polls GET /latest on a fixed interval and exposes the parsed payload.
 *
 *   {
 *     data: SnapshotData | null,   // null while loading or when no capture yet
 *     loading: boolean,            // true on the very first fetch only
 *     error: string | null,        // populated on transport errors (NOT on 404)
 *     stale: boolean,              // true after a refresh fails AFTER first success
 *     refresh: () => void,
 *   }
 *
 * SnapshotData shape:
 *   {
 *     timestamp,        // ISO
 *     deviceId,         // number | null
 *     model,            // "waste+animal+bin_fill" | "waste" | ...
 *     predictions: [{ label, confidence, box }],  // mix of animal + bin_fill
 *     extras: {
 *       waste_label, waste_confidence,
 *       animal_count, risk_level, risk_case, rotting_hours,
 *       temp_c, humidity_pct, weather_condition,
 *       fill_percentage, prediction_class, source_type,
 *       latitude, longitude,
 *     },
 *     imageUrl,         // relative URL so it goes through the Vite dev proxy
 *   }
 *
 * 404 from /latest just means "no capture yet" - returned as data: null with
 * NO error so the cards can render an empty state instead of red text.
 *
 * Multiple cards on the dashboard call this hook independently for now (cheap;
 * payload is small). If we need to dedupe later we'll lift to context.
 */

const DEFAULT_INTERVAL_MS = 30_000;

const BIN_FILL_LABELS = new Set(["empty", "half", "overflow"]);

function isBinFillLabel(label) {
  return BIN_FILL_LABELS.has(String(label || "").trim().toLowerCase());
}

function isLitteringActionPrediction(p) {
  return (
    p?.model_type === "littering_action" ||
    String(p?.label || "").trim().toLowerCase() === "littering"
  );
}

/** Filter predictions[] into animal vs bin_fill subsets (label-based). */
export function partitionPredictions(predictions) {
  const animals = [];
  const binFill = [];
  for (const p of predictions || []) {
    if (isLitteringActionPrediction(p)) continue;
    if (isBinFillLabel(p.label)) {
      binFill.push(p);
    } else {
      animals.push(p);
    }
  }
  return { animals, binFill };
}

/** Best (highest-confidence) bin-fill prediction, or null. */
export function bestBinFill(predictions) {
  const { binFill } = partitionPredictions(predictions);
  if (!binFill.length) return null;
  return binFill.reduce((acc, cur) =>
    Number(cur.confidence) > Number(acc.confidence) ? cur : acc
  );
}

/** Map fill_percentage -> tier when no YOLO label is available (matches utils/fillTier.js). */
export function tierFromPercentage(pct) {
  const p = Number(pct);
  if (!Number.isFinite(p)) return null;
  if (p < 40) return "Empty";
  if (p < 70) return "Half";
  return "Overflow";
}

export default function useSystemSnapshot(intervalMs = DEFAULT_INTERVAL_MS) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  const hasSuccessRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    try {
      const { data: body } = await axios.get(apiUrl("/latest"), {
        timeout: 8000,
      });
      hasSuccessRef.current = true;
      setError(null);
      setStale(false);
      setData({
        timestamp: body.timestamp,
        deviceId: body.device_id ?? null,
        model: body.model,
        predictions: Array.isArray(body.predictions) ? body.predictions : [],
        extras: body.extras || {},
        // Use a relative URL so the Vite dev proxy serves it from the backend.
        // ?t= ensures the <img> reloads when timestamp changes.
        imageUrl: `${apiUrl("/latest/image")}?t=${encodeURIComponent(body.timestamp || "")}`,
        imageMimetype: body.image?.mimetype || "image/jpeg",
      });
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) {
        setError(null);
        if (!hasSuccessRef.current) setData(null);
        // If we'd seen success before, KEEP the previous data and mark stale.
        if (hasSuccessRef.current) setStale(true);
      } else {
        setError(e?.message || "Failed to fetch /latest");
        if (hasSuccessRef.current) setStale(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchOnce();
    const t = setInterval(() => {
      if (!cancelled) fetchOnce();
    }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [fetchOnce, intervalMs]);

  return { data, loading, error, stale, refresh: fetchOnce };
}
