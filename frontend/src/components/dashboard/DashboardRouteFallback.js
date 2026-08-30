import DashboardLayout from "./DashboardLayout";
import PageSkeleton from "./PageSkeleton";

export default function DashboardRouteFallback() {
  return (
    <DashboardLayout>
      <PageSkeleton rows={3} />
    </DashboardLayout>
  );
}
