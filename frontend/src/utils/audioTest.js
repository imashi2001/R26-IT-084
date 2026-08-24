/** Remote ESP32 DFPlayer audio test (poll-based command queue). */

export const AUDIO_TEST_TIMEOUT_MS = 25_000;
export const AUDIO_TEST_POLL_MS = 1_500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Queue PLAY_AUDIO and poll until completed/failed/timeout.
 * @param {{ authFetch: Function, deviceId: number|string, onStatus?: (msg: string) => void }} opts
 */
export async function runRemoteAudioTest({ authFetch, deviceId, onStatus }) {
  const say = (msg) => {
    if (typeof onStatus === "function") onStatus(msg);
  };

  say("Sending audio test...");
  const res = await authFetch(`/devices/${deviceId}/audio-test`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

  const commandId = body.command_id;
  if (!commandId) throw new Error("No command_id returned from audio-test");

  say("Waiting for ESP32...");
  const deadline = Date.now() + AUDIO_TEST_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(AUDIO_TEST_POLL_MS);
    const stRes = await authFetch(`/devices/commands/${commandId}`);
    const st = await stRes.json().catch(() => ({}));
    if (!stRes.ok) throw new Error(st.error || `HTTP ${stRes.status}`);

    if (st.status === "completed") {
      say("Audio test completed successfully.");
      return st;
    }
    if (st.status === "failed") {
      throw new Error(st.error_message || "Audio test failed.");
    }
  }

  throw new Error("ESP32 did not respond.");
}

/** Online if last_seen_at is within ~20s (matches backend camera_online). */
export function isCameraOnline(device, windowMs = 20_000) {
  if (device?.camera_online === true) return true;
  if (device?.camera_online === false) return false;
  const raw = device?.last_seen_at;
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= windowMs;
}

export function formatLastSeen(iso) {
  if (!iso) return "Never";
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return "—";
  return t.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
  });
}
