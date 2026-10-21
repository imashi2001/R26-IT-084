"use client";
import React, { useState } from "react";
import { Search, Trash2, Crosshair, Activity } from "lucide-react";
import { fillLabel, markerFillFromBin } from "../../utils/fillTier";

/*
 * Left-column list of bins, grouped into Active / Inactive sections.
 *
 *   - Click a row -> calls `onFocusBin(bin.id)` so the map flies to it and
 *     opens its popup.
 *   - "Details" button on each row jumps straight to the BinDetailsModal.
 *   - Free-text search filters by name / location / esp32_id.
 */

const RISK_TONE = {
  LOW: "text-brand-700 bg-brand-50",
  MEDIUM: "text-amber-700 bg-amber-50",
  HIGH: "text-red-700 bg-red-50",
  CRITICAL: "text-red-700 bg-red-100",
};

function formatTs(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 60 * 60_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 24 * 60 * 60_000) return `${Math.round(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function matches(query, bin) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    String(bin.name || "").toLowerCase().includes(q) ||
    String(bin.location || "").toLowerCase().includes(q) ||
    String(bin.address || "").toLowerCase().includes(q) ||
    String(bin.esp32_id || "").toLowerCase().includes(q)
  );
}

function BinRow({ bin, isNearest, onFocus, onSelect }) {
  const color = markerFillFromBin(bin);
  const fillPct =
    bin.latest_fill_percentage != null
      ? `${Math.round(bin.latest_fill_percentage)}%`
      : "—";
  const risk = bin.latest_risk_level || null;

  return (
    <li>
      <div
        className={`group flex items-center gap-3 rounded-xl border p-3 transition cursor-pointer ${
          isNearest
            ? "border-brand-300 bg-brand-50/50 hover:bg-brand-50"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
        }`}
        onClick={() => onFocus(bin.id)}
      >
        <span
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-2 ring-white"
          style={{ backgroundColor: `${color}26` }}
        >
          <Trash2 className="h-4 w-4" style={{ color }} />
          {isNearest ? (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 ring-2 ring-white">
              <Crosshair className="h-2.5 w-2.5 text-white" />
            </span>
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-900 truncate">
              {bin.name || `BIN${bin.id}`}
            </span>
            {risk ? (
              <span
                className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                  RISK_TONE[risk] || "text-ink-500 bg-slate-100"
                }`}
              >
                {risk}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
            <span className="truncate">
              {bin.location || bin.address || "—"}
            </span>
            <span>·</span>
            <span className="shrink-0">
              {fillLabel(bin.latest_fill_level)} · {fillPct}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-ink-400">
            Updated {formatTs(bin.latest_captured_at)}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(bin);
          }}
          className="opacity-0 group-hover:opacity-100 transition shrink-0 inline-flex items-center gap-1 rounded-md bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-600"
          aria-label={`Open details for ${bin.name}`}
        >
          <Activity className="h-3 w-3" />
          Details
        </button>
      </div>
    </li>
  );
}

export default function BinListPanel({
  activeBins,
  inactiveBins,
  nearestBinId,
  onFocusBin,
  onSelectBin,
  className = "",
}) {
  const [query, setQuery] = useState("");

  const activeFiltered = activeBins.filter((b) => matches(query, b));
  const inactiveFiltered = inactiveBins.filter((b) => matches(query, b));

  return (
    <aside
      className={`flex flex-col rounded-xl border border-slate-200 bg-white ${className}`}
    >
      <div className="px-4 pt-4">
        <h2 className="text-sm font-semibold text-ink-900">Registered Bins</h2>
        <p className="text-[11px] text-ink-500 mt-0.5">
          {activeBins.length} active · {inactiveBins.length} inactive
        </p>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, location, ESP32 id…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Active
            </span>
            <span className="text-[10px] text-ink-400">
              {activeFiltered.length}
            </span>
          </div>

          {activeFiltered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-ink-500">
              {query
                ? "No active bins match your search."
                : "No active bins yet. Send a capture from the bridge or upload via Bin Level Detector."}
            </div>
          ) : (
            <ul className="space-y-2">
              {activeFiltered.map((bin) => (
                <BinRow
                  key={bin.id}
                  bin={bin}
                  isNearest={bin.id === nearestBinId}
                  onFocus={onFocusBin}
                  onSelect={onSelectBin}
                />
              ))}
            </ul>
          )}
        </div>

        {inactiveFiltered.length > 0 ? (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                Inactive
              </span>
              <span className="text-[10px] text-ink-400">
                {inactiveFiltered.length}
              </span>
            </div>
            <ul className="space-y-2">
              {inactiveFiltered.map((bin) => (
                <BinRow
                  key={bin.id}
                  bin={bin}
                  isNearest={false}
                  onFocus={onFocusBin}
                  onSelect={onSelectBin}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
