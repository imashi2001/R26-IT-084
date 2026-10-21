"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AlertsNotificationsPage from "@/views/AlertsNotificationsPage";

export default function Page() {
  return (
    <ProtectedRoute>
      <AlertsNotificationsPage />
    </ProtectedRoute>
  );
}
