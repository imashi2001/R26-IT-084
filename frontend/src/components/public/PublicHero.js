import { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import useGeoAutocomplete from "../../hooks/useGeoAutocomplete";
import { POPULAR_AREAS } from "../../utils/publicBinStatus";
import { BRAND } from "../BrandLogo";

const HERO_VIDEO = "/videos/hero-bg.mov";
const HERO_POSTER = BRAND.heroDefault;

export default function PublicHero({
  query,
  setQuery,
  busy,
  error,
  searchedLabel,
  onSearch,
  onSelectSuggestion,
  onChip,
  onUseLocation,
}) {
  const { suggestions, loading: suggestLoading, clear } = useGeoAutocomplete(query);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpenSuggest(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setActiveIdx(-1);
  }, [suggestions]);

  const showDropdown =
    openSuggest && query.trim().length >= 2 && (suggestions.length > 0 || suggestLoading);

  function pickSuggestion(hit) {
    clear();
    setOpenSuggest(false);
    onSelectSuggestion(hit);
  }

  function onKeyDown(e) {
    if (!showDropdown || !suggestions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpenSuggest(false);
    }
  }

  return (
    <section id="home" className="relative isolate min-h-[92vh] overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster={HERO_POSTER}
      >
        <source src={HERO_VIDEO} type="video/quicktime" />
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(2,6,23,0.72) 0%, rgba(27,94,32,0.35) 42%, rgba(2,6,23,0.82) 100%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6 lg:py-24">
        <p className="animate-fade-up text-xs font-bold uppercase tracking-[0.28em] text-emerald-200/90 sm:text-sm">
          {BRAND.tagline}
        </p>
        <h1
          className="animate-fade-up mt-4 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.35rem]"
          style={{ animationDelay: "60ms" }}
        >
          Find the nearest bin in your area
        </h1>
        <p
          className="animate-fade-up mt-4 max-w-2xl text-base text-white/88 sm:text-lg"
          style={{ animationDelay: "120ms" }}
        >
          Search a city or neighbourhood, then we rank nearby smart bins by
          availability — less-full bins first.
        </p>

        <div
          id="find"
          ref={wrapRef}
          className="animate-fade-up relative mt-10 w-full max-w-3xl scroll-mt-28"
          style={{ animationDelay: "180ms" }}
        >
          <div className="rounded-[1.35rem] border border-white/40 bg-white p-3 shadow-[0_24px_60px_rgba(0,0,0,0.35)] ring-1 ring-black/5 sm:p-4">
            <label
              htmlFor="area-search"
              className="flex items-center gap-2 px-1 text-left text-xs font-bold uppercase tracking-[0.16em] text-eco-primary"
            >
              <MapPin className="h-4 w-4" />
              Search your area
            </label>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setOpenSuggest(false);
                onSearch();
              }}
              className="mt-3"
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-eco-primary" />
                <input
                  id="area-search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpenSuggest(true);
                  }}
                  onFocus={() => setOpenSuggest(true)}
                  onKeyDown={onKeyDown}
                  placeholder="Type area name — e.g. Malabe, Nugegoda, Colombo 07…"
                  autoComplete="off"
                  className="w-full rounded-2xl border-2 border-eco-light bg-eco-bg/40 py-4 pl-12 pr-4 text-base font-medium text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-eco-primary focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />

                {showDropdown ? (
                  <ul
                    className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white py-1 text-left shadow-xl"
                    role="listbox"
                  >
                    {suggestLoading ? (
                      <li className="flex items-center gap-2 px-4 py-3 text-sm text-ink-500">
                        <Loader2 className="h-4 w-4 animate-spin text-eco-primary" />
                        Searching locations…
                      </li>
                    ) : null}
                    {suggestions.map((hit, idx) => (
                      <li key={`${hit.latitude}-${hit.longitude}-${idx}`}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={idx === activeIdx}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickSuggestion(hit)}
                          className={[
                            "flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition",
                            idx === activeIdx
                              ? "bg-eco-light text-eco-dark"
                              : "text-ink-700 hover:bg-eco-light/70",
                          ].join(" ")}
                        >
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-eco-primary" />
                          <span>
                            <span className="block font-semibold">
                              {hit.label?.split(",")[0] || "Location"}
                            </span>
                            <span className="block text-xs text-ink-500 line-clamp-2">
                              {hit.label}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onUseLocation}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-eco-light bg-white px-4 py-3.5 text-sm font-semibold text-eco-dark transition hover:border-eco-primary hover:bg-eco-light disabled:opacity-60"
                >
                  <Crosshair className="h-4 w-4" />
                  Use my location
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-eco-primary px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-eco-dark disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Finding bins…
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Find nearest bin
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {searchedLabel ? (
            <p className="mt-3 text-sm font-semibold text-emerald-100">
              Showing bins near <span className="text-white">{searchedLabel}</span>
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-100">
              {error}
            </p>
          ) : (
            <p className="mt-3 text-xs text-white/75">
              Powered by live bin data · prefers available bins with lower fill level
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/55">
              Popular areas
            </span>
            {POPULAR_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => onChip(area)}
                disabled={busy}
                className="rounded-full border border-white/30 bg-white/12 px-3.5 py-1.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/22 disabled:opacity-60"
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
