import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import DashboardAlertPopup from "./DashboardAlertPopup";
import useDashboardAlertPopup from "../../hooks/useDashboardAlertPopup";
import {
  unlockAlertAudio,
  requestDashboardNotificationPermission,
} from "../../utils/alertSound";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { alert, pendingCount, dismiss, dismissAll } = useDashboardAlertPopup();

  useEffect(() => {
    const unlock = () => {
      unlockAlertAudio();
      requestDashboardNotificationPermission();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[#0b131e] font-sans text-slate-200">
      <div className="pointer-events-none fixed inset-0 bg-dashboard-radial" aria-hidden />
      {sidebarOpen ? <Sidebar /> : null}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-x-hidden px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
        <footer className="relative flex items-center justify-between border-t border-slate-800/80 bg-slate-950/80 px-6 py-3 text-xs text-slate-500 backdrop-blur-sm">
          <span>
            © {new Date().getFullYear()} VisionWaste — Smart Waste Monitoring
            System
          </span>
          <span className="text-slate-600">v1.0.0</span>
        </footer>
      </div>

      <DashboardAlertPopup
        alert={alert}
        pendingCount={pendingCount}
        onDismiss={dismiss}
        onDismissAll={dismissAll}
      />
    </div>
  );
}
