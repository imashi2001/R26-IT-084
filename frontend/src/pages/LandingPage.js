import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_TILE_LIGHT, MAP_ATTRIBUTION } from "../config/mapConfig";
import {
  MapPin,
  Navigation,
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
import PublicNav, { NAV_LINKS } from "../components/public/PublicNav";
import PublicHero from "../components/public/PublicHero";
import BrandLogo from "../components/BrandLogo";
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
 * Public VisionWaste landing (/) — citizen bin finder.
 * Geo search → GET /devices/nearest (live DB or demo fallback).
 */

const scrollToFind = () => {
  document.getElementById("find")?.scrollIntoView({ behavior: "smooth", block: "center" });
};

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
          const fallbacks = {
            Malabe: [6.9147, 79.9729],
            Kaduwela: [6.935, 79.983],
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
        await loadNearest(hit.latitude, hit.longitude, hit.label?.split(",")[0] || q);
      } catch (e) {
        setBusy(false);
        setError(e.message || "Search failed.");
      }
    },
    [query, loadNearest]
  );

  const selectGeoSuggestion = useCallback(
    (hit) => {
      const label = hit.label?.split(",")[0] || query;
      setQuery(label);
      loadNearest(hit.latitude, hit.longitude, label);
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

    const finish = async (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const accuracyM = Number(accuracy);

      // Desktop/WiFi geolocation is often wrong (e.g. shows Kandy instead of Malabe).
      if (Number.isFinite(accuracyM) && accuracyM > 2000) {
        setBusy(false);
        setError(
          `Your browser location looks inaccurate (about ±${Math.round(
            accuracyM / 1000
          )} km). Search your area — e.g. Malabe, Kaduwela, Nugegoda — for correct bins.`
        );
        return;
      }

      let label = "My location";
      try {
        const res = await fetch(
          apiUrl(
            `/geo/reverse?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(
              longitude
            )}`
          )
        );
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.label) {
          label = body.label;
          setQuery(label);
        }
      } catch {
        /* keep "My location" */
      }
      loadNearest(latitude, longitude, label);
    };

    navigator.geolocation.getCurrentPosition(
      finish,
      () => {
        setBusy(false);
        setError("Could not read your location. Allow GPS or search by area.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, [loadNearest, setQuery]);

  const handleBinSelect = useCallback(
    (bin) => {
      const st = binAvailability(bin);
      if (st.key !== "full" && st.key !== "overflow") return;

      const alternative = ranked.find((b) => {
        if (b.id === bin.id) return false;
        const s = binAvailability(b);
        return s.key === "available" || s.key === "near_full";
      });

      const message = alternative
        ? `${bin.name} is ${st.label.toLowerCase()}. Please choose another bin.\n\nSuggested: ${alternative.name} (${formatDistance(alternative.distance_meters)} away).`
        : `${bin.name} is ${st.label.toLowerCase()}. Please choose another bin nearby.`;

      window.alert(message);
    },
    [ranked]
  );

  const shell = dark
    ? "bg-ink-950 text-ink-200"
    : "bg-eco-bg text-ink-900";

  return (
    <div className={`min-h-screen font-sans antialiased [&_a]:no-underline ${shell}`}>
      <PublicNav
        dark={dark}
        onToggleTheme={() => setDark((d) => !d)}
        onFindClick={scrollToFind}
      />

      <PublicHero
        query={query}
        setQuery={setQuery}
        busy={busy}
        error={error}
        searchedLabel={searchedLabel}
        onSearch={() => searchArea()}
        onSelectSuggestion={selectGeoSuggestion}
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
                  <TileLayer url={MAP_TILE_LIGHT} attribution={MAP_ATTRIBUTION} />
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
                          {(st.key === "full" || st.key === "overflow") && (
                            <>
                              <br />
                              <button
                                type="button"
                                onClick={() => handleBinSelect(b)}
                                className="mt-2 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                              >
                                Bin full — choose another
                              </button>
                            </>
                          )}
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
                  <BinCard
                    key={b.id}
                    bin={b}
                    dark={dark}
                    rank={i + 1}
                    onSelect={handleBinSelect}
                  />
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

function BinCard({ bin, dark, rank, onSelect }) {
  const st = binAvailability(bin);
  const pct = fillPercent(bin);
  const isUnavailable = st.key === "full" || st.key === "overflow";
  const mapsUrl =
    Number.isFinite(Number(bin.latitude)) && Number.isFinite(Number(bin.longitude))
      ? `https://www.google.com/maps/dir/?api=1&destination=${bin.latitude},${bin.longitude}`
      : null;

  function handleSelect() {
    if (isUnavailable) onSelect?.(bin);
  }

  function handleDirections(e) {
    if (isUnavailable) {
      e.preventDefault();
      onSelect?.(bin);
    }
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
        dark
          ? "border-ink-700 bg-ink-950"
          : "border-slate-200 bg-white"
      } ${isUnavailable ? "ring-1 ring-red-400/40" : ""}`}
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
          onClick={handleDirections}
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
          <BrandLogo variant="footer" theme={dark ? "dark" : "light"} />
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
            This is the public citizen interface. Municipal operators sign in
            at{" "}
            <Link to="/login" className="font-semibold text-eco-primary hover:underline">
              Staff login
            </Link>
            .
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
