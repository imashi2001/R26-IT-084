/**
 * Dark monitoring card shell for the system dashboard.
 */

function Card({ children, className = "", glow = false }) {
  return (
    <div
      className={[
        "flex min-h-[220px] flex-col rounded-2xl border border-slate-700/60",
        "bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-950/95",
        "p-5 shadow-card backdrop-blur-sm transition-shadow",
        glow ? "shadow-glow-brand border-brand-500/25" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Header({ icon: Icon, title, accent = "text-brand-400", right = null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className={`h-4 w-4 ${accent}`} /> : null}
        <span className="text-sm font-semibold tracking-wide text-slate-200">
          {title}
        </span>
      </div>
      {right}
    </div>
  );
}

function Body({ children, className = "" }) {
  return <div className={`mt-3 flex-1 ${className}`}>{children}</div>;
}

function Footer({ children, className = "" }) {
  return (
    <div
      className={`mt-3 border-t border-slate-700/50 pt-3 text-xs text-slate-500 ${className}`}
    >
      {children}
    </div>
  );
}

Card.Header = Header;
Card.Body = Body;
Card.Footer = Footer;

export default Card;
