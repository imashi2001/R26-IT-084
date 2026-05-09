import React, { useState, useRef, useCallback } from "react";
import "./App.css";
import ImageCanvas from "./components/ImageCanvas";
import PredictionList from "./components/PredictionList";
import Esp32Panel from "./components/Esp32Panel";
import {
  getApiBaseUrl,
  getPredictUrl,
  isApiUrlPointingAtFrontend,
} from "./utils/apiBase";

const DEFAULT_ESP32_URL =
  process.env.REACT_APP_ESP32_CAPTURE_URL ||
  "http://10.134.126.191/capture";

export default function App() {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [esp32Loading, setEsp32Loading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [esp32Url, setEsp32Url] = useState(DEFAULT_ESP32_URL);
  const fileInputRef = useRef(null);

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
      if (!Array.isArray(data)) {
        throw new Error(
          "Unexpected API response. Expected a JSON array of detections."
        );
      }

      setPredictions(data);

      if (data.length === 0) {
        setError(
          "No objects detected. Try a clearer image or lower confidence threshold."
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
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span className="icon">🗑️</span> Garbage Fill Level Detector
        </h1>
        <p className="subtitle">
          Upload a garbage bin image to detect fill level using YOLOv8
        </p>
      </header>

      <main className="main">
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

            {error && !imageUrl && (
              <div className="error-banner" style={{ marginTop: "16px" }}>
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="workspace">
            <div className="canvas-section">
              <ImageCanvas imageUrl={imageUrl} predictions={predictions} />
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
      </main>
    </div>
  );
}
