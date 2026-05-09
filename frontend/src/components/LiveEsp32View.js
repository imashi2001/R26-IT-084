import React, { useCallback, useEffect, useMemo, useState } from "react";
import ImageCanvas from "./ImageCanvas";
import { apiUrl, getApiBaseUrl } from "../utils/apiBase";

const POLL_MS = 60_000;

const LIVE_DEVICE_ID = (process.env.REACT_APP_LIVE_DEVICE_ID || "").trim();

export default function LiveEsp32View() {
  const apiBase = getApiBaseUrl();

  const latestUrl = useMemo(() => {
    if (apiBase === null) return null;
    try {
      if (LIVE_DEVICE_ID) {
        return apiUrl(`/devices/${LIVE_DEVICE_ID}/latest`);
      }
      return apiBase === "" ? "/latest" : `${apiBase}/latest`;
    } catch {
      return null;
    }
  }, [apiBase]);

  const [imageUrl, setImageUrl] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [timestamp, setTimestamp] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadLatest = useCallback(async () => {
    if (!latestUrl) {
      setError(
        "Set REACT_APP_API_URL to your backend Railway URL and redeploy the frontend."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(latestUrl);
      if (res.status === 404) {
        setError(
          "No ESP32 capture yet. Start VisionWaste/bridge so the backend receives images."
        );
        setPredictions([]);
        setImageUrl(null);
        setTimestamp(null);
        return;
      }
      if (!res.ok) throw new Error(`Backend error ${res.status}`);

      const data = await res.json();

      if (LIVE_DEVICE_ID) {
        setPredictions(
          Array.isArray(data.latest?.predictions) ? data.latest.predictions : []
        );
        setTimestamp(data.latest?.captured_at || null);
        setImageUrl(data.latest?.image?.url || null);
      } else {
        setPredictions(Array.isArray(data.predictions) ? data.predictions : []);
        setTimestamp(data.timestamp || null);
        setImageUrl(data.image?.url || null);
      }
    } catch (e) {
      setError(e.message || "Failed to load latest capture.");
    } finally {
      setLoading(false);
    }
  }, [latestUrl]);

  useEffect(() => {
    loadLatest();
    const t = setInterval(loadLatest, POLL_MS);
    return () => clearInterval(t);
  }, [loadLatest]);

  return (
    <div className="live-esp32">
      <div className="live-esp32-header">
        <h3 className="live-esp32-title">
          Live ESP32 (last capture)
          {LIVE_DEVICE_ID ? (
            <span className="live-esp32-meta" style={{ marginLeft: 8 }}>
              device #{LIVE_DEVICE_ID}
            </span>
          ) : null}
        </h3>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={loadLatest}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {timestamp && (
        <div className="live-esp32-meta">Last captured: {timestamp}</div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {imageUrl ? (
        <div className="live-esp32-canvas">
          <ImageCanvas imageUrl={imageUrl} predictions={predictions} />
        </div>
      ) : (
        !error && <div className="live-esp32-empty">No image to display yet.</div>
      )}
    </div>
  );
}
