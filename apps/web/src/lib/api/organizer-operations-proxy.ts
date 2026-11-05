import { z } from "zod";
const api =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000/api/v1";
export async function proxyOrganizerMutation(
  request: Request,
  target: { staffId: string; eventId?: string },
) {
  if (
    !z.string().uuid().safeParse(target.staffId).success ||
    (target.eventId !== undefined &&
      !z.string().uuid().safeParse(target.eventId).success)
  )
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_ID", message: "Mã định danh không hợp lệ." },
      },
      { status: 400 },
    );
  const method = target.eventId ? "DELETE" : "PATCH";
  if (request.method !== method) return new Response(null, { status: 405 });
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length <= 7)
    return Response.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." },
      },
      { status: 401 },
    );
  const path = target.eventId
    ? `/organizer/events/${target.eventId}/staff/${target.staffId}`
    : `/organizer/staff/${target.staffId}`;
  const body = method === "PATCH" ? await request.text() : undefined;
  try {
    const response = await fetch(`${api}${path}`, {
      method,
      headers: {
        Authorization: authorization,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
      cache: "no-store",
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Máy chủ chưa phản hồi. Vui lòng thử lại.",
        },
      },
      { status: 503 },
    );
  }
}
