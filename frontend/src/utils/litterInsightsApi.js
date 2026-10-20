/**
 * Backend calls for the Litter Insights page (/litter-insights/*).
 * The auth token is attached by authTransport's axios interceptor.
 */

import axios from "axios";
import { apiUrl } from "./apiBase";

export async function fetchLitterSummary({ days = 30, deviceId = null } = {}) {
  const params = new URLSearchParams({
    days: String(days),
    tz_offset: String(new Date().getTimezoneOffset()),
  });
  if (deviceId) params.set("device_id", String(deviceId));
  const { data } = await axios.get(apiUrl(`/litter-insights/summary?${params}`));
  return data;
}

export async function fetchLitterEvidence({
  type = "littering",
  days = 7,
  deviceId = null,
  limit = 24,
} = {}) {
  const params = new URLSearchParams({
    type,
    days: String(days),
    limit: String(limit),
  });
  if (deviceId) params.set("device_id", String(deviceId));
  const { data } = await axios.get(apiUrl(`/litter-insights/evidence?${params}`));
  return data;
}

/**
 * @param {{ captureId: number, model: "severity"|"action", verdict?: string, correctedLabel?: string, note?: string }} input
 */
export async function sendLitterFeedback({ captureId, model, verdict, correctedLabel, note }) {
  const { data } = await axios.post(apiUrl("/litter-insights/feedback"), {
    capture_id: captureId,
    model,
    verdict,
    corrected_label: correctedLabel,
    note,
  });
  return data.feedback;
}

export async function fetchFeedbackExport(days = 90) {
  const { data } = await axios.get(
    apiUrl(`/litter-insights/feedback/export?days=${days}`)
  );
  return data.feedback || [];
}

export async function fetchBinOutline(deviceId) {
  const { data } = await axios.get(apiUrl(`/litter-insights/outlines/${deviceId}`));
  return data.bin_polygon || null;
}

export async function saveBinOutline(deviceId, points) {
  const { data } = await axios.put(apiUrl(`/litter-insights/outlines/${deviceId}`), {
    points,
  });
  return data.bin_polygon;
}

export async function deleteBinOutline(deviceId) {
  await axios.delete(apiUrl(`/litter-insights/outlines/${deviceId}`));
}

/** Capture image as a data URL (via axios so the auth header is sent). */
export async function fetchCaptureImageDataUrl(capturePath) {
  const { data } = await axios.get(apiUrl(capturePath), { responseType: "blob" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(data);
  });
}

export function apiErrorMessage(e, fallback = "Request failed") {
  const msg = e?.response?.data?.error || e?.response?.data?.detail || e?.message || fallback;
  return typeof msg === "string" ? msg : JSON.stringify(msg);
}
