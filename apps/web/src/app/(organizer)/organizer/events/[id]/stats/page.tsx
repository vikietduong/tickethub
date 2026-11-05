"use client";
import { use } from "react";
import { OperationsWorkspace } from "@/components/organizer/operations/workspace";
export default function OperationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <OperationsWorkspace eventId={id} view="stats" />;
}
