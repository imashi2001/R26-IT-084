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
import "./App.css";

/*
 * Route layout uses TWO shells:
 *
 *   <LegacyShell>  - renders the existing top NavBar above each page so
 *                    teammate-owned pages (HomePage, MapPage, BinDetailPage,
 *                    AdminPage, MobileReportPage, HygienicRiskDashboardPage)
 *                    keep their current look exactly.
 *
 *   <SystemDashboardPage> - opts INTO `DashboardLayout` (sidebar + topbar)
 *                    instead of NavBar, isolating the new UI from legacy.
 *
 * This keeps the merge surface tiny: only this file changed, and only by
 * adding one route + a thin LegacyShell wrapper.
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
          {/* New system dashboard — owns its own shell (no legacy NavBar). */}
          <Route path="/system" element={<SystemDashboardPage />} />

          {/* Legacy pages keep the existing top NavBar. */}
          <Route path="/" element={<LegacyShell><HomePage /></LegacyShell>} />
          <Route path="/hygienic-risk" element={<LegacyShell><HygienicRiskDashboardPage /></LegacyShell>} />
          <Route path="/mobile-report" element={<LegacyShell><MobileReportPage /></LegacyShell>} />
          <Route path="/map" element={<LegacyShell><MapPage /></LegacyShell>} />
          <Route path="/bins/:id" element={<LegacyShell><BinDetailPage /></LegacyShell>} />
          <Route path="/admin" element={<LegacyShell><AdminPage /></LegacyShell>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
