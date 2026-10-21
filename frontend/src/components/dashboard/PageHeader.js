import { PAGE } from "./dashboardTheme";

export default function PageHeader({ title, subtitle, actions = null, children = null }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className={PAGE.title}>{title}</h1>
        {subtitle ? <p className={PAGE.subtitle}>{subtitle}</p> : null}
        {children}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
