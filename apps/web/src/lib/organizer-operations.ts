import { z } from "zod";
import {
  OrganizerOperationEventsSchema,
  OrganizerGatesSchema,
  OrganizerStaffListSchema,
  OrganizerStaffAccountsSchema,
  OrganizerStaffAccountSchema,
  CreateOrganizerStaffSchema,
  UpdateOrganizerStaffSchema,
  OrganizerAssignRequestSchema,
  OrganizerAssignmentSchema,
  OrganizerGateRequestSchema,
  OrganizerReportResponseSchema,
  OrganizerExportJobSchema,
  OrganizerExportCreatedSchema,
  OrganizerCheckinsSchema,
  type OrganizerReportResponse,
  type OrganizerReport,
  type OrganizerExportFormat,
  type OrganizerExportJob,
} from "@tickethub/shared";
import {
  apiClient,
  ApiError,
  getAccessToken,
  setAccessToken,
} from "./api/client";
export function operationPath(eventId: string) {
  return `/organizer/events/${z.string().uuid().parse(eventId)}`;
}
export const operationKeys = {
  events: ["w05", "events"] as const,
  staff: (id: string) => ["w05", "assignments", id] as const,
  accounts: (page: number) => ["w05", "accounts", page] as const,
  gates: (id: string) => ["w05", id, "gates"] as const,
  report: (id: string) => ["w05", id, "report"] as const,
  monitor: (id: string, page = 1) => ["w05", id, "checkins", page] as const,
  export: (id: string, jobId: string) => ["w05", id, "export", jobId] as const,
};
export function reportPeriod(from: string, to: string) {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(from) || !validDate(to) || from > to)
    throw new Error(
      "Vui lòng chọn khoảng ngày hợp lệ, ngày bắt đầu không sau ngày kết thúc.",
    );
  return {
    fromDate: new Date(`${from}T00:00:00+07:00`).toISOString(),
    toDate: new Date(
      Date.parse(`${to}T00:00:00+07:00`) + 86_400_000,
    ).toISOString(),
  };
}
export const operationMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    value,
  );
export const operationTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
export function todayVietnam(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function operationUnavailable(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 404 || error.status === 501)
  );
}
export function operationError(error: unknown): string {
  if (error instanceof ApiError) {
    if (operationUnavailable(error))
      return "Chức năng này chưa sẵn sàng cho sự kiện. Vui lòng thử lại sau hoặc liên hệ quản trị.";
    if (error.status === 401)
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    if (error.status === 403)
      return "Bạn không có quyền thực hiện thao tác này với sự kiện đã chọn.";
    if (error.status === 410)
      return "Tệp báo cáo đã hết hạn. Vui lòng tạo yêu cầu xuất mới.";
    if (error.status === 0)
      return "Không kết nối được máy chủ. Dữ liệu hiện có có thể chưa cập nhật.";
    return error.message;
  }
  if (error instanceof z.ZodError)
    return "Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại hoặc liên hệ hỗ trợ.";
  return error instanceof Error
    ? error.message
    : "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}
export function selectOrganizerReport(
  raw: OrganizerReportResponse,
  eventId: string,
  period: { fromDate: string; toDate: string },
): OrganizerReport {
  if (
    (raw.summary && raw.summary.event_id !== eventId) ||
    raw.sales.some((row) => row.event_id !== eventId)
  )
    throw new Error("Báo cáo không thuộc sự kiện đã chọn.");
  const from = todayVietnam(new Date(period.fromDate)),
    to = todayVietnam(new Date(Date.parse(period.toDate) - 1));
  const days = new Map<string, { cents: number; sold: number }>();
  const types = new Map<
    string,
    { name: string; cents: number; sold: number; checkedIn: number }
  >();
  for (const row of raw.sales) {
    if (row.sale_date < from || row.sale_date > to) continue;
    const cents = Math.round(row.paid_revenue * 100);
    const day = days.get(row.sale_date) ?? { cents: 0, sold: 0 };
    day.cents += cents;
    day.sold += row.total_sold_tickets;
    days.set(row.sale_date, day);
    const type = types.get(row.ticket_type_id) ?? {
      name: row.ticket_type_name,
      cents: 0,
      sold: 0,
      checkedIn: 0,
    };
    type.cents += cents;
    type.sold += row.total_sold_tickets;
    type.checkedIn += row.total_checked_in_tickets;
    types.set(row.ticket_type_id, type);
    if (
      !Number.isSafeInteger(day.cents) ||
      !Number.isSafeInteger(type.cents) ||
      !Number.isSafeInteger(day.sold) ||
      !Number.isSafeInteger(type.sold) ||
      !Number.isSafeInteger(type.checkedIn)
    )
      throw new Error(
        "Báo cáo vượt giới hạn số liệu có thể hiển thị chính xác.",
      );
  }
  const summary = raw.summary;
  return {
    eventId,
    ...period,
    generatedAt: summary?.refreshed_at ?? null,
    summary: summary
      ? {
          grossRevenue: summary.paid_revenue,
          refundAmount: summary.total_refunded_amount,
          netRevenue: summary.net_revenue,
          ticketsSold: summary.total_sold_tickets,
          ticketsCheckedIn: summary.total_checked_in_tickets,
          listedRevenue: summary.gross_revenue,
        }
      : null,
    revenueSeries: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, point]) => ({
        date,
        revenueVnd: point.cents / 100,
        soldTickets: point.sold,
      })),
    ticketTypes: [...types.entries()].map(([id, type]) => ({
      id,
      name: type.name,
      sold: type.sold,
      checkedIn: type.checkedIn,
      revenueVnd: type.cents / 100,
    })),
  };
}
async function localStaffMutation(
  path: string,
  method: "PATCH" | "DELETE",
  body?: unknown,
  retry = false,
): Promise<unknown> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(`/api/organizer-operations${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Không kết nối được máy chủ.");
  }
  if (response.status === 401 && !retry) {
    try {
      const refreshed = z.object({ accessToken: z.string().min(1) }).parse(
        await apiClient<unknown>("/auth/refresh", {
          method: "POST",
          body: "{}",
        }),
      );
      setAccessToken(refreshed.accessToken);
      return localStaffMutation(path, method, body, true);
    } catch {
      throw new ApiError(401, "UNAUTHORIZED", "Phiên đăng nhập đã hết hạn.");
    }
  }
  const raw: unknown = await response.json().catch(() => null);
  const parsed = z
    .object({
      success: z.boolean().optional(),
      data: z.unknown().optional(),
      error: z
        .object({ code: z.string().optional(), message: z.string().optional() })
        .optional(),
    })
    .safeParse(raw);
  if (!response.ok || (parsed.success && parsed.data.success === false))
    throw new ApiError(
      response.status,
      parsed.success
        ? parsed.data.error?.code || "REQUEST_FAILED"
        : "REQUEST_FAILED",
      parsed.success
        ? parsed.data.error?.message ||
            "Không thể cập nhật nhân viên. Vui lòng kiểm tra quyền và thử lại."
        : "Phản hồi không hợp lệ.",
    );
  if (
    !parsed.success ||
    parsed.data.success !== true ||
    parsed.data.data === undefined
  )
    throw new Error("Phản hồi cập nhật nhân viên không hợp lệ.");
  return parsed.data.data;
}
export const organizerOperations = {
  events: async () =>
    OrganizerOperationEventsSchema.parse(
      await apiClient<unknown>("/organizer/events"),
    ),
  gates: async (id: string) => {
    const gates = OrganizerGatesSchema.parse(
      await apiClient<unknown>(`${operationPath(id)}/gates`),
    );
    if (gates.some((gate) => gate.eventId !== id))
      throw new Error("Cổng không thuộc sự kiện đã chọn.");
    return gates;
  },
  createGate: async (id: string, input: unknown) => {
    const gate = OrganizerGatesSchema.element.parse(
      await apiClient<unknown>(`${operationPath(id)}/gates`, {
        method: "POST",
        body: JSON.stringify(OrganizerGateRequestSchema.parse(input)),
      }),
    );
    if (gate.eventId !== id)
      throw new Error("Cổng không thuộc sự kiện đã chọn.");
    return gate;
  },
  staff: async (id: string) =>
    OrganizerStaffListSchema.parse(
      await apiClient<unknown>(`${operationPath(id)}/staff`),
    ),
  accounts: async (page: number) =>
    OrganizerStaffAccountsSchema.parse(
      await apiClient<unknown>(`/organizer/staff?page=${page}&limit=20`),
    ),
  createStaff: async (input: unknown) =>
    OrganizerStaffAccountSchema.parse(
      await apiClient<unknown>("/organizer/staff", {
        method: "POST",
        body: JSON.stringify(CreateOrganizerStaffSchema.parse(input)),
      }),
    ),
  updateStaff: async (staffId: string, input: unknown) => {
    const staff = OrganizerStaffAccountSchema.parse(
      await localStaffMutation(
        `/staff/${z.string().uuid().parse(staffId)}`,
        "PATCH",
        UpdateOrganizerStaffSchema.parse(input),
      ),
    );
    if (staff.id !== staffId) throw new Error("Tài khoản phản hồi không khớp.");
    return staff;
  },
  assign: async (id: string, input: unknown) => {
    const body = OrganizerAssignRequestSchema.parse(input);
    const data = OrganizerAssignmentSchema.parse(
      await apiClient<unknown>(`${operationPath(id)}/staff`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    if (
      data.eventId !== id ||
      data.userId !== body.userId ||
      data.gateId !== body.gateId
    )
      throw new Error("Phân công phản hồi không khớp yêu cầu.");
    return data;
  },
  unassign: async (id: string, staffId: string) =>
    z
      .object({ removed: z.literal(true) })
      .parse(
        await localStaffMutation(
          `/events/${z.string().uuid().parse(id)}/staff/${z.string().uuid().parse(staffId)}`,
          "DELETE",
        ),
      ),
  report: async (id: string) => {
    const report = OrganizerReportResponseSchema.parse(
      await apiClient<unknown>(`${operationPath(id)}/reports`),
    );
    if (
      (report.summary && report.summary.event_id !== id) ||
      report.sales.some((row) => row.event_id !== id)
    )
      throw new Error("Báo cáo không thuộc sự kiện đã chọn.");
    return report;
  },
  createExport: async (id: string, format: OrganizerExportFormat) => {
    const job = OrganizerExportCreatedSchema.parse(
      await apiClient<unknown>(`${operationPath(id)}/reports/exports`, {
        method: "POST",
        body: JSON.stringify({ format }),
      }),
    );
    if (job.format !== format) throw new Error("Định dạng tác vụ không khớp.");
    return {
      ...job,
      eventId: id,
      expiresAt: null,
      errorMessage: null,
      downloadUrl: null,
    };
  },
  exportJob: async (id: string, jobId: string): Promise<OrganizerExportJob> => {
    const job = OrganizerExportJobSchema.parse(
      await apiClient<unknown>(
        `${operationPath(id)}/reports/exports/${z.string().uuid().parse(jobId)}`,
      ),
    );
    if (job.id !== jobId) throw new Error("Mã tác vụ xuất báo cáo không khớp.");
    return { ...job, eventId: id };
  },
  monitor: async (id: string, page: number) => {
    const rows = OrganizerCheckinsSchema.parse(
      await apiClient<unknown>(
        `${operationPath(id)}/checkins?page=${page}&limit=50`,
      ),
    );
    if (rows.some((row) => row.eventId !== id))
      throw new Error("Lịch sử không thuộc sự kiện đã chọn.");
    return rows;
  },
};
export async function downloadOperationExport(
  job: OrganizerExportJob,
  fetcher: typeof fetch = fetch,
) {
  if (
    job.status !== "COMPLETED" ||
    !job.expiresAt ||
    Date.parse(job.expiresAt) <= Date.now()
  )
    throw new Error(
      "Báo cáo chưa sẵn sàng hoặc liên kết đã hết hạn. Vui lòng tạo tác vụ mới.",
    );
  const base =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
  const token = getAccessToken();
  const response = await fetcher(
    `${base}${operationPath(job.eventId)}/reports/exports/${z.string().uuid().parse(job.id)}/download`,
    {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      redirect: "error",
    },
  );
  if (!response.ok)
    throw new ApiError(
      response.status,
      "DOWNLOAD_FAILED",
      "Không tải được báo cáo. Vui lòng kiểm tra phiên đăng nhập và thử lại.",
    );
  const mime = response.headers.get("content-type")?.split(";")[0]?.trim();
  const allowed =
    job.format === "csv"
      ? ["text/csv", "application/csv"]
      : ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
  if (!mime || !allowed.includes(mime))
    throw new Error("Máy chủ không trả về định dạng báo cáo đã yêu cầu.");
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("Tệp báo cáo trống. Vui lòng thử lại.");
  return blob;
}
