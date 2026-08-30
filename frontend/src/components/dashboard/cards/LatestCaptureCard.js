import { Camera, Radio, ImageOff } from "lucide-react";
import Card from "../Card";
import { badge } from "../dashboardTheme";

function formatBinId(deviceId) {
  if (deviceId == null) return "BIN—";
  const num = Number(deviceId);
  if (!Number.isFinite(num)) return String(deviceId);
  return `BIN-${String(num).padStart(2, "0")}`;
}

function formatTimestamp(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function LatestCaptureCard({ snapshot, stale }) {
  const hasImage = Boolean(snapshot?.imageUrl);
  const binLabel = formatBinId(snapshot?.deviceId);
  const timeLabel = formatTimestamp(snapshot?.timestamp);
  const litteringDetected = Boolean(snapshot?.extras?.littering_event_detected);

  return (
    <Card glow={hasImage && !stale}>
      <Card.Header
        icon={Camera}
        title="Live Capture"
        right={
          <div className="flex items-center gap-2">
            {litteringDetected ? (
              <span className="rounded-full border border-orange-500/40 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300">
                Littering
              </span>
            ) : null}
            {hasImage && !stale ? (
              <span className={badge.live}>
                <Radio className="h-3 w-3" />
                LIVE
              </span>
            ) : hasImage ? (
              <span className={badge.stale}>Stale</span>
            ) : null}
          </div>
        }
      />

      <Card.Body className="flex flex-col gap-2">
        <div className="relative h-36 w-full overflow-hidden rounded-xl border border-slate-700/50 bg-slate-950/80">
          {hasImage ? (
            <>
              <img
                alt="Live ESP32 capture"
                src={snapshot.imageUrl}
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                  ESP32-CAM
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-500">
              <ImageOff className="h-6 w-6" />
              <span className="text-[11px]">Waiting for capture…</span>
            </div>
          )}
        </div>
      </Card.Body>

      <Card.Footer>
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-medium text-slate-300">{binLabel}</span>
          <span>{timeLabel || "—"}</span>
        </div>
      </Card.Footer>
    </Card>
  );
}
