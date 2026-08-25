"use client";
export function StatCard({ label, value, detail, tone = 'emerald' }) {
  const tones = {
    emerald: 'from-emerald-400/20 to-teal-500/10 text-emerald-200 ring-emerald-300/20',
    amber: 'from-amber-400/20 to-orange-500/10 text-amber-200 ring-amber-300/20',
    cyan: 'from-cyan-400/20 to-sky-500/10 text-cyan-200 ring-cyan-300/20',
    violet: 'from-violet-400/20 to-fuchsia-500/10 text-violet-200 ring-violet-300/20',
  }

  return (
    <div className={`rounded-2xl bg-gradient-to-br p-4 ring-1 ${tones[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
      <p className={`mt-1 text-sm ${tones[tone].split(' ')[2]}`}>{detail}</p>
    </div>
  )
}
