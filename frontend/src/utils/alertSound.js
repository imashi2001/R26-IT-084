/** Browser alert tones for dashboard security popups (no external files). */

let audioCtx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function unlockAlertAudio() {
  try {
    const ctx = getCtx();
    if (ctx?.state === "suspended") ctx.resume();
  } catch {
    /* ignore */
  }
}

function playTone(ctx, { freq, start, duration, volume = 0.28, type = "sine" }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

/**
 * Play an alert sound for illegal dumping or animal detection.
 * @param {'littering'|'animal'|string} kind
 */
export async function playDashboardAlertSound(kind = "littering") {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") await ctx.resume();

    const t = ctx.currentTime + 0.02;

    if (kind === "animal") {
      playTone(ctx, { freq: 740, start: t, duration: 0.18, type: "sine" });
      playTone(ctx, { freq: 988, start: t + 0.2, duration: 0.22, type: "sine" });
      playTone(ctx, { freq: 1175, start: t + 0.44, duration: 0.26, type: "triangle" });
      return;
    }

    // Illegal dumping — urgent triple beep
    playTone(ctx, { freq: 620, start: t, duration: 0.14, volume: 0.32, type: "square" });
    playTone(ctx, { freq: 620, start: t + 0.2, duration: 0.14, volume: 0.32, type: "square" });
    playTone(ctx, { freq: 880, start: t + 0.4, duration: 0.22, volume: 0.3, type: "triangle" });
  } catch (e) {
    console.warn("[alertSound]", e);
  }
}

/** Native OS notification when permission already granted. */
export function showDashboardBrowserNotification(alert) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted" || !alert) return;

  try {
    const body = [
      alert.binName || alert.binId,
      alert.location,
      alert.summary,
    ]
      .filter(Boolean)
      .join(" · ");

    const n = new Notification(alert.title || "VisionWaste Alert", {
      body,
      tag: alert.id,
      requireInteraction: true,
      icon: "/brand/vision-waste-logo.png",
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (e) {
    console.warn("[alertNotification]", e);
  }
}

/** Call once after user gesture if notifications are still default. */
export async function requestDashboardNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "default") {
    return Notification.permission === "granted";
  }
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}
