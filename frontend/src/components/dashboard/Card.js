/**
 * Dark monitoring card shell — flex column, stretch-friendly for dashboard grids.
 */

function Card({ children, className = "", glow = false, compact = false }) {
  return (
    <div
      className={[
        "flex h-full min-h-0 flex-col rounded-2xl border border-slate-700/50",
        "bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95",
        "shadow-card backdrop-blur-sm transition-shadow",
        compact ? "p-4" : "p-4 md:p-5",
        glow ? "border-brand-500/25 shadow-glow-brand" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Header({
  icon: Icon,
  title,
  accent = "text-brand-400",
  right = null,
  subtitle = null,
}) {
  return (
    <div className="shrink-0 space-y-1">
      <div className="flex min-h-[1.75rem] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon ? (
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 ${accent}`}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <span className="truncate text-sm font-semibold tracking-wide text-slate-100">
            {title}
          </span>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {subtitle ? (
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

function Body({ children, className = "" }) {
  return (
    <div className={`mt-4 min-h-0 flex-1 ${className}`}>{children}</div>
  );
}

function Footer({ children, className = "" }) {
  if (children == null || children === false) return null;
  return (
    <div
      className={`mt-auto shrink-0 border-t border-slate-700/40 pt-3 text-xs text-slate-500 ${className}`}
    >
      {children}
    </div>
  );
}

Card.Header = Header;
Card.Body = Body;
Card.Footer = Footer;

export default Card;
