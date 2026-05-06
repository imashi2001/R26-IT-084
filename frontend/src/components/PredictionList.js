import React from "react";
import "./PredictionList.css";

const CLASS_COLORS = {
  Empty: "#22c55e",
  Half: "#f59e0b",
  Overflow: "#ef4444",
};

export default function PredictionList({ predictions }) {
  return (
    <div className="prediction-list">
      <h3 className="list-title">
        Detections <span className="count-badge">{predictions.length}</span>
      </h3>
      <div className="list-items">
        {predictions.map((p, i) => {
          const color = CLASS_COLORS[p.label] || "#38bdf8";
          const [x1, y1, x2, y2] = p.box;
          return (
            <div className="list-item" key={i} style={{ borderLeftColor: color }}>
              <div className="item-header">
                <span className="label-badge" style={{ background: color }}>
                  {p.label}
                </span>
                <span className="confidence">
                  {(p.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="item-coords">
                Box: [{Math.round(x1)}, {Math.round(y1)}, {Math.round(x2)},{" "}
                {Math.round(y2)}]
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
