import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import NavBar from "./components/NavBar";
import HomePage from "./pages/HomePage";
import MapPage from "./pages/MapPage";
import BinDetailPage from "./pages/BinDetailPage";
import AdminPage from "./pages/AdminPage";
import HygienicRiskDashboardPage from "./pages/HygienicRiskDashboardPage";
import MobileReportPage from "./pages/MobileReportPage";
import SystemDashboardPage from "./pages/SystemDashboardPage";
import StubPage from "./pages/StubPage";
import "./App.css";

/*
 * App routing.
 *
 * Two shells, by intent:
 *
 *   <LegacyShell>  - renders the existing top NavBar above legacy pages
 *                    (HomePage upload UI, MapPage, BinDetailPage, AdminPage,
 *                    MobileReportPage, HygienicRiskDashboardPage). These are
 *                    teammate-owned + use class-based App.css; we keep them
 *                    visually identical to before this dashboard work landed.
 *
 *   SystemDashboardPage / StubPage  - opt INTO `DashboardLayout` (sidebar +
 *                    topbar) so the new dashboard surface stays self-contained.
 *
 * Routing decisions:
 *   /                  -> SystemDashboardPage         (new home)
 *   /live-monitoring   -> legacy HomePage upload UI    (kept verbatim, just re-pathed)
 *   /system            -> redirect to /               (legacy preview alias)
 *   /hygienic-risk     -> Imashi's risk dashboard      (legacy NavBar)
 *   /map, /bins/:id, /admin, /mobile-report  -> teammates' pages (legacy NavBar)
 *
 * Stub routes (sidebar items without a dedicated UI yet) all live under
 * `DashboardLayout` via `StubPage` so every sidebar click resolves cleanly.
 * Replacing any stub later is a one-line change in this file (swap the
 * element) — App.js is the only place that needs editing.
 */
function LegacyShell({ children }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ---- New dashboard (system shell) ---- */}
          <Route path="/" element={<SystemDashboardPage />} />
          <Route path="/system" element={<Navigate to="/" replace />} />

          {/* ---- Legacy pages (top NavBar) ---- */}
          <Route
            path="/live-monitoring"
            element={
              <LegacyShell>
                <HomePage />
              </LegacyShell>
            }
          />
          <Route
            path="/hygienic-risk"
            element={
              <LegacyShell>
                <HygienicRiskDashboardPage />
              </LegacyShell>
            }
          />
          <Route
            path="/mobile-report"
            element={
              <LegacyShell>
                <MobileReportPage />
              </LegacyShell>
            }
          />
          <Route
            path="/map"
            element={
              <LegacyShell>
                <MapPage />
              </LegacyShell>
            }
          />
          <Route
            path="/bins/:id"
            element={
              <LegacyShell>
                <BinDetailPage />
              </LegacyShell>
            }
          />
          <Route
            path="/admin"
            element={
              <LegacyShell>
                <AdminPage />
              </LegacyShell>
            }
          />

          {/* ---- Stub routes (sidebar placeholders) ---- */}
          <Route
            path="/bin-fill"
            element={
              <StubPage
                title="Bin Fill Level"
                description="Per-bin Empty / Half / Overflow tier history with YOLO confidence and a 7-day trend. Backend already exposes /devices and /captures with fill_level + fill_percentage; this page just hasn't been built yet."
                suggestionTo="/"
                suggestionLabel="See current fill on the dashboard"
              />
            }
          />
          <Route
            path="/animals"
            element={
              <StubPage
                title="Animal Detection"
                description="Captures filtered to events where the YOLO animal model returned at least one detection. Useful for exporting evidence and tuning deterrence."
                suggestionTo="/hygienic-risk"
                suggestionLabel="See animals on the Risk Dashboard for now"
              />
            }
          />
          <Route
            path="/forecast"
            element={
              <StubPage
                title="Forecasting"
                description="24-hour rule-based forecast (already implemented under GET /forecast). The Risk Dashboard renders the timeline today; a dedicated page with deeper controls is planned."
                suggestionTo="/hygienic-risk"
                suggestionLabel="Open the forecast on the Risk Dashboard"
              />
            }
          />
          <Route
            path="/alerts"
            element={
              <StubPage
                title="Alerts & Notifications"
                description="Full alerts feed, filters, and acknowledgement flow. The dashboard's Recent Alerts card shows the last 6 events; this page will paginate through everything."
                suggestionTo="/"
                suggestionLabel="See recent alerts on the dashboard"
              />
            }
          />
          <Route
            path="/reports"
            element={
              <StubPage
                title="Reports"
                description="Aggregated reports + CSV export over /captures: risk timeline, fill events, animal sightings."
                suggestionTo="/hygienic-risk"
                suggestionLabel="View capture history on the Risk Dashboard"
              />
            }
          />
          <Route
            path="/history"
            element={
              <StubPage
                title="History"
                description="Full timeline of every capture (the table currently shown on the Risk Dashboard, expanded with image previews and per-bin filters)."
                suggestionTo="/hygienic-risk"
                suggestionLabel="Open Risk Dashboard history"
              />
            }
          />
          <Route
            path="/devices"
            element={
              <StubPage
                title="IoT Devices"
                description="Bin (device) registry with bridge bindings, ESP32 ids, and last-seen timestamps. Backend already returns /devices?latest=1; this page wraps it in a manageable list/table."
                suggestionTo="/admin"
                suggestionLabel="Add devices via Admin"
              />
            }
          />
          <Route
            path="/bins"
            element={
              <StubPage
                title="Bin Status"
                description="Bin list with current fill, risk, and last-capture thumbnails. Click through to /bins/:id for the detail page."
                suggestionTo="/admin"
                suggestionLabel="Manage bins via Admin"
              />
            }
          />

          {/* Anything else falls back to the new dashboard. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
