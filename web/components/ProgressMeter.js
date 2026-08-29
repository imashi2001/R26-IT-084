"use client";
export function ProgressMeter({ label, value, color = 'bg-emerald-400' }) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-white">{percent.toFixed(2)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-white/10">
        <div
          className={`h-full rounded-full ${color} shadow-[0_0_24px_rgba(52,211,153,0.45)] transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
