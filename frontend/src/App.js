import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import HomePage from "./pages/HomePage";
import MapPage from "./pages/MapPage";
import BinDetailPage from "./pages/BinDetailPage";
import AdminPage from "./pages/AdminPage";
import HygienicRiskDashboardPage from "./pages/HygienicRiskDashboardPage";
import MobileReportPage from "./pages/MobileReportPage";
import SystemDashboardPage from "./pages/SystemDashboardPage";
import StubPage from "./pages/StubPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import "./App.css";

/*
 * App routing.
 *
 * Public surface (no auth required):
 *   /            -> LandingPage         (marketing + product overview)
 *   /login       -> LoginPage           (email + password)
 *   /register    -> RegisterPage        (admin profile + password)
 *
 * Authenticated surface (everything below `<ProtectedRoute>`):
 *   /dashboard           -> SystemDashboardPage   (new dashboard shell)
 *   /system              -> redirects to /dashboard (legacy alias)
 *   /live-monitoring     -> legacy HomePage upload UI       (LegacyShell)
 *   /hygienic-risk       -> Imashi's risk dashboard         (LegacyShell)
 *   /map, /bins/:id, /admin, /mobile-report -> teammates' pages (LegacyShell)
 *   /bin-fill, /animals, /forecast, /alerts, /reports,
 *   /history, /devices, /bins                                (StubPage)
 *
 * Two shells, by intent:
 *
 *   <LegacyShell>  - renders the existing top NavBar above legacy pages.
 *                    These pages are teammate-owned and use class-based
 *                    `App.css`; we keep them visually identical.
 *
 *   SystemDashboardPage / StubPage  - opt INTO `DashboardLayout` (sidebar
 *                    + topbar), so the new dashboard surface stays self-
 *                    contained from legacy CSS.
 */
function LegacyShell({ children }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  );
}

const protectedShell = (el) => (
  <ProtectedRoute>{el}</ProtectedRoute>
);

const legacyProtected = (Page) =>
  protectedShell(
    <LegacyShell>
      <Page />
    </LegacyShell>
  );

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ---- Public ---- */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ---- New dashboard (system shell) ---- */}
          <Route
            path="/dashboard"
            element={protectedShell(<SystemDashboardPage />)}
          />
          <Route
            path="/system"
            element={<Navigate to="/dashboard" replace />}
          />

          {/* ---- Legacy pages (top NavBar) ---- */}
          <Route path="/live-monitoring" element={legacyProtected(HomePage)} />
          <Route
            path="/hygienic-risk"
            element={legacyProtected(HygienicRiskDashboardPage)}
          />
          <Route
            path="/mobile-report"
            element={legacyProtected(MobileReportPage)}
          />
          <Route path="/map" element={legacyProtected(MapPage)} />
          <Route
            path="/bins/:id"
            element={protectedShell(
              <LegacyShell>
                <BinDetailPage />
              </LegacyShell>
            )}
          />
          <Route path="/admin" element={legacyProtected(AdminPage)} />

          {/* ---- Stub routes (sidebar placeholders) ---- */}
          <Route
            path="/bin-fill"
            element={protectedShell(
              <StubPage
                title="Bin Fill Level"
                description="Per-bin Empty / Half / Overflow tier history with YOLO confidence and a 7-day trend. Backend already exposes /devices and /captures with fill_level + fill_percentage; this page just hasn't been built yet."
                suggestionTo="/dashboard"
                suggestionLabel="See current fill on the dashboard"
              />
            )}
          />
          <Route
            path="/animals"
            element={protectedShell(
              <StubPage
                title="Animal Detection"
                description="Captures filtered to events where the YOLO animal model returned at least one detection. Useful for exporting evidence and tuning deterrence."
                suggestionTo="/hygienic-risk"
                suggestionLabel="See animals on the Risk Dashboard for now"
              />
            )}
          />
          <Route
            path="/forecast"
            element={protectedShell(
              <StubPage
                title="Forecasting"
                description="24-hour rule-based forecast (already implemented under GET /forecast). The Risk Dashboard renders the timeline today; a dedicated page with deeper controls is planned."
                suggestionTo="/hygienic-risk"
                suggestionLabel="Open the forecast on the Risk Dashboard"
              />
            )}
          />
          <Route
            path="/alerts"
            element={protectedShell(
              <StubPage
                title="Alerts & Notifications"
                description="Full alerts feed, filters, and acknowledgement flow. The dashboard's Recent Alerts card shows the last 6 events; this page will paginate through everything."
                suggestionTo="/dashboard"
                suggestionLabel="See recent alerts on the dashboard"
              />
            )}
          />
          <Route
            path="/reports"
            element={protectedShell(
              <StubPage
                title="Reports"
                description="Aggregated reports + CSV export over /captures: risk timeline, fill events, animal sightings."
                suggestionTo="/hygienic-risk"
                suggestionLabel="View capture history on the Risk Dashboard"
              />
            )}
          />
          <Route
            path="/history"
            element={protectedShell(
              <StubPage
                title="History"
                description="Full timeline of every capture (the table currently shown on the Risk Dashboard, expanded with image previews and per-bin filters)."
                suggestionTo="/hygienic-risk"
                suggestionLabel="Open Risk Dashboard history"
              />
            )}
          />
          <Route
            path="/devices"
            element={protectedShell(
              <StubPage
                title="IoT Devices"
                description="Bin (device) registry with bridge bindings, ESP32 ids, and last-seen timestamps. Backend already returns /devices?latest=1; this page wraps it in a manageable list/table."
                suggestionTo="/admin"
                suggestionLabel="Add devices via Admin"
              />
            )}
          />
          <Route
            path="/bins"
            element={protectedShell(
              <StubPage
                title="Bin Status"
                description="Bin list with current fill, risk, and last-capture thumbnails. Click through to /bins/:id for the detail page."
                suggestionTo="/admin"
                suggestionLabel="Manage bins via Admin"
              />
            )}
          />

          {/* Anything else falls back to the landing page. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
