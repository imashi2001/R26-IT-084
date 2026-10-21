"use client";
import React from "react";

/**
 * LAN ESP32 snapshot loader. Works from http://localhost:3000 (dev).
 * On https:// deployed sites, http:// ESP32 URLs are blocked (mixed content);
 * use VisionWaste/bridge instead.
 */
export default function Esp32Panel({
  esp32Url,
  onEsp32UrlChange,
  onLoadFromEsp32,
  loading,
  mixedContentBlocked,
}) {
  return (
    <div className="esp32-panel">
      <h3 className="esp32-title">ESP32-CAM (same Wi‑Fi)</h3>
      <p className="esp32-help">
        Snapshot URL on your LAN, e.g.{" "}
        <code>http://10.134.126.191/capture</code>
      </p>
      {mixedContentBlocked && (
        <div className="esp32-warning" role="alert">
          This site is served over HTTPS. Browsers block loading{" "}
          <code>http://</code> camera URLs (mixed content). Use the{" "}
          <strong>VisionWaste bridge</strong> script on your laptop (
          <code>VisionWaste/bridge/</code>) or upload an image instead.
        </div>
      )}
      <div className="esp32-row">
        <input
          type="url"
          className="esp32-input"
          placeholder="http://10.134.126.191/capture"
          value={esp32Url}
          onChange={(e) => onEsp32UrlChange(e.target.value)}
          disabled={loading}
          aria-label="ESP32 snapshot URL"
        />
        <button
          type="button"
          className="btn btn-secondary esp32-btn"
          onClick={onLoadFromEsp32}
          disabled={loading || mixedContentBlocked || !esp32Url.trim()}
        >
          {loading ? "Loading…" : "Load from ESP32"}
        </button>
      </div>
    </div>
  );
}
