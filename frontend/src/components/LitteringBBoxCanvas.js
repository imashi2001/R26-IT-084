/**
 * Draw littering-event bounding boxes on a source image (canvas).
 */
import { useEffect, useRef } from "react";

export default function LitteringBBoxCanvas({ imageFile, detections, className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageFile) return undefined;

    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      const boxes = Array.isArray(detections) ? detections : [];
      boxes.forEach((d) => {
        const b = d.bbox || {};
        const x1 = Number(b.x1 ?? d.box?.[0] ?? 0);
        const y1 = Number(b.y1 ?? d.box?.[1] ?? 0);
        const x2 = Number(b.x2 ?? d.box?.[2] ?? 0);
        const y2 = Number(b.y2 ?? d.box?.[3] ?? 0);
        const label = d.class_name || d.label || "littering";
        const conf = Number(d.confidence) || 0;

        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = Math.max(2, Math.round(canvas.width / 400));
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        const caption = `${label} ${(conf * 100).toFixed(0)}%`;
        ctx.font = `${Math.max(12, Math.round(canvas.width / 50))}px sans-serif`;
        const tw = ctx.measureText(caption).width;
        ctx.fillStyle = "rgba(249,115,22,0.9)";
        ctx.fillRect(x1, Math.max(0, y1 - 20), tw + 8, 20);
        ctx.fillStyle = "#fff";
        ctx.fillText(caption, x1 + 4, Math.max(14, y1 - 6));
      });
    };
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [imageFile, detections]);

  if (!imageFile) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`mx-auto max-h-[70vh] w-full object-contain ${className}`}
      aria-label="Littering event detections overlay"
    />
  );
}
