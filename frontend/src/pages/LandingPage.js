import React from "react";
import { Link } from "react-router-dom";
import {
  Leaf,
  ShieldCheck,
  Activity,
  TrendingUp,
  PawPrint,
  MapPin,
  CloudSun,
  Trash2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

/**
 * Public landing page (/) for VisionWaste.
 *
 * Visual language mirrors the dashboard:
 *   - dark slate hero, brand-500 accents
 *   - Inter sans-serif
 *   - rounded cards with soft shadow
 *
 * Two CTAs: "Get started" -> /register, "Sign in" -> /login.
 * If already authenticated we surface a "Go to dashboard" shortcut in the
 * top nav so admins can return without going through /login again.
 */
export default function LandingPage() {
  const { token, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-ink-900 antialiased">
      <PublicNav token={token} user={user} />

      <Hero token={token} />

      <FeatureGrid />

      <HowItWorks />

      <FinalCTA token={token} />

      <Footer />
    </div>
  );
}

function PublicNav({ token, user }) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 shadow-sm shadow-brand-500/30">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold text-ink-900">VisionWaste</div>
            <div className="text-[11px] text-ink-500">
              Smart Waste Monitoring
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-ink-500">
          <a href="#features" className="hover:text-ink-900 transition">
            Features
          </a>
          <a href="#how" className="hover:text-ink-900 transition">
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {token ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition"
            >
              Go to dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-flex rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 hover:text-ink-900 hover:bg-slate-100 transition"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 transition"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero({ token }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900">
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(34,197,94,0.45), transparent 55%), radial-gradient(circle at 85% 80%, rgba(34,197,94,0.22), transparent 55%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 lg:py-28">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-brand-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
            Computer vision · live weather · rule-based risk
          </div>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
            Cleaner streets,
            <br />
            <span className="text-brand-400">predicted in advance.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ink-300 max-w-2xl">
            VisionWaste turns a single photo from a roadside bin into a complete
            hygiene picture: waste type, fill level, animal activity, and the
            risk of a bin becoming a public-health hazard in the next 24 hours.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {token ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition"
              >
                Open dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition"
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>

          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-300">
            <ChecklistItem>Transparent rule-based risk</ChecklistItem>
            <ChecklistItem>Live OpenWeather integration</ChecklistItem>
            <ChecklistItem>ESP32-CAM ready</ChecklistItem>
          </ul>
        </div>
      </div>
    </section>
  );
}

function ChecklistItem({ children }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <CheckCircle2 className="h-4 w-4 text-brand-400" />
      {children}
    </li>
  );
}

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Hygienic risk scoring",
    desc: "LOW / MEDIUM / HIGH classification with every input transparent — waste type, animals, temperature, humidity, fill level.",
  },
  {
    icon: Trash2,
    title: "Bin fill detection",
    desc: "YOLO model classifies bins as Empty, Half, or Overflow with confidence — surface the worst bins first.",
  },
  {
    icon: PawPrint,
    title: "Animal activity alerts",
    desc: "Detects dogs, crows, and other scavengers in capture images so you can plan deterrence.",
  },
  {
    icon: TrendingUp,
    title: "24-hour forecasting",
    desc: "Project risk forward using forecast weather so collection routes are scheduled before a bin tips over.",
  },
  {
    icon: MapPin,
    title: "Live bin map",
    desc: "Every bin on a Leaflet map, colour-coded by fill tier, with last-capture timestamps and click-through details.",
  },
  {
    icon: CloudSun,
    title: "Weather-aware rotting",
    desc: "Estimate rotting hours from temperature + humidity so organic waste is collected before it becomes a hazard.",
  },
];

function FeatureGrid() {
  return (
    <section id="features" className="py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">
            What you get
          </div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-ink-900">
            Everything a council needs to keep streets clean.
          </h2>
          <p className="mt-4 text-base text-ink-500">
            Twelve dashboard cards, one source of truth — pulled live from your
            cameras and weather feed.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, desc }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card hover:shadow-md hover:-translate-y-0.5 transition">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
        <Icon className="h-5 w-5 text-brand-700" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm text-ink-500 leading-relaxed">{desc}</p>
    </div>
  );
}

const STEPS = [
  {
    step: "01",
    icon: Activity,
    title: "Capture",
    desc: "An ESP32-CAM (or any phone) sends a photo of a roadside bin to the backend.",
  },
  {
    step: "02",
    icon: ShieldCheck,
    title: "Analyze",
    desc: "Three ML services classify waste type, count animals, and detect bin fill level.",
  },
  {
    step: "03",
    icon: TrendingUp,
    title: "Decide",
    desc: "Rules combine ML output with live weather to score risk and forecast the next 24h.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="bg-white border-y border-slate-200 py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">
            How it works
          </div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-ink-900">
            One photo. Three models. Total clarity.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="relative rounded-2xl border border-slate-200 bg-slate-50 p-6"
            >
              <div className="absolute -top-3 left-6 inline-flex items-center justify-center rounded-md bg-ink-900 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white">
                {s.step}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200">
                <s.icon className="h-5 w-5 text-brand-700" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink-900">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-ink-500 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ token }) {
  return (
    <section className="py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 to-ink-800 px-6 sm:px-12 py-12 sm:py-16 text-center shadow-card">
          <div
            aria-hidden
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 20%, rgba(34,197,94,0.4), transparent 60%), radial-gradient(circle at 70% 80%, rgba(34,197,94,0.2), transparent 60%)",
            }}
          />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Ready to monitor your bins in real time?
            </h2>
            <p className="mt-4 text-base text-ink-300 max-w-2xl mx-auto">
              Create an admin account for your council and connect your first
              camera in minutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {token ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition"
                >
                  Open dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 hover:bg-brand-600 transition"
                  >
                    Create admin account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-500">
        <div>
          © {new Date().getFullYear()} VisionWaste · Built for municipal admins.
        </div>
        <div className="flex items-center gap-4">
          <a href="#features" className="hover:text-ink-900 transition">
            Features
          </a>
          <a href="#how" className="hover:text-ink-900 transition">
            How it works
          </a>
        </div>
      </div>
    </footer>
  );
}
