"use client";
/**
 * Shared card wrapper for the system dashboard.
 *
 * Exposes a tiny, opinionated layout that the row-1/row-2 cards compose:
 *   <Card>
 *     <Card.Header icon={Leaf} title="Waste Classification" />
 *     <Card.Body>...content...</Card.Body>
 *     <Card.Footer>secondary text</Card.Footer>
 *   </Card>
 *
 * Each card is identically padded so the dashboard reads as a clean grid.
 */

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-card flex flex-col min-h-[220px] ${className}`}
    >
      {children}
    </div>
  );
}

function Header({ icon: Icon, title, accent = "text-brand-600", right = null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className={`h-4 w-4 ${accent}`} /> : null}
        <span className="text-sm font-semibold text-ink-700">{title}</span>
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
      className={`mt-3 pt-3 border-t border-slate-100 text-xs text-ink-500 ${className}`}
    >
      {children}
    </div>
  );
}

Card.Header = Header;
Card.Body = Body;
Card.Footer = Footer;

export default Card;
