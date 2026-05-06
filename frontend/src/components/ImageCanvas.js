import React, { useRef, useEffect, useState, useCallback } from "react";
import "./ImageCanvas.css";

const CLASS_COLORS = {
  Empty: "#22c55e",
  Half: "#f59e0b",
  Overflow: "#ef4444",
};

const DEFAULT_COLOR = "#38bdf8";

function getColor(label) {
  return CLASS_COLORS[label] || DEFAULT_COLOR;
}

export default function ImageCanvas({ imageUrl, predictions }) {
  const canvasRef = useRef(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

  const draw = useCallback(
    (canvas, img) => {
      const ctx = canvas.getContext("2d");
      const displayW = canvas.width;
      const displayH = canvas.height;
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;

      ctx.clearRect(0, 0, displayW, displayH);
      ctx.drawImage(img, 0, 0, displayW, displayH);

      if (!predictions || predictions.length === 0) return;

      const scaleX = displayW / natW;
      const scaleY = displayH / natH;

      predictions.forEach(({ label, confidence, box }) => {
        const [x1, y1, x2, y2] = box;
        const sx = x1 * scaleX;
        const sy = y1 * scaleY;
        const sw = (x2 - x1) * scaleX;
        const sh = (y2 - y1) * scaleY;

        const color = getColor(label);

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(sx, sy, sw, sh);

        const text = `${label} ${(confidence * 100).toFixed(1)}%`;
        const fontSize = Math.max(12, Math.min(16, displayW / 40));
        ctx.font = `bold ${fontSize}px sans-serif`;

        const textW = ctx.measureText(text).width;
        const labelH = fontSize + 8;
        const labelY = sy > labelH ? sy - labelH : sy + sh;

        ctx.fillStyle = color;
        ctx.fillRect(sx - 1, labelY, textW + 10, labelH);

        ctx.fillStyle = "#fff";
        ctx.fillText(text, sx + 4, labelY + fontSize - 1);
      });
    },
    [predictions]
  );

  const handleImageLoad = useCallback(
    (e) => {
      const img = e.target;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      setNaturalSize({ w: natW, h: natH });

      const maxW = canvas.parentElement?.clientWidth || 760;
      const scale = Math.min(1, maxW / natW);
      canvas.width = Math.round(natW * scale);
      canvas.height = Math.round(natH * scale);

      draw(canvas, img);
    },
    [draw]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl || naturalSize.w === 0) return;
    const img = new Image();
    img.onload = () => draw(canvas, img);
    img.src = imageUrl;
  }, [predictions, imageUrl, naturalSize, draw]);

  return (
    <div className="canvas-wrapper">
      <img
        src={imageUrl}
        alt="uploaded"
        style={{ display: "none" }}
        onLoad={handleImageLoad}
      />
      <canvas ref={canvasRef} className="detection-canvas" />
    </div>
  );
}
