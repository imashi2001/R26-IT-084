import { Inbox } from "lucide-react";
import { emptyState } from "./dashboardTheme";

export default function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  message,
  action = null,
}) {
  return (
    <div className={emptyState}>
      <Icon className="mb-3 h-10 w-10 text-slate-600" aria-hidden />
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      {message ? (
        <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
