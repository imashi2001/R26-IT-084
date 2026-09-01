import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardRouteFallback from "./components/dashboard/DashboardRouteFallback";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { lazyWithRetry } from "./utils/lazyWithRetry";
import "./App.css";

const SystemDashboardPage = lazyWithRetry(() => import("./pages/SystemDashboardPage"));
const LiveMonitoringPage = lazyWithRetry(() => import("./pages/LiveMonitoringPage"));
const HomePage = lazyWithRetry(() => import("./pages/HomePage"));
const HygienicRiskDashboardPage = lazyWithRetry(
  () => import("./pages/HygienicRiskDashboardPage")
);
const MobileReportPage = lazyWithRetry(() => import("./pages/MobileReportPage"));
const MapPage = lazyWithRetry(() => import("./pages/MapPage"));
const BinDetailPage = lazyWithRetry(() => import("./pages/BinDetailPage"));
const DashboardSettingsPage = lazyWithRetry(() => import("./pages/DashboardSettingsPage"));
const ForecastPage = lazyWithRetry(() => import("./pages/ForecastPage"));
const WasteUpdatePage = lazyWithRetry(() => import("./pages/WasteUpdatePage"));
const BinStatusPage = lazyWithRetry(() => import("./pages/BinStatusPage"));
const AnimalDetectionPage = lazyWithRetry(() => import("./pages/AnimalDetectionPage"));
const AlertsNotificationsPage = lazyWithRetry(
  () => import("./pages/AlertsNotificationsPage")
);
const ReportsPage = lazyWithRetry(() => import("./pages/ReportsPage"));
const HistoryPage = lazyWithRetry(() => import("./pages/HistoryPage"));
const LitterSeverityPage = lazyWithRetry(() => import("./pages/LitterSeverityPage"));
const LitteringEventPage = lazyWithRetry(() => import("./pages/LitteringEventPage"));
const SpeakerCheckPage = lazyWithRetry(() => import("./pages/SpeakerCheckPage"));

const protectedShell = (el) => (
  <ProtectedRoute>
    <ErrorBoundary>
      <Suspense fallback={<DashboardRouteFallback />}>{el}</Suspense>
    </ErrorBoundary>
  </ProtectedRoute>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ---- Public ---- */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
            path="/waste-update"
            element={protectedShell(<WasteUpdatePage />)}
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
