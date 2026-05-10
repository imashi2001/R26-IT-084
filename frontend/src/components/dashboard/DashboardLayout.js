import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

/*
 * Layout shell for the new system dashboard.
 *
 * Composition:
 *   ┌─────────┬──────────────────────────────┐
 *   │ Sidebar │ TopBar                       │
 *   │         ├──────────────────────────────┤
 *   │         │ children (page content)      │
 *   └─────────┴──────────────────────────────┘
 *
 * - Sidebar collapses on mobile via the menu button in TopBar (state held here
 *   so children don't have to thread a prop).
 * - Light backdrop (`bg-slate-50`) chosen to match the mockup; the dark slate
 *   theme is reserved for the existing /hygienic-risk page so visuals stay
 *   distinct between Imashi's risk dashboard and the system dashboard.
 * - Layout intentionally does NOT render the legacy `<NavBar />`. Pages that
 *   want NavBar should not use this component.
 */

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-ink-900">
      {sidebarOpen ? <Sidebar /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-x-hidden p-6">{children}</main>
        <footer className="border-t border-slate-200 bg-white px-6 py-3 text-xs text-ink-500 flex items-center justify-between">
          <span>
            © {new Date().getFullYear()} VisionWaste — Smart Waste Monitoring
            System. All rights reserved.
          </span>
          <span>Version 1.0.0</span>
        </footer>
      </div>
    </div>
  );
}
