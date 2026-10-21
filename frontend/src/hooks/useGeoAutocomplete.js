import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "../utils/apiBase";

/**
 * Debounced Nominatim proxy suggestions for the public area search bar.
 */
export default function useGeoAutocomplete(query, { minLength = 2, debounceMs = 320 } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const clear = useCallback(() => {
    setSuggestions([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const q = (query || "").trim();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (q.length < minLength) {
      clear();
      return undefined;
    }

    timerRef.current = setTimeout(async () => {
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      try {
        const res = await fetch(
          apiUrl(`/geo/search?q=${encodeURIComponent(q)}`),
          { signal: ac.signal }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        const rows = (body.results || []).filter(
          (r) =>
            Number.isFinite(Number(r.latitude)) &&
            Number.isFinite(Number(r.longitude))
        );
        setSuggestions(rows.slice(0, 6));
      } catch (e) {
        if (e.name !== "AbortError") setSuggestions([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [query, minLength, debounceMs, clear]);

  return { suggestions, loading, clear };
}
