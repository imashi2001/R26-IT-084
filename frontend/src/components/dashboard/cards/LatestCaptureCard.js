import { Camera, Radio, ImageOff } from "lucide-react";
import Card from "../Card";

/*
 * Latest Capture (ESP32-CAM) card.
 *
 * - Uses the relative imageUrl from useSystemSnapshot so the CRA dev proxy
 *   forwards the GET to the Express /latest/image endpoint.
 * - Shows a green "Live" pill when stale === false (capture seen this poll).
 * - Falls back to a placeholder when there is no capture yet (404 case).
 */

function formatBinId(deviceId) {
  if (deviceId == null) return "BIN—";
  const num = Number(deviceId);
  if (!Number.isFinite(num)) return `BIN${deviceId}`;
  return `BIN${String(num).padStart(3, "0")}`;
}

function formatTimestamp(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
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

  return (
    <Card>
      <Card.Header
        icon={Camera}
        title="Latest Capture (ESP32-CAM)"
        right={
          hasImage && !stale ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              <Radio className="h-3 w-3" />
              Live
            </span>
          ) : hasImage ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Stale
            </span>
          ) : null
        }
      />

      <Card.Body className="flex flex-col gap-2">
        <div className="relative h-32 w-full overflow-hidden rounded-lg bg-slate-100">
          {hasImage ? (
            <img
              alt="latest capture"
              src={snapshot.imageUrl}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-400">
              <ImageOff className="h-6 w-6" />
              <span className="text-[11px]">No capture yet</span>
            </div>
          )}
        </div>
      </Card.Body>

      <Card.Footer>
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink-700">{binLabel}</span>
          <span>{timeLabel || "—"}</span>
        </div>
      </Card.Footer>
    </Card>
  );
}
