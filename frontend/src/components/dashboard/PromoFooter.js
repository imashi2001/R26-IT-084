import { useRef, useState } from "react";
import { Leaf, Trash2 } from "lucide-react";
import useDashboardSettings from "../../hooks/useDashboardSettings";

export default function PromoFooter() {
  const { promoUrl } = useDashboardSettings();
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = promoUrl && !imgFailed;

  return (
    <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-brand-500/25 shadow-card">
      <div className="relative h-28 overflow-hidden">
        {showImage ? (
          <img
            src={promoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2.5 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/20 backdrop-blur-sm">
            <Trash2 className="h-5 w-5 text-brand-400" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold leading-tight text-white drop-shadow-sm">
              Cleaner City,
            </div>
            <div className="text-xs font-bold leading-tight text-brand-400 drop-shadow-sm">
              Better Tomorrow
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
              <Leaf className="h-3 w-3 text-brand-500" />
              Smart waste for sustainable cities
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
