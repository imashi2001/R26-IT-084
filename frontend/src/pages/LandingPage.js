import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Leaf,
  MapPin,
  Search,
  Navigation,
  Crosshair,
  Moon,
  Sun,
  Bell,
  ChevronRight,
  Recycle,
  ShieldCheck,
  Radio,
  Sparkles,
  ArrowRight,
  Trash2,
  Trees,
  HandHeart,
} from "lucide-react";
import { apiUrl } from "../utils/apiBase";
import {
  BIN_STATUS,
  POPULAR_AREAS,
  binAvailability,
  demoBinsNear,
  fillPercent,
  formatDistance,
  rankBinsForPublic,
} from "../utils/publicBinStatus";

/**
 * Public VisionWaste landing (/) — Magiya-inspired search-first experience.
 * No admin login / dashboard CTAs. Focus: find nearest available bin.
 */

const HERO_VIDEO = "/videos/hero-bg.mov";
const HERO_VIDEO_TYPE = "video/quicktime";

const TILE_URL =
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#find", label: "Find Nearest Bin" },
  { href: "#map", label: "Bin Map" },
  { href: "#guide", label: "Waste Guide" },
  { href: "#schedule", label: "Schedule Pickup" },
  { href: "#about", label: "About Us" },
];

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);
  return null;
}

export default function LandingPage() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("vw-public-theme") === "dark";
    } catch {
      return false;
    }
  });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [userPos, setUserPos] = useState(null);
  const [bins, setBins] = useState([]);
  const [searchedLabel, setSearchedLabel] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [listLimit, setListLimit] = useState(3);
  const resultsRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("vw-public-theme", dark ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }, [dark]);

  const ranked = useMemo(() => rankBinsForPublic(bins), [bins]);
  const visible = ranked.slice(0, listLimit);

  const mapCenter = useMemo(() => {
    if (userPos) return [userPos.lat, userPos.lng];
    if (ranked[0]?.latitude != null) {
      return [Number(ranked[0].latitude), Number(ranked[0].longitude)];
    }
    return [6.9271, 79.8612];
  }, [userPos, ranked]);

  const mapPoints = useMemo(() => {
    const pts = [];
    if (userPos) pts.push([userPos.lat, userPos.lng]);
    ranked.forEach((b) => {
      if (Number.isFinite(Number(b.latitude)) && Number.isFinite(Number(b.longitude))) {
        pts.push([Number(b.latitude), Number(b.longitude)]);
      }
    });
    return pts;
  }, [userPos, ranked]);

  const loadNearest = useCallback(async (lat, lng, label) => {
    setBusy(true);
    setError("");
    setSearchedLabel(label || "");
    setListLimit(3);
    try {
      const res = await fetch(
        apiUrl(
          `/devices/nearest?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(
            lng
          )}&limit=20`
        )
      );
      const body = await res.json().catch(() => ({}));
      if (res.status === 503 || !res.ok) {
        setBins(demoBinsNear(lat, lng, label || "Malabe"));
        setDemoMode(true);
        setUserPos({ lat, lng });
        return;
      }
      const results = Array.isArray(body.results) ? body.results : [];
      if (!results.length) {
        setBins(demoBinsNear(lat, lng, label || "Malabe"));
        setDemoMode(true);
      } else {
        setBins(results);
        setDemoMode(false);
      }
      setUserPos({ lat, lng });
    } catch (e) {
      setBins(demoBinsNear(lat, lng, label || "Malabe"));
      setDemoMode(true);
      setUserPos({ lat, lng });
      setError(e.message || "Could not reach the API — showing sample bins.");
    } finally {
      setBusy(false);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, []);

  const searchArea = useCallback(
    async (raw) => {
      const q = (raw || query).trim();
      if (q.length < 2) {
        setError("Enter an area name (e.g. Malabe).");
        return;
      }
      setBusy(true);
      setError("");
      try {
        const res = await fetch(apiUrl(`/geo/search?q=${encodeURIComponent(q)}`));
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        const hit = (body.results || []).find(
          (r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
        );
        if (!hit) {
          // Fallback: known Sri Lanka centroids for popular chips
          const fallbacks = {
            Malabe: [6.9147, 79.9729],
            Kottawa: [6.841, 79.965],
            Battaramulla: [6.898, 79.919],
            Nugegoda: [6.864, 79.899],
            "Colombo 07": [6.906, 79.87],
            Colombo: [6.9271, 79.8612],
          };
          const key = Object.keys(fallbacks).find(
            (k) => k.toLowerCase() === q.toLowerCase()
          );
          if (key) {
            await loadNearest(fallbacks[key][0], fallbacks[key][1], key);
            return;
          }
          throw new Error("No matching location found. Try Malabe or Colombo.");
        }
        await loadNearest(hit.latitude, hit.longitude, q);
      } catch (e) {
        setBusy(false);
        setError(e.message || "Search failed.");
      }
    },
    [query, loadNearest]
  );

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        loadNearest(pos.coords.latitude, pos.coords.longitude, "My location");
      },
      () => {
        setBusy(false);
        setError("Could not read your location. Allow GPS or search by area.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [loadNearest]);

  const shell = dark
    ? "bg-ink-950 text-ink-200"
    : "bg-eco-bg text-ink-900";

  return (
    <div className={`min-h-screen font-sans antialiased ${shell}`}>
      <PublicNav dark={dark} onToggleTheme={() => setDark((d) => !d)} />

      <Hero
        query={query}
        setQuery={setQuery}
        busy={busy}
        error={error}
        onSearch={() => searchArea()}
        onChip={(area) => {
          setQuery(area);
          searchArea(area);
        }}
        onUseLocation={useMyLocation}
      />

      <QuickStats dark={dark} binCount={ranked.length || 124} />

      <section
        id="map"
        ref={resultsRef}
        className={`scroll-mt-24 py-16 lg:py-20 ${dark ? "bg-ink-900" : "bg-white"}`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl animate-fade-up">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-eco-primary">
              Live bin map
            </p>
            <h2
              className={`mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl ${
                dark ? "text-white" : "text-ink-900"
              }`}
            >
              Nearby Bins in Your Area
            </h2>
            <p className={`mt-3 text-base ${dark ? "text-ink-400" : "text-ink-500"}`}>
              {searchedLabel
                ? `Showing recommended bins near ${searchedLabel}.`
                : "Search an area above to see available bins on the map."}
              {demoMode ? (
                <span className="ml-1 text-eco-warn">
                  (Sample data — connect DATABASE_URL for live bins.)
                </span>
              ) : null}
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 overflow-hidden rounded-3xl border border-black/5 shadow-card">
              <div className="h-[360px] sm:h-[440px] w-full">
                <MapContainer
                  center={mapCenter}
                  zoom={14}
                  className="h-full w-full"
                  scrollWheelZoom
                >
                  <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
                  <FitBounds points={mapPoints} />
                  {userPos && (
                    <CircleMarker
                      center={[userPos.lat, userPos.lng]}
                      radius={9}
                      pathOptions={{
                        color: "#fff",
                        weight: 2,
                        fillColor: "#2563eb",
                        fillOpacity: 1,
                      }}
                    >
                      <Popup>You are here</Popup>
                    </CircleMarker>
                  )}
                  {ranked.map((b) => {
                    const st = binAvailability(b);
                    return (
                      <CircleMarker
                        key={b.id}
                        center={[Number(b.latitude), Number(b.longitude)]}
                        radius={11}
                        pathOptions={{
                          color: "#fff",
                          weight: 2,
                          fillColor: st.color,
                          fillOpacity: 0.95,
                        }}
                      >
                        <Popup>
                          <strong>{b.name}</strong>
                          <br />
                          {st.label} · {fillPercent(b) ?? "—"}%
                          <br />
                          {formatDistance(b.distance_meters)}
                        </Popup>
                      </CircleMarker>
                    );
                  })}
                </MapContainer>
              </div>
              <Legend dark={dark} />
            </div>

            <div className="lg:col-span-2 flex flex-col gap-3">
              <h3
                className={`text-sm font-bold uppercase tracking-wide ${
                  dark ? "text-ink-300" : "text-ink-500"
                }`}
              >
                Nearest available bins
              </h3>
              {visible.length === 0 ? (
                <div
                  className={`rounded-2xl border border-dashed p-6 text-sm ${
                    dark
                      ? "border-ink-700 text-ink-400"
                      : "border-slate-200 text-ink-500"
                  }`}
                >
                  Search a location or use GPS to see recommended bins.
                </div>
              ) : (
                visible.map((b, i) => (
                  <BinCard key={b.id} bin={b} dark={dark} rank={i + 1} />
                ))
              )}
              {ranked.length > listLimit && (
                <button
                  type="button"
                  onClick={() => setListLimit((n) => n + 5)}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-eco-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-eco-dark"
                >
                  View More Bins
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <WasteGuide dark={dark} />
      <SchedulePickup dark={dark} />
      <SustainabilityBanner dark={dark} />
      <AboutFooter dark={dark} />
    </div>
  );
}

function PublicNav({ dark, onToggleTheme }) {
  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-md ${
        dark
          ? "border-white/10 bg-ink-950/80"
          : "border-eco-light bg-white/85"
      }`}
    >
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#home" className="flex items-center gap-2.5 shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-eco-primary shadow-md shadow-eco-primary/25">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div
              className={`font-display text-lg font-extrabold tracking-tight ${
                dark ? "text-white" : "text-ink-900"
              }`}
            >
              VisionWaste
            </div>
            <div className="text-[11px] font-medium text-eco-primary">
              Smart Waste Management
            </div>
          </div>
        </a>

        <nav className="hidden lg:flex items-center gap-5 text-sm font-semibold">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`transition hover:text-eco-primary ${
                dark ? "text-ink-300" : "text-ink-500"
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <select
            aria-label="Language"
            className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${
              dark
                ? "border-ink-700 bg-ink-900 text-ink-200"
                : "border-slate-200 bg-white text-ink-700"
            }`}
            defaultValue="en"
          >
            <option value="en">English</option>
            <option value="si">සිංහල</option>
            <option value="ta">தமிழ்</option>
          </select>
          <button
            type="button"
            aria-label="Notifications"
            className={`hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
              dark
                ? "border-ink-700 text-ink-300 hover:bg-ink-800"
                : "border-slate-200 text-ink-500 hover:bg-eco-light"
            }`}
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
              dark
                ? "border-ink-700 text-ink-200 hover:bg-ink-800"
                : "border-slate-200 text-ink-700 hover:bg-eco-light"
            }`}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero({
  query,
  setQuery,
  busy,
  error,
  onSearch,
  onChip,
  onUseLocation,
}) {
  return (
    <section id="home" className="relative isolate min-h-[92vh] overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster=""
      >
        <source src={HERO_VIDEO} type={HERO_VIDEO_TYPE} />
        {/* Fallback if browser rejects .mov */}
        <source src={HERO_VIDEO} type="video/mp4" />
      </video>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(27,94,32,0.45) 45%, rgba(15,23,42,0.72) 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-8 top-28 h-24 w-24 animate-float opacity-40"
      >
        <Leaf className="h-full w-full text-eco-light" />
      </div>

      <div className="relative mx-auto flex min-h-[92vh] max-w-5xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <p className="animate-fade-up text-sm font-semibold uppercase tracking-[0.22em] text-eco-light">
          Together for a Cleaner Tomorrow
        </p>
        <h1
          className="animate-fade-up mt-4 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
          style={{ animationDelay: "80ms" }}
        >
          Find the Nearest Bin,
          <br />
          Keep Our City <span className="text-[#A5D6A7]">Clean</span>
        </h1>
        <p
          className="animate-fade-up mt-5 max-w-2xl text-base text-white/85 sm:text-lg"
          style={{ animationDelay: "140ms" }}
        >
          Locate nearby available waste bins in real-time and dispose of your
          waste responsibly for a cleaner, healthier city.
        </p>

        <div
          id="find"
          className="animate-fade-up mt-10 w-full scroll-mt-28"
          style={{ animationDelay: "200ms" }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSearch();
            }}
            className="mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-[1.75rem] border border-white/30 bg-white/12 p-2 shadow-search backdrop-blur-md sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:p-1.5"
          >
            <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-3 sm:rounded-none sm:bg-transparent sm:px-4 sm:py-2">
              <MapPin className="h-5 w-5 shrink-0 text-eco-primary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search area or location (e.g. Malabe, Main Street...)"
                className="w-full border-0 bg-transparent text-sm font-medium text-ink-900 outline-none placeholder:text-ink-400 sm:text-base"
              />
            </div>
            <div className="flex gap-2 sm:pr-1">
              <button
                type="button"
                onClick={onUseLocation}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-3 py-3 text-xs font-semibold text-white transition hover:bg-white/25 sm:flex-none sm:px-4"
              >
                <Crosshair className="h-4 w-4" />
                Use My Location
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-eco-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-eco-dark/30 transition hover:bg-eco-dark disabled:opacity-60 sm:flex-none sm:px-7"
              >
                <Search className="h-4 w-4" />
                {busy ? "Searching…" : "Find Nearest Bin"}
              </button>
            </div>
          </form>

          {error ? (
            <p className="mt-3 text-sm font-medium text-amber-200">{error}</p>
          ) : (
            <p className="mt-3 text-xs text-white/70">
              Real-time availability · Prefer less-full bins first
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/60">
              Popular
            </span>
            {POPULAR_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => onChip(area)}
                className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/20"
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

function QuickStats({ dark, binCount }) {
  const cards = [
    {
      icon: Trash2,
      label: "Available Bins",
      value: String(binCount || 124),
      sub: "Near you",
    },
    {
      icon: ShieldCheck,
      label: "Clean & Safe",
      value: "Low Risk",
      sub: "Hygienic level",
    },
    {
      icon: Radio,
      label: "Real-Time Updates",
      value: "Live",
      sub: "Always up to date",
    },
    {
      icon: Sparkles,
      label: "Better Tomorrow",
      value: "Go Green",
      sub: "For a better future",
    },
  ];

  return (
    <section
      className={`relative z-10 -mt-10 px-4 sm:px-6 ${dark ? "" : ""}`}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className={`animate-fade-up rounded-2xl border p-5 shadow-card transition hover:-translate-y-1 hover:shadow-lg ${
              dark
                ? "border-ink-700 bg-ink-900"
                : "border-white bg-white"
            }`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-eco-primary">
                  {c.label}
                </div>
                <div
                  className={`mt-1 font-display text-2xl font-extrabold animate-count-pulse ${
                    dark ? "text-white" : "text-ink-900"
                  }`}
                >
                  {c.value}
                </div>
                <div className={`text-sm ${dark ? "text-ink-400" : "text-ink-500"}`}>
                  {c.sub}
                </div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-eco-light text-eco-primary">
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Legend({ dark }) {
  return (
    <div
      className={`flex flex-wrap gap-3 border-t px-4 py-3 text-xs font-semibold ${
        dark
          ? "border-ink-700 bg-ink-900 text-ink-300"
          : "border-slate-100 bg-eco-bg text-ink-600"
      }`}
    >
      {Object.values(BIN_STATUS).map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: s.color }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function BinCard({ bin, dark, rank }) {
  const st = binAvailability(bin);
  const pct = fillPercent(bin);
  const mapsUrl =
    Number.isFinite(Number(bin.latitude)) && Number.isFinite(Number(bin.longitude))
      ? `https://www.google.com/maps/dir/?api=1&destination=${bin.latitude},${bin.longitude}`
      : null;

  return (
    <article
      className={`flex items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
        dark
          ? "border-ink-700 bg-ink-950"
          : "border-slate-200 bg-white"
      }`}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: st.color }}
      >
        <Trash2 className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold uppercase tracking-wide ${
              dark ? "text-ink-500" : "text-ink-400"
            }`}
          >
            #{rank}
          </span>
          <h4
            className={`truncate text-sm font-bold ${
              dark ? "text-white" : "text-ink-900"
            }`}
          >
            {bin.name}
          </h4>
        </div>
        <p className={`mt-0.5 text-xs ${dark ? "text-ink-400" : "text-ink-500"}`}>
          {bin.location || bin.address || "—"} ·{" "}
          <strong>{formatDistance(bin.distance_meters)} away</strong>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className={dark ? "text-ink-300" : "text-ink-700"}>
            Fill Level: {pct != null ? `${pct}%` : "—"}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-white"
            style={{ background: st.color }}
          >
            {st.label}
          </span>
        </div>
      </div>
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Get directions"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-eco-light text-eco-primary transition hover:bg-eco-primary hover:text-white"
        >
          <Navigation className="h-4 w-4" />
        </a>
      )}
    </article>
  );
}

function WasteGuide({ dark }) {
  const tips = [
    {
      title: "Sort before you go",
      desc: "Separate organic and non-organic waste so bins stay hygienic longer.",
    },
    {
      title: "Prefer available bins",
      desc: "Skip full or overflow bins — our search ranks less-full options first.",
    },
    {
      title: "Close the lid",
      desc: "Keep animals out and odours down after you dispose.",
    },
  ];
  return (
    <section
      id="guide"
      className={`scroll-mt-24 py-16 lg:py-20 ${
        dark ? "bg-ink-950" : "bg-eco-light/60"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2
          className={`font-display text-3xl font-extrabold ${
            dark ? "text-white" : "text-ink-900"
          }`}
        >
          Waste Guide
        </h2>
        <p className={`mt-2 max-w-2xl ${dark ? "text-ink-400" : "text-ink-500"}`}>
          Simple habits that keep Sri Lanka cleaner — and help VisionWaste give
          you better recommendations.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {tips.map((t) => (
            <div
              key={t.title}
              className={`rounded-2xl border p-5 ${
                dark
                  ? "border-ink-700 bg-ink-900"
                  : "border-white bg-white shadow-card"
              }`}
            >
              <Recycle className="h-6 w-6 text-eco-primary" />
              <h3
                className={`mt-3 font-bold ${
                  dark ? "text-white" : "text-ink-900"
                }`}
              >
                {t.title}
              </h3>
              <p className={`mt-2 text-sm ${dark ? "text-ink-400" : "text-ink-500"}`}>
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SchedulePickup({ dark }) {
  return (
    <section
      id="schedule"
      className={`scroll-mt-24 py-16 ${dark ? "bg-ink-900" : "bg-white"}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className={`flex flex-col items-start justify-between gap-6 rounded-3xl border p-8 md:flex-row md:items-center ${
            dark
              ? "border-ink-700 bg-ink-950"
              : "border-eco-light bg-eco-bg"
          }`}
        >
          <div>
            <h2
              className={`font-display text-2xl font-extrabold sm:text-3xl ${
                dark ? "text-white" : "text-ink-900"
              }`}
            >
              Schedule waste pickup
            </h2>
            <p className={`mt-2 max-w-xl text-sm ${dark ? "text-ink-400" : "text-ink-500"}`}>
              Bulk or overflowing waste? Tell your municipal team. Public
              scheduling opens soon — for now, use the nearest available bin.
            </p>
          </div>
          <a
            href="#find"
            className="inline-flex items-center gap-2 rounded-full bg-eco-primary px-5 py-3 text-sm font-bold text-white hover:bg-eco-dark"
          >
            Find a bin instead
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function SustainabilityBanner({ dark }) {
  const messages = [
    "Use nearby bins",
    "Keep the city clean",
    "Reduce pollution",
    "Inspire others",
  ];
  return (
    <section
      className={`py-16 lg:py-20 ${
        dark
          ? "bg-gradient-to-br from-eco-dark to-ink-950"
          : "bg-gradient-to-br from-eco-primary to-eco-dark"
      }`}
    >
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
        <Trees className="mx-auto h-10 w-10 text-white/90" />
        <h2 className="mt-4 font-display text-3xl font-extrabold text-white sm:text-4xl">
          Small Actions, Big Impact
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base text-white/85">
          Every responsible disposal choice helps build a cleaner and greener
          tomorrow.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {messages.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur"
            >
              <HandHeart className="h-3.5 w-3.5" />
              {m}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutFooter({ dark }) {
  return (
    <footer
      id="about"
      className={`scroll-mt-24 border-t py-12 ${
        dark
          ? "border-ink-800 bg-ink-950 text-ink-400"
          : "border-slate-200 bg-white text-ink-500"
      }`}
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:grid-cols-3 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-eco-primary" />
            <span
              className={`font-display text-base font-extrabold ${
                dark ? "text-white" : "text-ink-900"
              }`}
            >
              VisionWaste
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed">
            Smart waste management for Sri Lankan cities — find nearby bins,
            dispose responsibly, and keep streets clean with real-time
            availability.
          </p>
        </div>
        <div>
          <div
            className={`text-xs font-bold uppercase tracking-wide ${
              dark ? "text-ink-300" : "text-ink-700"
            }`}
          >
            Quick Links
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="hover:text-eco-primary">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href="#about" className="hover:text-eco-primary">
                Contact
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div
            className={`text-xs font-bold uppercase tracking-wide ${
              dark ? "text-ink-300" : "text-ink-700"
            }`}
          >
            Note
          </div>
          <p className="mt-3 text-sm leading-relaxed">
            This is the public citizen interface. Municipal operators use a
            separate protected admin link (not shown here).
          </p>
        </div>
      </div>
      <div
        className={`mx-auto mt-10 max-w-7xl border-t px-4 pt-6 text-xs sm:px-6 ${
          dark ? "border-ink-800" : "border-slate-100"
        }`}
      >
        © {new Date().getFullYear()} VisionWaste. All rights reserved.
      </div>
    </footer>
  );
}
