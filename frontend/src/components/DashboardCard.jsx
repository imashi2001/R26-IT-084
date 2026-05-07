export function DashboardCard({ eyebrow, title, children, className = '' }) {
  return (
    <section
      className={`rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl transition duration-300 hover:border-emerald-300/30 hover:bg-white/[0.09] ${className}`}
    >
      {(eyebrow || title) && (
        <div className="mb-5">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
              {eyebrow}
            </p>
          )}
          {title && <h2 className="mt-2 text-xl font-bold text-white">{title}</h2>}
        </div>
      )}
      {children}
    </section>
  )
}
