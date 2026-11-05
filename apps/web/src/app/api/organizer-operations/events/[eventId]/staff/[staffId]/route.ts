import { proxyOrganizerMutation } from "@/lib/api/organizer-operations-proxy";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string; staffId: string }> },
) {
  return proxyOrganizerMutation(request, await params);
}
