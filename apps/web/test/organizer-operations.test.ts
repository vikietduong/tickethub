import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OrganizerReportResponseSchema,
  OrganizerCheckinsSchema,
  CreateOrganizerStaffSchema,
  UpdateOrganizerStaffSchema,
  OrganizerAssignRequestSchema,
  OrganizerExportJobSchema,
} from "@tickethub/shared";
import {
  reportPeriod,
  operationPath,
  operationKeys,
  operationError,
  todayVietnam,
  downloadOperationExport,
  selectOrganizerReport,
} from "../src/lib/organizer-operations.ts";
import { ApiError } from "../src/lib/api/client.ts";
import {
  reportResponseFixture,
  operationEventId as eventId,
  operationJobId as jobId,
} from "./fixtures/organizer-report.ts";
const period = reportPeriod("2026-11-01", "2026-11-02");
test("Bộ lọc ngày Việt Nam bao gồm cả ngày cuối và chuyển UTC chính xác", () => {
  assert.deepEqual(period, {
    fromDate: "2026-10-31T17:00:00.000Z",
    toDate: "2026-11-02T17:00:00.000Z",
  });
  assert.equal(
    reportPeriod("2026-12-31", "2026-12-31").toDate,
    "2026-12-31T17:00:00.000Z",
  );
  assert.equal(todayVietnam(new Date("2026-11-05T18:00:00Z")), "2026-11-06");
});
test("Không dùng ngày rỗng, ngày không tồn tại hoặc khoảng đảo ngược", () => {
  for (const [from, to] of [
    ["", "2026-11-01"],
    ["2026-02-30", "2026-03-01"],
    ["2026-12-01", "2026-11-01"],
    ["2026-1-1", "2026-11-01"],
  ])
    assert.throws(() => reportPeriod(from!, to!));
});
test("Cache và đường dẫn tách riêng sự kiện, không chấp nhận path tùy ý", () => {
  assert.notDeepEqual(operationKeys.staff(eventId), operationKeys.staff(jobId));
  assert.notDeepEqual(
    operationKeys.monitor(eventId),
    operationKeys.monitor(jobId),
  );
  assert.notDeepEqual(
    operationKeys.report(eventId),
    operationKeys.report(jobId),
  );
  assert.throws(() => operationPath("../admin"));
});
test("Tạo tài khoản và phân công là hai hợp đồng riêng, password tối thiểu 12 ký tự", () => {
  const input = {
    fullName: " Nguyễn Văn A ",
    email: "staff@example.com",
    password: "Password12345!",
  };
  assert.equal(
    CreateOrganizerStaffSchema.parse(input).fullName,
    "Nguyễn Văn A",
  );
  assert.equal(
    CreateOrganizerStaffSchema.safeParse({ ...input, role: "ADMIN" }).success,
    false,
  );
  assert.equal(
    CreateOrganizerStaffSchema.safeParse({ ...input, gateId: jobId }).success,
    false,
  );
  assert.equal(
    CreateOrganizerStaffSchema.safeParse({ ...input, password: "Password1" })
      .success,
    false,
  );
  assert.equal(UpdateOrganizerStaffSchema.safeParse({}).success, false);
  assert.equal(
    UpdateOrganizerStaffSchema.safeParse({ gateId: jobId }).success,
    false,
  );
  assert.equal(
    OrganizerAssignRequestSchema.safeParse({ userId: eventId, gateId: jobId })
      .success,
    true,
  );
});
test("Đọc decimal/BIGINT của PostgreSQL; thiếu summary không được chuyển thành 0", () => {
  const raw = OrganizerReportResponseSchema.parse(reportResponseFixture);
  const view = selectOrganizerReport(raw, eventId, period);
  assert.equal(view.summary?.grossRevenue, 1200000);
  assert.equal(view.summary?.listedRevenue, 1500000);
  assert.equal(view.summary?.ticketsSold, 2);
  const missing = selectOrganizerReport(
    { summary: null, sales: [] },
    eventId,
    period,
  );
  assert.equal(missing.summary, null);
  assert.equal(missing.generatedAt, null);
  assert.equal(OrganizerReportResponseSchema.safeParse({}).success, false);
  assert.equal(
    OrganizerReportResponseSchema.safeParse({
      ...reportResponseFixture,
      summary: { ...reportResponseFixture.summary, paid_revenue: "NaN" },
    }).success,
    false,
  );
});
test("Chuẩn hóa timestamp PostgreSQL có microsecond và timezone thành ISO cho mọi trình duyệt", () => {
  const fixture = {
    ...reportResponseFixture,
    summary: {
      ...reportResponseFixture.summary,
      refreshed_at: "2026-11-05 18:50:26.749927+00",
    },
  };
  assert.equal(
    OrganizerReportResponseSchema.parse(fixture).summary?.refreshed_at,
    "2026-11-05T18:50:26.749Z",
  );
  assert.equal(
    OrganizerReportResponseSchema.safeParse({
      ...fixture,
      summary: { ...fixture.summary, refreshed_at: "2026-02-30 18:50:26+00" },
    }).success,
    false,
  );
});
test("Lọc và nhóm ngày/hạng vé đúng, không giả vờ tổng quan thay đổi theo ngày", () => {
  const raw = OrganizerReportResponseSchema.parse(reportResponseFixture);
  const all = selectOrganizerReport(raw, eventId, period);
  const day = selectOrganizerReport(
    raw,
    eventId,
    reportPeriod("2026-11-02", "2026-11-02"),
  );
  assert.equal(all.ticketTypes[0]?.sold, 2);
  assert.equal(all.ticketTypes[0]?.revenueVnd, 1200000);
  assert.equal(day.ticketTypes[0]?.sold, 1);
  assert.equal(day.revenueSeries.length, 1);
  assert.deepEqual(day.summary, all.summary);
  assert.throws(() => selectOrganizerReport(raw, jobId, period), /không thuộc/);
});
test("Lịch sử soát vé dùng outcome/method của BE2, không tự tạo staffOnline", () => {
  const logs = OrganizerCheckinsSchema.parse([
    {
      id: jobId,
      eventId,
      ticketId: null,
      gateId: null,
      staffId: eventId,
      method: "MANUAL",
      outcome: "REJECTED",
      reason: "Test",
      errorCode: "INVALID_TICKET",
      checkedInAt: "2026-11-01T00:00:00Z",
    },
  ]);
  assert.equal(logs[0]?.outcome, "REJECTED");
  assert.equal(
    OrganizerCheckinsSchema.safeParse([{ ...logs[0], outcome: "ACCEPTED" }])
      .success,
    false,
  );
});
test("API chưa có, hết hạn file và lỗi phân quyền không bị đổi thành thành công", () => {
  assert.match(
    operationError(new ApiError(404, "NOT_FOUND", "Not Found")),
    /chưa sẵn sàng/,
  );
  assert.match(
    operationError(new ApiError(403, "FORBIDDEN", "Forbidden")),
    /không có quyền/,
  );
  assert.match(
    operationError(new ApiError(410, "EXPIRED", "Expired")),
    /hết hạn/,
  );
});
test("Tệp xuất phải hoàn tất, đúng MIME và không rỗng; không theo redirect mang token", async () => {
  const job = {
    ...OrganizerExportJobSchema.parse({
      id: jobId,
      format: "csv",
      status: "COMPLETED",
      createdAt: "2026-11-01T00:00:00Z",
      expiresAt: "2099-01-01T00:00:00Z",
      errorMessage: null,
      downloadUrl: "/api/v1/ignored",
    }),
    eventId,
  };
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls++;
    assert(String(input).endsWith(`/reports/exports/${jobId}/download`));
    assert.equal(init?.redirect, "error");
    return new Response("ngay,doanhthu\n2026-11-01,600000", {
      headers: { "content-type": "text/csv; charset=utf-8" },
    });
  };
  await assert.rejects(
    downloadOperationExport({ ...job, status: "PENDING" }, fetcher),
  );
  assert.equal(calls, 0);
  assert((await downloadOperationExport(job, fetcher)).size > 0);
  await assert.rejects(
    downloadOperationExport(job, async () =>
      Response.json({ message: "Not Found" }),
    ),
    /định dạng/,
  );
  await assert.rejects(
    downloadOperationExport(
      job,
      async () => new Response("", { headers: { "content-type": "text/csv" } }),
    ),
    /trống/,
  );
  await assert.rejects(
    downloadOperationExport(
      job,
      async () => new Response(null, { status: 403 }),
    ),
    /Không tải được/,
  );
});
