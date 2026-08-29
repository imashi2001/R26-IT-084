function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        {children}
      </h2>
      <div className="h-px flex-1 bg-slate-800/80" />
    </div>
  );
}

export default function DashboardSection({ label, children, className = "" }) {
  return (
    <section className={`flex flex-col gap-4 ${className}`}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      {children}
    </section>
  );
}
