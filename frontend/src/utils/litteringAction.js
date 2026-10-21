/**
 * Normalize littering-action API payload for UI.
 *
 * Turns the raw /littering-action reply into the few fields the Littering
 * Detection page shows: was dumping seen, how many boxes, highest confidence
 * (0–1) and the boxes to draw. Missing numbers become 0 so the UI never shows NaN.
 */
export function summarizeLitteringAction(data) {
  if (!data || data.error) {
    return { ok: false, error: data?.error || "No result" };
  }
  return {
    ok: true,
    eventDetected: Boolean(data.event_detected),
    eventCount: Number(data.event_count) || 0,
    maxConfidence: Number(data.max_confidence) || 0,
    detections: Array.isArray(data.detections) ? data.detections : [],
  };
}
