import React, { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import ImageCanvas from "../components/ImageCanvas";
import PredictionList from "../components/PredictionList";
import Esp32Panel from "../components/Esp32Panel";
import LiveEsp32View from "../components/LiveEsp32View";
import {
  getApiBaseUrl,
  getPredictUrl,
  isApiUrlPointingAtFrontend,
  apiUrl,
} from "../utils/apiBase";
import { normalizeFill, effectiveFillTier, fillLabel } from "../utils/fillTier";

function detectionLabel(det) {
  if (det.label != null && String(det.label).trim()) return String(det.label).trim();
  if (det.class_name != null && String(det.class_name).trim())
    return String(det.class_name).trim();
  return "animal";
}

function detectionBox(det) {
  if (Array.isArray(det.box) && det.box.length >= 4) {
    return det.box.slice(0, 4).map((x) => Number(x));
  }
  if (Array.isArray(det.box_xyxy) && det.box_xyxy.length >= 4) {
    return det.box_xyxy.slice(0, 4).map((x) => Number(x));
  }
  return [0, 0, 0, 0];
}

function predictionsFromPredictResponse(data) {
  if (Array.isArray(data)) return data;
  const preds = [];
  const waste = data?.waste;
  if (waste && !waste.error && waste.label) {
    preds.push({
      label: `${waste.label}`,
      confidence: Number(waste.confidence) || 0,
      box: [8, 8, 92, 92],
    });
  }
  const animal = data?.animal;
  if (animal && !animal.error && Array.isArray(animal.detections)) {
    for (const det of animal.detections) {
      preds.push({
        label: detectionLabel(det),
        confidence: Number(det.confidence) || 0,
        box: detectionBox(det),
      });
    }
  }
  const binFill = data?.bin_fill;
  if (binFill && !binFill.error) {
    const fillList = Array.isArray(binFill.predictions)
      ? binFill.predictions
      : Array.isArray(binFill.detections)
        ? binFill.detections
        : [];
    for (const det of fillList) {
      preds.push({
        label:
          det.label != null && String(det.label).trim()
            ? String(det.label).trim()
            : "fill",
        confidence: Number(det.confidence) || 0,
        box: detectionBox(det),
      });
    }
  }
  const risk = data?.risk;
  if (risk?.level) {
    preds.push({
      label: `risk:${risk.level}`,
      confidence: 1,
      box: [0, 0, 0, 0],
    });
  }
  return preds;
}

const DEFAULT_ESP32_URL =
  process.env.REACT_APP_ESP32_CAPTURE_URL ||
  "http://10.134.126.191/capture";

export default function HomePage() {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [lastPredict, setLastPredict] = useState(null);
  const [loading, setLoading] = useState(false);
  const [esp32Loading, setEsp32Loading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [esp32Url, setEsp32Url] = useState(DEFAULT_ESP32_URL);
  const fileInputRef = useRef(null);

  const [binsSnapshot, setBinsSnapshot] = useState([]);
  const [binsSnapLoading, setBinsSnapLoading] = useState(false);
  const [binsSnapError, setBinsSnapError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBinsFill() {
      setBinsSnapLoading(true);
      setBinsSnapError(null);
      try {
        let url;
        try {
          url = apiUrl("/devices?latest=1");
        } catch {
          if (!cancelled) {
            setBinsSnapshot([]);
            setBinsSnapError(null);
          }
          return;
        }
        const res = await fetch(url);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setBinsSnapError(body.error || `HTTP ${res.status}`);
            setBinsSnapshot([]);
          }
          return;
        }
        if (!cancelled) {
          setBinsSnapshot(Array.isArray(body.devices) ? body.devices : []);
        }
      } catch (e) {
        if (!cancelled) {
          setBinsSnapError(e.message || "Could not load bins.");
          setBinsSnapshot([]);
        }
      } finally {
        if (!cancelled) setBinsSnapLoading(false);
      }
    }

    loadBinsFill();
    return () => {
      cancelled = true;
    };
  }, []);

  const mixedContentBlocked =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    esp32Url.trim().toLowerCase().startsWith("http:");

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    setImageFile(file);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setPredictions([]);
    setLastPredict(null);
    setError(null);
  }, []);

  const onFileChange = (e) => handleFile(e.target.files[0]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const loadFromEsp32 = async () => {
    const trimmed = esp32Url.trim();
    if (!trimmed) return;

    if (mixedContentBlocked) {
      setError(
        "HTTPS page cannot load HTTP ESP32 (mixed content). Use VisionWaste/bridge on your laptop or upload a file."
      );
      return;
    }

    setEsp32Loading(true);
    setError(null);

    try {
      const response = await fetch(trimmed);
      if (!response.ok) {
        throw new Error(`ESP32 returned HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const type = blob.type?.startsWith("image/") ? blob.type : "image/jpeg";
      const file = new File([blob], "capture.jpg", { type });
      handleFile(file);
    } catch (e) {
      setError(e.message || "Could not reach ESP32. Check URL and Wi‑Fi.");
    } finally {
      setEsp32Loading(false);
    }
  };

  const runPrediction = async () => {
    if (!imageFile) return;

    const predictUrl = getPredictUrl();
    const apiBase = getApiBaseUrl();

    if (predictUrl === null) {
      setError(
        "API URL missing for production. In Railway → Frontend service → Variables, set REACT_APP_API_URL to your backend URL (e.g. https://your-backend.up.railway.app) then redeploy."
      );
      return;
    }

    if (
      process.env.NODE_ENV === "production" &&
      apiBase &&
      isApiUrlPointingAtFrontend(apiBase)
    ) {
      setError(
        "REACT_APP_API_URL points to this frontend site. Set it to your backend Railway URL only, save variables, and redeploy the frontend."
      );
      return;
    }

    setLoading(true);
    setError(null);
    setPredictions([]);
    setLastPredict(null);

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const response = await fetch(predictUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = `Server error ${response.status}`;
        const ct = response.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          try {
            const errBody = await response.json();
            if (errBody && errBody.error) message = errBody.error;
          } catch {
            /* ignore */
          }
        } else if (response.status === 405) {
          message =
            "405 Method Not Allowed — the request hit the wrong server (often REACT_APP_API_URL points at the frontend URL, not the backend). Fix the variable and redeploy.";
        }
        throw new Error(message);
      }

      const data = await response.json();
      setLastPredict(data);
      const preds = predictionsFromPredictResponse(data);
      setPredictions(preds);

      if (preds.length === 0 && !data?.bin_fill_level) {
        setError(
          "No waste/animal/bin-fill/risk outputs returned. Check backend MODEL_YOLO_URL and other model services, then try another image."
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImageFile(null);
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPredictions([]);
    setLastPredict(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span className="icon">🗑️</span> Bin Level Detector
        </h1>
        <p className="subtitle">
          Upload an image (or pull from an ESP32-CAM) to run waste classification,
          animal detection, and bin fill-level detection — same models the live
          monitoring map uses behind the scenes.
        </p>
        <p className="subtitle dashboard-shortcut-row">
          <Link to="/live-monitoring" className="dashboard-shortcut-link">
            ← Back to Live Monitoring
          </Link>
          <span className="dashboard-shortcut-sep">·</span>
          <Link to="/hygienic-risk" className="dashboard-shortcut-link">
            Hygienic risk dashboard →
          </Link>
          <span className="dashboard-shortcut-sep">·</span>
          <Link to="/mobile-report" className="dashboard-shortcut-link">
            Phone camera report →
          </Link>
        </p>
        <p className="subtitle esp32-status-note">
          Primary monitoring: ESP32-CAM + laptop bridge. Manual fallback: phone report link above.
        </p>
      </header>

      <main className="main home-main">
        <div className="home-main-column">
          <section className="home-bins-overview" aria-label="Bins latest fill">
          <div className="home-bins-overview-head">
            <h2 className="home-bins-overview-title">Bins — latest fill</h2>
            <Link to="/map" className="home-bins-overview-maplink">
              Map →
            </Link>
          </div>
          {binsSnapLoading ? (
            <p className="home-bins-overview-muted">Loading bins…</p>
          ) : null}
          {binsSnapError ? (
            <p className="home-bins-overview-warn">{binsSnapError}</p>
          ) : null}
          {!binsSnapLoading && !binsSnapError && binsSnapshot.length === 0 ? (
            <p className="home-bins-overview-muted">
              No bins yet. Create bins in Admin, then send captures from the bridge or mobile report.
            </p>
          ) : null}
          {binsSnapshot.length > 0 ? (
            <ul className="home-bins-overview-list">
              {binsSnapshot.map((b) => {
                const tier = effectiveFillTier(b);
                const tierKey = normalizeFill(tier) || "unknown";
                const pct =
                  b.latest_fill_percentage != null &&
                  Number.isFinite(Number(b.latest_fill_percentage))
                    ? `${Math.round(Number(b.latest_fill_percentage))}%`
                    : "—";
                return (
                  <li key={b.id}>
                    <Link to={`/bins/${b.id}`} className="home-bins-overview-row">
                      <span className="home-bins-overview-name">{b.name}</span>
                      <span
                        className={`map-fill-badge map-fill-badge--sm map-fill-badge--${tierKey}`}
                      >
                        {fillLabel(tier === "unknown" ? "" : tier)}
                      </span>
                      <span className="home-bins-overview-pct">{pct}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>

          {!imageUrl ? (
          <div className="drop-zone-wrapper">
            <div
              className={`drop-zone ${dragOver ? "drag-over" : ""}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="drop-icon">📁</div>
              <p className="drop-text">Drag & drop an image here</p>
              <p className="drop-subtext">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                style={{ display: "none" }}
              />
            </div>

            <Esp32Panel
              esp32Url={esp32Url}
              onEsp32UrlChange={setEsp32Url}
              onLoadFromEsp32={loadFromEsp32}
              loading={esp32Loading}
              mixedContentBlocked={mixedContentBlocked}
            />

            <LiveEsp32View />

            {error && !imageUrl && (
              <div className="error-banner" style={{ marginTop: "16px" }}>
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="workspace">
            <div className="home-detection-panels">
              <div className="home-detection-panel">
                <div className="home-detection-panel-label">
                  Your image (waste + animal + bin-fill boxes drawn here)
                </div>
                <div className="canvas-section">
                  <ImageCanvas imageUrl={imageUrl} predictions={predictions} />
                </div>
              </div>
              {lastPredict?.animal &&
              !lastPredict.animal.error &&
              lastPredict.animal.annotated_image_base64 ? (
                <div className="home-detection-panel">
                  <div className="home-detection-panel-label">
                    Animal YOLO (server-rendered JPEG)
                  </div>
                  <img
                    className="home-yolo-annotated-img"
                    alt="Animal YOLO annotated detection"
                    src={`data:image/jpeg;base64,${lastPredict.animal.annotated_image_base64}`}
                  />
                  {lastPredict.animal.inference_imgsz != null ? (
                    <p className="home-detection-panel-meta">
                      Same scan as hygienic-risk dashboard · inference imgsz{" "}
                      {lastPredict.animal.inference_imgsz}
                      {typeof lastPredict.animal.detection_count === "number"
                        ? ` · ${lastPredict.animal.detection_count} detection(s)`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {lastPredict?.bin_fill &&
              !lastPredict.bin_fill.error &&
              lastPredict.bin_fill.annotated_image_base64 ? (
                <div className="home-detection-panel">
                  <div className="home-detection-panel-label">
                    Bin fill YOLO (server-rendered JPEG)
                  </div>
                  <img
                    className="home-yolo-annotated-img"
                    alt="Bin fill YOLO annotated"
                    src={`data:image/jpeg;base64,${lastPredict.bin_fill.annotated_image_base64}`}
                  />
                  {lastPredict.bin_fill_level ? (
                    <p className="home-detection-panel-meta">
                      Derived tier: {lastPredict.bin_fill_level}
                      {typeof lastPredict.bin_fill.detection_count === "number"
                        ? ` · ${lastPredict.bin_fill.detection_count} detection(s)`
                        : Array.isArray(lastPredict.bin_fill.predictions)
                          ? ` · ${lastPredict.bin_fill.predictions.length} detection(s)`
                          : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="controls">
              <button
                className="btn btn-primary"
                onClick={runPrediction}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Detecting...
                  </>
                ) : (
                  "Run Detection"
                )}
              </button>
              <button className="btn btn-secondary" onClick={reset}>
                Upload New Image
              </button>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {predictions.length > 0 && (
              <PredictionList predictions={predictions} />
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
