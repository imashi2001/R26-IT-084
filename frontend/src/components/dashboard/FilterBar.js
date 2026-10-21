import { Search } from "lucide-react";
import { filterBar } from "./dashboardTheme";
import { inputClass, labelClass } from "./dashboardUi";

export default function FilterBar({ children, className = "" }) {
  return (
    <div className={`${filterBar} ${className}`.trim()}>{children}</div>
  );
}

export function FilterSearch({
  value,
  onChange,
  placeholder = "Search…",
  label = "Search",
  className = "",
}) {
  return (
    <label className={`min-w-[12rem] flex-1 ${className}`.trim()}>
      <span className={labelClass}>{label}</span>
      <div className="relative mt-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${inputClass} mt-0 pl-9`}
        />
      </div>
    </label>
  );
}

export function FilterChipGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <span className={labelClass}>{label}</span> : null}
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
