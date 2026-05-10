/** @type {import('tailwindcss').Config} */
module.exports = {
  // Only scan source files. CSS classes outside this list won't get JIT-compiled.
  content: ["./src/**/*.{js,jsx,ts,tsx}"],

  // IMPORTANT: preflight is disabled.
  //
  // The existing `App.css` (~1,300 lines) and teammate-owned pages (HomePage,
  // MapPage, AdminPage, BinDetailPage, MobileReportPage) rely on default
  // browser styling for elements like <button>, <h1>, <ul>, etc. Tailwind's
  // preflight resets all of those globally, which would visually break those
  // pages. Disabling it lets Tailwind utilities live alongside the existing
  // hand-written CSS without side effects on legacy markup.
  //
  // The new dashboard cards (PR 2+) will be self-contained Tailwind components,
  // so they don't need preflight either.
  corePlugins: {
    preflight: false,
  },

  theme: {
    extend: {
      // Project palette — keeps the dark slate / lime-green look from the mockup.
      colors: {
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
        },
        ink: {
          50: "#f8fafc",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        risk: {
          low: "#22c55e",
          medium: "#f59e0b",
          high: "#ef4444",
          critical: "#b91c1c",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.1)",
      },
    },
  },

  plugins: [],
};
