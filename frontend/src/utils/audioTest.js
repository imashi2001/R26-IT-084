/** Remote ESP32 DFPlayer audio (poll-based command queue). */

export const AUDIO_TEST_TIMEOUT_MS = 25_000;
export const AUDIO_TEST_POLL_MS = 1_500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCommand({ authFetch, commandId, onStatus, successMsg }) {
  const say = (msg) => {
    if (typeof onStatus === "function") onStatus(msg);
  };

  say("Waiting for ESP32...");
  const deadline = Date.now() + AUDIO_TEST_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(AUDIO_TEST_POLL_MS);
    const stRes = await authFetch(`/devices/commands/${commandId}`);
    const st = await stRes.json().catch(() => ({}));
    if (!stRes.ok) throw new Error(st.error || `HTTP ${stRes.status}`);

    if (st.status === "completed") {
      say(successMsg);
      return st;
    }
    if (st.status === "failed") {
      const msg = st.error_message || "Command failed.";
      if (String(msg).includes("cancelled: stop")) {
        say("Stopped.");
        return st;
      }
      throw new Error(msg);
    }
  }

  throw new Error("ESP32 did not respond.");
}

/**
 * Queue PLAY_AUDIO and poll until completed/failed/timeout.
 * @param {{ authFetch: Function, deviceId: number|string, track?: number, onStatus?: (msg: string) => void }} opts
 */
export async function runRemoteAudioTest({ authFetch, deviceId, track = 1, onStatus }) {
  const say = (msg) => {
    if (typeof onStatus === "function") onStatus(msg);
  };

  const trackNum = Number.isFinite(Number(track)) ? Math.trunc(Number(track)) : 1;
  const trackLabel = String(trackNum).padStart(4, "0");
  say(`Sending audio test (${trackLabel})…`);
  const res = await authFetch(`/devices/${deviceId}/audio-test`, {
    method: "POST",
    body: JSON.stringify({ track: trackNum }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

  const commandId = body.command_id;
  if (!commandId) throw new Error("No command_id returned from audio-test");

  return waitForCommand({
    authFetch,
    commandId,
    onStatus,
    successMsg: `Audio ${trackLabel} completed successfully.`,
  });
}

/**
 * Queue STOP_AUDIO (cancels pending play) and wait for ESP32 ACK.
 */
export async function runRemoteAudioStop({ authFetch, deviceId, onStatus }) {
  const say = (msg) => {
    if (typeof onStatus === "function") onStatus(msg);
  };

  say("Sending stop...");
  const res = await authFetch(`/devices/${deviceId}/audio-stop`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

  const commandId = body.command_id;
  if (!commandId) throw new Error("No command_id returned from audio-stop");

  return waitForCommand({
    authFetch,
    commandId,
    onStatus,
    successMsg: "Playback stopped.",
  });
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
