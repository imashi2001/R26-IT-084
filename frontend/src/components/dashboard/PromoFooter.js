import { useEffect, useState } from "react";
import { Leaf, Trash2 } from "lucide-react";
import useDashboardSettings from "../../hooks/useDashboardSettings";

export default function PromoFooter({ compact = false }) {
  const { promoUrl } = useDashboardSettings();
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [promoUrl]);

  const showImage = Boolean(promoUrl) && !imgFailed;
  const heightClass = compact ? "h-36" : "h-44 sm:h-48";

  return (
    <div
      className={`overflow-hidden rounded-xl border border-brand-500/25 shadow-card ${
        compact ? "" : "mx-3 mb-3"
      }`}
    >
      <div className={`relative ${heightClass} overflow-hidden`}>
        {showImage ? (
          <img
            key={promoUrl}
            src={promoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-800/60 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-transparent to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 flex items-end gap-2.5 p-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/20 backdrop-blur-sm">
            <Trash2 className="h-5 w-5 text-brand-400" />
          </div>
          <div className="min-w-0 pb-0.5">
            <div className="text-sm font-bold leading-tight text-white drop-shadow-md">
              Cleaner City,
            </div>
            <div className="text-sm font-bold leading-tight text-brand-400 drop-shadow-md">
              Better Tomorrow
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-300/90">
              <Leaf className="h-3 w-3 text-brand-400" />
              Smart waste for sustainable cities
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
