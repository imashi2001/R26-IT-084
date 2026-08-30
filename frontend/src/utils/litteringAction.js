/**
 * Normalize littering-action API payload for UI.
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
