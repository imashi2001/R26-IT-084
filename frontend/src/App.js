import React, { useState, useRef, useCallback } from "react";
import "./App.css";
import ImageCanvas from "./components/ImageCanvas";
import PredictionList from "./components/PredictionList";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export default function App() {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
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

  const runPrediction = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    setPredictions([]);

    const formData = new FormData();
    formData.append("image", imageFile);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Server error ${response.status}`);
      }

      const data = await response.json();
      setPredictions(data);

      if (data.length === 0) {
        setError("No objects detected. Try a clearer image or lower confidence threshold.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImageFile(null);
    setImageUrl(null);
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
        <p className="subtitle">Upload a garbage bin image to detect fill level using YOLOv8</p>
      </header>

      <main className="main">
        {!imageUrl ? (
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
