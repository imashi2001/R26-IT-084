import { AlertCircle, RefreshCw } from "lucide-react";
import { bannerTone, btnGhost } from "./dashboardUi";

export default function StatusBanner({
  tone = "info",
  text,
  onRetry,
  retryLabel = "Refresh",
  icon: Icon = AlertCircle,
}) {
  if (!text) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm backdrop-blur-sm ${bannerTone(tone)}`}
      role="status"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>{text}</span>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={btnGhost}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
