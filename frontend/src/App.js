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
import LiveMonitoringPage from "./pages/LiveMonitoringPage";
import BinStatusPage from "./pages/BinStatusPage";
import AnimalDetectionPage from "./pages/AnimalDetectionPage";
import AlertsNotificationsPage from "./pages/AlertsNotificationsPage";
import ReportsPage from "./pages/ReportsPage";
import HistoryPage from "./pages/HistoryPage";
import "./App.css";

/*
 * App routing.
 *
 * Public surface (no auth required):
 *   /            -> LandingPage         (marketing + product overview)
 *   /login       -> LoginPage           (email + password)
 *   /register    -> RegisterPage        (admin profile + password)
 *
 * Authenticated surface (everything wrapped in `<ProtectedRoute>`):
 *   /dashboard            -> SystemDashboardPage      (dashboard shell)
 *   /system               -> redirects to /dashboard  (legacy alias)
 *   /live-monitoring      -> LiveMonitoringPage       (dashboard shell, map)
 *   /hygienic-risk        -> HygienicRiskDashboardPage(dashboard shell)
 *   /bin-level-detector   -> HomePage                 (dashboard shell, upload UI;
 *                                                      formerly mounted at
 *                                                      /live-monitoring before
 *                                                      the rename)
 *   /bin-fill             -> redirects to /bin-level-detector (back-compat)
 *   /map                  -> MapPage                  (dashboard shell, collection map)
 *   /bins/:id, /admin, /mobile-report -> teammates' pages (LegacyShell)
 *   /bins                 -> BinStatusPage             (dashboard shell, registry + form)
 *   /animals              -> AnimalDetectionPage       (dashboard shell, sightings + buzzer log)
 *   /alerts               -> AlertsNotificationsPage   (dashboard shell, alerts + admin workflow)
 *   /reports              -> ReportsPage               (dashboard shell, aggregations + CSV export)
 *   /history              -> HistoryPage               (dashboard shell, unified event timeline)
 *   /devices              -> redirects to /bins        (bin registry replaces legacy stub)
 *   /forecast                                          (StubPage)
 *
 * Two shells, by intent:
 *
 *   <LegacyShell>  - renders the existing top NavBar above legacy pages.
 *                    These pages are teammate-owned and use class-based
 *                    `App.css`; we keep them visually identical.
 *
 *   DashboardLayout (used by SystemDashboardPage, LiveMonitoringPage,
 *                    MapPage, BinStatusPage, AnimalDetectionPage,
 *                    AlertsNotificationsPage, StubPage, HomePage at
 *                    /bin-level-detector, etc.)
 *                    — sidebar + topbar shell, Tailwind-only, isolated from legacy CSS.
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

          {/* ---- Live monitoring (new map view, dashboard shell) ---- */}
          <Route
            path="/live-monitoring"
            element={protectedShell(<LiveMonitoringPage />)}
          />

          {/* ---- Bin Level Detector (dashboard shell, redesigned) ---- */}
          <Route
            path="/bin-level-detector"
            element={protectedShell(<HomePage />)}
          />
          {/* Back-compat: old /bin-fill stub now points at the renamed page. */}
          <Route
            path="/bin-fill"
            element={<Navigate to="/bin-level-detector" replace />}
          />

          {/* ---- Risk Dashboard (dashboard shell, redesigned) ---- */}
          <Route
            path="/hygienic-risk"
            element={protectedShell(<HygienicRiskDashboardPage />)}
          />

          {/* ---- Legacy pages (top NavBar) ---- */}
          <Route
            path="/mobile-report"
            element={legacyProtected(MobileReportPage)}
          />
          <Route path="/map" element={protectedShell(<MapPage />)} />
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
            path="/animals"
            element={protectedShell(<AnimalDetectionPage />)}
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
            element={protectedShell(<AlertsNotificationsPage />)}
          />
          <Route
            path="/reports"
            element={protectedShell(<ReportsPage />)}
          />
          <Route
            path="/history"
            element={protectedShell(<HistoryPage />)}
          />
          {/* IoT Devices replaced by /bins — keep route as redirect for legacy links. */}
          <Route
            path="/devices"
            element={<Navigate to="/bins" replace />}
          />
          <Route
            path="/bins"
            element={protectedShell(<BinStatusPage />)}
          />

          {/* Anything else falls back to the landing page. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
