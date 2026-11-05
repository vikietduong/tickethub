import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrganizerReportResponseSchema } from "@tickethub/shared";
import { ReportView } from "../src/components/organizer/operations/report-panel.tsx";
import {
  reportPeriod,
  selectOrganizerReport,
} from "../src/lib/organizer-operations.ts";
import {
  reportResponseFixture,
  operationEventId,
} from "./fixtures/organizer-report.ts";
const period = reportPeriod("2026-11-01", "2026-11-02");
test("Báo cáo hiển thị tiền backend cung cấp, tỷ lệ và bảng thay thế biểu đồ", () => {
  const report = selectOrganizerReport(
    OrganizerReportResponseSchema.parse(reportResponseFixture),
    operationEventId,
    period,
  );
  const html = renderToStaticMarkup(createElement(ReportView, { report }));
  assert.match(html, /1\.200\.000/);
  assert.match(html, /1\.000\.000/);
  assert.match(html, /200\.000/);
  assert.match(html, /50%/);
  assert.match(html, /Khu GA/);
  assert.match(html, /Tổng quan toàn bộ sự kiện/);
  assert.match(html, /role="img"/);
  assert.match(html, /Xem bảng số liệu theo ngày/);
  assert(!html.includes("NaN"));
  assert(!html.includes("Infinity"));
});
test("summary null hiển thị chưa có cập nhật thay vì tự tạo số tiền 0", () => {
  const report = selectOrganizerReport(
    { summary: null, sales: [] },
    operationEventId,
    period,
  );
  const html = renderToStaticMarkup(createElement(ReportView, { report }));
  assert.match(html, /Báo cáo chưa có bản cập nhật/);
  assert(!html.includes("<polyline"));
  assert(!html.includes("<dd"));
});
