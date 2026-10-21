import { listRow, listRowCompact } from "./dashboardTheme";

export default function ListRow({
  children,
  compact = false,
  className = "",
  onClick,
  as: Tag = onClick ? "button" : "div",
}) {
  const base = compact ? listRowCompact : listRow;
  const interactive = onClick
    ? " w-full cursor-pointer text-left hover:border-brand-500/30"
    : "";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`${base}${interactive} ${className}`.trim()}
    >
      {children}
    </Tag>
  );
}
