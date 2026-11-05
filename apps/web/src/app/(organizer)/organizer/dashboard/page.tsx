"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OperationsWorkspace } from "@/components/organizer/operations/workspace";
function Dashboard() {
  const params = useSearchParams();
  return <OperationsWorkspace eventId={params.get("eventId") ?? ""} />;
}
export default function OrganizerDashboardPage() {
  return (
    <Suspense fallback={<p>Đang tải...</p>}>
      <Dashboard />
    </Suspense>
  );
}
