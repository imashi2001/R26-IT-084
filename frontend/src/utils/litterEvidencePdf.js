import { jsPDF } from "jspdf";
import { formatLsi } from "./litterSeverity";
import { describePeak, formatDateTime } from "./litterInsights";

const BOX_COLORS = { littering_action: "#f97316", litter: "#facc15" };
const MAX_IMAGE_PX = 900;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/** Re-draw the capture with model boxes so the PDF shows what the model saw. */
async function annotatedJpeg(dataUrl, boxes) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_IMAGE_PX / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  ctx.lineWidth = Math.max(2, canvas.width / 300);
  for (const b of boxes || []) {
    const [x1, y1, x2, y2] = b.box.map((v) => v * scale);
    ctx.strokeStyle = BOX_COLORS[b.model_type] || "#38bdf8";
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }
  return {
    data: canvas.toDataURL("image/jpeg", 0.82),
    ratio: canvas.height / canvas.width,
  };
}

function itemLines(item) {
  const lines = [
    `${item.bin_code}${item.bin_name ? ` · ${item.bin_name}` : ""}`,
    item.location || "",
    formatDateTime(item.captured_at),
  ];
  if (item.littering.detected) {
    lines.push(
      `Littering: ${item.littering.count} event(s), ${(item.littering.max_confidence * 100).toFixed(0)}% confidence`,
      item.littering.confirmed
        ? `Confirmed (${item.littering.episode_frames} frame${item.littering.episode_frames === 1 ? "" : "s"})`
        : "Single frame — not confirmed"
    );
  }
  if (item.litter.severity) {
    lines.push(`Litter severity: ${item.litter.severity} · LSI ${formatLsi(item.litter.lsi)} · ${item.litter.count} object(s)`);
  }
  const fb = item.feedback?.action || item.feedback?.severity;
  if (fb) lines.push(`Staff review: ${fb.verdict}`);
  return lines.filter(Boolean);
}

/**
 * @param {{ items: object[], summary?: object, rangeLabel: string, fetchImage: (path: string) => Promise<string> }} input
 */
export async function downloadEvidencePdf({ items, summary, rangeLabel, fetchImage }) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  pdf.setFontSize(16);
  pdf.text("Litter & littering evidence report", margin, y + 4);
  y += 11;
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  pdf.text(`Generated ${new Date().toLocaleString()} · ${rangeLabel}`, margin, y);
  y += 5;
  pdf.text("Contains camera images of people — share only with authorised staff.", margin, y);
  pdf.setTextColor(0);
  y += 7;

  const t = summary?.totals;
  if (t) {
    pdf.setFontSize(10);
    const summaryLines = [
      `Litter readings: ${t.captures_analyzed} · average LSI ${formatLsi(t.avg_lsi)} · HIGH ${t.high} (${t.high_share ?? 0}%)`,
      `Littering: ${t.littering_confirmed} confirmed episode(s) from ${t.littering_frames} frame(s) · ${t.littering_unconfirmed} unconfirmed`,
      `Bins needing action: ${t.bins_persistent} · rising: ${t.bins_rising} · verified cleanups: ${t.cleanups}`,
    ];
    const peak = describePeak(summary.peak);
    if (peak) summaryLines.push(`Peak littering time: ${peak}`);
    for (const line of summaryLines) {
      pdf.text(line, margin, y);
      y += 5;
    }
    y += 3;
  }

  const imgW = 82;
  for (const item of items) {
    let image = null;
    try {
      image = await annotatedJpeg(await fetchImage(item.image_path), item.boxes);
    } catch {
      image = null;
    }
    const imgH = image ? Math.min(70, imgW * image.ratio) : 0;
    const lines = itemLines(item);
    const blockH = Math.max(imgH, lines.length * 4.6) + 8;

    if (y + blockH > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
    if (image) pdf.addImage(image.data, "JPEG", margin, y, imgW, imgH);
    else {
      pdf.setFontSize(8);
      pdf.text("(image unavailable)", margin, y + 5);
    }

    const textX = margin + imgW + 6;
    pdf.setFontSize(9);
    lines.forEach((line, i) => {
      const wrapped = pdf.splitTextToSize(line, pageW - textX - margin);
      pdf.text(wrapped[0], textX, y + 4 + i * 4.6);
    });
    y += blockH;
    pdf.setDrawColor(220);
    pdf.line(margin, y - 4, pageW - margin, y - 4);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  pdf.save(`litter-evidence-${stamp}.pdf`);
}
