import { proxyOrganizerMutation } from "@/lib/api/organizer-operations-proxy";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ staffId: string }> },
) {
  return proxyOrganizerMutation(request, await params);
}
