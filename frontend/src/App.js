import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DashboardRouteFallback from "./components/dashboard/DashboardRouteFallback";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import "./App.css";

const SystemDashboardPage = lazy(() => import("./pages/SystemDashboardPage"));
const LiveMonitoringPage = lazy(() => import("./pages/LiveMonitoringPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const HygienicRiskDashboardPage = lazy(
  () => import("./pages/HygienicRiskDashboardPage")
);
const MobileReportPage = lazy(() => import("./pages/MobileReportPage"));
const MapPage = lazy(() => import("./pages/MapPage"));
const BinDetailPage = lazy(() => import("./pages/BinDetailPage"));
const DashboardSettingsPage = lazy(() => import("./pages/DashboardSettingsPage"));
const ForecastPage = lazy(() => import("./pages/ForecastPage"));
const BinStatusPage = lazy(() => import("./pages/BinStatusPage"));
const AnimalDetectionPage = lazy(() => import("./pages/AnimalDetectionPage"));
const AlertsNotificationsPage = lazy(
  () => import("./pages/AlertsNotificationsPage")
);
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const LitterSeverityPage = lazy(() => import("./pages/LitterSeverityPage"));
const LitteringEventPage = lazy(() => import("./pages/LitteringEventPage"));
const SpeakerCheckPage = lazy(() => import("./pages/SpeakerCheckPage"));

const protectedShell = (el) => (
  <ProtectedRoute>
    <Suspense fallback={<DashboardRouteFallback />}>{el}</Suspense>
  </ProtectedRoute>
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

          {/* ---- Dashboard (authenticated) ---- */}
          <Route
            path="/dashboard"
            element={protectedShell(<SystemDashboardPage />)}
          />
          <Route
            path="/system"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/live-monitoring"
            element={protectedShell(<LiveMonitoringPage />)}
          />
          <Route
            path="/bin-level-detector"
            element={protectedShell(<HomePage />)}
          />
          <Route
            path="/bin-fill"
            element={<Navigate to="/bin-level-detector" replace />}
          />
          <Route
            path="/hygienic-risk"
            element={protectedShell(<HygienicRiskDashboardPage />)}
          />
          <Route
            path="/mobile-report"
            element={protectedShell(<MobileReportPage />)}
          />
          <Route path="/map" element={protectedShell(<MapPage />)} />
          <Route
            path="/bins/:id"
            element={protectedShell(<BinDetailPage />)}
          />
          <Route
            path="/admin"
            element={protectedShell(<DashboardSettingsPage />)}
          />
          <Route
            path="/admin/bins"
            element={<Navigate to="/bins" replace />}
          />
          <Route
            path="/animals"
            element={protectedShell(<AnimalDetectionPage />)}
          />
          <Route
            path="/litter-severity"
            element={protectedShell(<LitterSeverityPage />)}
          />
          <Route
            path="/littering-event"
            element={protectedShell(<LitteringEventPage />)}
          />
          <Route
            path="/forecast"
            element={protectedShell(<ForecastPage />)}
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
          <Route
            path="/speaker"
            element={protectedShell(<SpeakerCheckPage />)}
          />
          <Route path="/devices" element={<Navigate to="/bins" replace />} />
          <Route path="/bins" element={protectedShell(<BinStatusPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
