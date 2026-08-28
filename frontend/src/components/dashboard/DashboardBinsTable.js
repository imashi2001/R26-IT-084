import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Database, Search, Eye, ChevronRight } from "lucide-react";
import Card from "./Card";
import {
  binStatusMeta,
  fillBarColor,
  fillPercent,
  formatBinCode,
  relativeFromNow,
  STATUS_PILL,
} from "../../utils/dashboardBins";

const PAGE_SIZE = 6;

export default function DashboardBinsTable({
  devices,
  loading,
  dbDisabled,
  selectedId,
  onSelect,
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...(devices || [])];
    if (q) {
      list = list.filter((d) => {
        const hay = [
          d.name,
          d.location,
          d.esp32_id,
          formatBinCode(d.id),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      const ap = fillPercent(a) ?? -1;
      const bp = fillPercent(b) ?? -1;
      return bp - ap;
    });
    return list;
  }, [devices, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  return (
    <Card className="min-h-[420px]">
      <Card.Header
        icon={Database}
        title="All Bins Overview"
        right={
          <Link
            to="/bins"
            className="text-[11px] font-semibold text-brand-400 hover:text-brand-300"
          >
            Manage bins
          </Link>
        }
      />

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-950/50 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search bins, location, ESP32 ID…"
          className="w-full border-0 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
        />
      </div>

      <Card.Body className="mt-3 overflow-x-auto p-0">
        {dbDisabled ? (
          <div className="px-1 py-8 text-center text-sm text-slate-500">
            Enable DATABASE_URL to list registered bins.
          </div>
        ) : loading ? (
          <div className="px-1 py-8 text-center text-sm text-slate-500">
            Loading bins…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-1 py-8 text-center text-sm text-slate-500">
            No bins match your search.
          </div>
        ) : (
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800/80 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 font-semibold">Bin ID</th>
                <th className="px-3 py-2 font-semibold">Location</th>
                <th className="px-3 py-2 font-semibold">Fill Level</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Updated</th>
                <th className="px-3 py-2 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((d) => {
                const pct = fillPercent(d);
                const status = binStatusMeta(d);
                const selected = selectedId === d.id;
                return (
                  <tr
                    key={d.id}
                    onClick={() => onSelect?.(d.id)}
                    className={[
                      "cursor-pointer border-b border-slate-800/40 transition-colors",
                      selected
                        ? "bg-brand-500/10"
                        : "hover:bg-slate-800/40",
                    ].join(" ")}
                  >
                    <td className="px-3 py-3 font-semibold text-white">
                      {formatBinCode(d.id)}
                      {d.name ? (
                        <div className="text-[11px] font-normal text-slate-500">
                          {d.name}
                        </div>
                      ) : null}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-3 text-slate-400">
                      {d.location || d.address || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct ?? 0}%`,
                              backgroundColor: fillBarColor(pct),
                              boxShadow: `0 0 6px ${fillBarColor(pct)}66`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-300">
                          {pct != null ? `${pct}%` : "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_PILL[status.tone]}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {relativeFromNow(d.latest_captured_at)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        to={`/bins/${d.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 text-slate-400 hover:border-brand-500/40 hover:text-brand-400"
                        aria-label="View bin"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card.Body>

      {!dbDisabled && filtered.length > PAGE_SIZE ? (
        <Card.Footer>
          <div className="flex items-center justify-between">
            <span>
              Page {safePage + 1} of {totalPages} · {filtered.length} bins
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-slate-700/60 px-2 py-1 text-xs text-slate-400 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="rounded-lg border border-slate-700/60 px-2 py-1 text-xs text-slate-400 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </Card.Footer>
      ) : (
        <Card.Footer>
          {filtered.length
            ? `${filtered.length} bin${filtered.length === 1 ? "" : "s"} registered`
            : "Register bins from Bin Status or Settings"}
        </Card.Footer>
      )}
    </Card>
  );
}
