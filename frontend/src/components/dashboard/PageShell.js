import { LAYOUT } from "./dashboardTheme";
import StatusBanner from "./StatusBanner";

export default function PageShell({ banner, children, className = "" }) {
  return (
    <div className={`${LAYOUT.page} ${className}`.trim()}>
      {banner ? <StatusBanner {...banner} /> : null}
      {children}
    </div>
  );
}
