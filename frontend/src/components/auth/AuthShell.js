import React from "react";
import { Link } from "react-router-dom";
import { Leaf, ShieldCheck, BarChart3, MapPin } from "lucide-react";

/**
 * Shared layout for /login and /register.
 *
 * Two columns on lg+:
 *   - Left  : dark slate panel with brand mark, headline, feature bullets.
 *             Echoes the dashboard's brand-500 accent so the visual
 *             handoff from auth -> dashboard feels continuous.
 *   - Right : white card with the form (passed as children).
 *
 * On mobile the brand panel collapses; the form stays full-width.
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-ink-900">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900">
        <div
          aria-hidden
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(34,197,94,0.45), transparent 55%), radial-gradient(circle at 80% 80%, rgba(34,197,94,0.20), transparent 50%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 shadow-lg shadow-brand-500/30">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-white leading-tight">
                VisionWaste
              </div>
              <div className="text-xs text-ink-300 leading-tight">
                Smart Waste Monitoring
              </div>
            </div>
          </Link>

          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-white leading-tight">
                A cleaner city, in real time.
              </h1>
              <p className="mt-4 text-base text-ink-300 max-w-md">
                Monitor waste hygiene risk, predict overflowing bins, and deter
                animals across your municipal area — all from one dashboard
                powered by computer vision and live weather data.
              </p>
            </div>

            <ul className="space-y-3">
              <FeatureRow
                icon={ShieldCheck}
                title="Rule-based risk scoring"
                desc="Transparent LOW / MEDIUM / HIGH classification with traceable inputs."
              />
              <FeatureRow
                icon={BarChart3}
                title="24h forecasting"
                desc="Plan collections before bins reach critical levels."
              />
              <FeatureRow
                icon={MapPin}
                title="Live bin map"
                desc="See every device, fill level, and recent alert on one map."
              />
            </ul>
          </div>

          <div className="text-xs text-ink-400">
            © {new Date().getFullYear()} VisionWaste — built for municipal admins.
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="lg:hidden inline-flex items-center gap-2 mb-8 text-ink-500 hover:text-ink-900 transition"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
              <Leaf className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">VisionWaste</span>
          </Link>

          <div>
            <h2 className="text-2xl font-bold text-ink-900">{title}</h2>
            {subtitle ? (
              <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
            ) : null}
          </div>

          <div className="mt-8 rounded-2xl bg-white p-6 sm:p-8 shadow-card border border-slate-100">
            {children}
          </div>

          {footer ? (
            <div className="mt-6 text-center text-sm text-ink-500">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon: Icon, title, desc }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
        <Icon className="h-4 w-4 text-brand-400" />
      </div>
      <div>
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-ink-400">{desc}</div>
      </div>
    </li>
  );
}
