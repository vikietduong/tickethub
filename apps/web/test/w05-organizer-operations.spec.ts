import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { OrganizerOperationEventsSchema } from "@tickethub/shared";
const api = "http://localhost:4000/api/v1";
test.describe.configure({ mode: "serial" });
test.skip(
  process.env.W05_ISOLATED_TEST !== "true" ||
    process.env.W05_BE2_INTEGRATION !== "true",
  "Cần backend BE2 và database test riêng, worker báo cáo, fixture API thật.",
);
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)
  test.use({
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  });
let token: string;
let user: unknown;
let eventId: string;
let eventTitle: string;
let ticketCode: string;
let staffId: string;
let staffEmail: string;
let staffToken: string;
let firstGate: string;
let secondGate: string;
const staffName = `Nhân viên W05 ${Date.now()}`;
const headers = () => ({ Authorization: `Bearer ${token}` });
const staffPassword = "W05-Test-Password123!";
test.beforeAll(async ({ request }) => {
  const fixture = z
    .object({
      eventId: z.string().uuid(),
      eventTitle: z.string(),
      ticketCode: z.string(),
    })
    .parse(
      JSON.parse(
        await readFile(
          process.env.W05_FIXTURE_PATH || "/tmp/w05-e2e-fixture.json",
          "utf8",
        ),
      ),
    );
  eventId = fixture.eventId;
  eventTitle = fixture.eventTitle;
  ticketCode = fixture.ticketCode;
  const login = await request.post(`${api}/auth/login`, {
    data: { email: "organizer@tickethub.vn", password: "Password123!" },
  });
  expect(login.ok()).toBeTruthy();
  const data = (await login.json()).data;
  token = data.accessToken;
  user = data.user;
  const response = await request.get(`${api}/organizer/events`, {
    headers: headers(),
  });
  expect(response.ok()).toBeTruthy();
  const events = OrganizerOperationEventsSchema.parse(
    (await response.json()).data,
  );
  expect(events.items.some((item) => item.id === eventId)).toBe(true);
});
async function loginBrowser(page: Page) {
  await page
    .context()
    .addCookies([
      { name: "accessToken", value: token, url: "http://localhost:3000" },
    ]);
  await page.addInitScript(
    (value) => localStorage.setItem("tickethub_user", JSON.stringify(value)),
    user,
  );
}
test("Chưa đăng nhập không mở được dashboard BTC", async ({ page }) => {
  await page.goto("/organizer/dashboard");
  await expect(page).toHaveURL(/\/auth\?redirect=/);
});
test("Báo cáo đọc tiền thật từ MV; lọc ngày chỉ thay biểu đồ/bảng, không đổi tổng quan", async ({
  page,
}) => {
  await loginBrowser(page);
  await page.goto("/organizer/dashboard");
  await page.getByLabel("Sự kiện", { exact: true }).selectOption(eventId);
  await expect(
    page.getByRole("heading", { name: eventTitle, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tiền vé đã thu", { exact: true }).locator(".."),
  ).toContainText("1.200.000");
  await expect(
    page.getByRole("img", {
      name: "Biểu đồ doanh thu vé trước hoàn tiền theo ngày",
    }),
  ).toBeVisible();
  await page.getByLabel("Từ ngày", { exact: true }).fill("2020-01-01");
  await page.getByLabel("Đến ngày", { exact: true }).fill("2020-01-01");
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  await expect(
    page.getByText("Chưa có dữ liệu doanh thu trong khoảng thời gian này."),
  ).toBeVisible();
  await expect(
    page.getByText("Tiền vé đã thu", { exact: true }).locator(".."),
  ).toContainText("1.200.000");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await page.getByLabel("Từ ngày", { exact: true }).fill(today);
  await page.getByLabel("Đến ngày", { exact: true }).fill(today);
  await page.getByRole("button", { name: "Áp dụng bộ lọc" }).click();
  await expect(
    page.getByRole("img", {
      name: "Biểu đồ doanh thu vé trước hoàn tiền theo ngày",
    }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../artifacts/w05-reports.png",
    fullPage: true,
  });
});
test("Tạo tài khoản, tạo cổng và phân công qua API thật; mobile không tràn ngang", async ({
  page,
}) => {
  await loginBrowser(page);
  await page.goto(`/organizer/events/${eventId}/staff`);
  staffEmail = `w05-${Date.now()}@example.com`;
  await page.getByLabel("Họ và tên", { exact: true }).fill(staffName);
  await page.getByLabel("Email", { exact: true }).fill(staffEmail);
  await page
    .getByLabel("Mật khẩu ban đầu", { exact: true })
    .fill(staffPassword);
  const creation = page.waitForResponse(
    (res) =>
      res.request().method() === "POST" &&
      res.url().endsWith("/organizer/staff"),
  );
  await page
    .getByRole("button", { name: "Tạo tài khoản nhân viên", exact: true })
    .click();
  const created = await creation;
  expect(created.status()).toBe(201);
  staffId = (await created.json()).data.id;
  await expect(
    page.getByRole("status").filter({ hasText: "Đã tạo tài khoản" }),
  ).toBeVisible();
  async function makeGate(name: string) {
    await page.getByLabel("Tên cổng mới", { exact: true }).fill(name);
    const response = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().endsWith(`/events/${eventId}/gates`),
    );
    await page.getByRole("button", { name: "Thêm cổng", exact: true }).click();
    const result = await response;
    expect(result.status()).toBe(201);
    return (await result.json()).data.id as string;
  }
  firstGate = await makeGate("Cổng A W05");
  secondGate = await makeGate("Cổng B W05");
  const account = page.getByRole("listitem").filter({ hasText: staffEmail });
  await account.getByRole("combobox").selectOption(firstGate);
  await account.getByRole("button", { name: "Lưu phân công" }).click();
  await expect(
    page
      .getByRole("heading", { name: "Nhân viên được phân công" })
      .locator(".."),
  ).toContainText(staffName);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../artifacts/w05-staff.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../artifacts/w05-staff-mobile.png",
    fullPage: true,
  });
});
test("Khóa/mở khóa tài khoản, đổi cổng và gỡ phân công được xác nhận ở backend", async ({
  page,
  request,
}) => {
  await loginBrowser(page);
  await page.goto(`/organizer/events/${eventId}/staff`);
  const login = await request.post(`${api}/auth/login`, {
    data: { email: staffEmail, password: staffPassword },
  });
  expect(login.ok()).toBeTruthy();
  staffToken = (await login.json()).data.accessToken;
  const account = page.getByRole("listitem").filter({ hasText: staffEmail });
  await account
    .getByRole("button", { name: "Khóa tài khoản", exact: true })
    .click();
  await account.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(account.getByText("Đã khóa", { exact: true })).toBeVisible();
  const locked = await request.post(`${api}/gate/lookup`, {
    headers: { Authorization: `Bearer ${staffToken}` },
    data: {
      eventId,
      ticketCode,
      email: "buyer@tickethub.vn",
      reason: "Test khóa tài khoản",
      gateId: firstGate,
    },
  });
  expect(locked.ok()).toBe(false);
  await account.getByRole("button", { name: "Mở khóa", exact: true }).click();
  await account.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(
    account.getByText("Đang hoạt động", { exact: true }),
  ).toBeVisible();
  await account.getByRole("combobox").selectOption(secondGate);
  await account.getByRole("button", { name: "Lưu phân công" }).click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`${api}/organizer/events/${eventId}/staff`, {
              headers: headers(),
            })
          ).json()
        ).data.find((row: { userId: string }) => row.userId === staffId)
          ?.gateId,
    )
    .toBe(secondGate);
  const assignedSection = page
    .getByRole("heading", { name: "Nhân viên được phân công" })
    .locator("..");
  const assignedRow = assignedSection
    .getByRole("listitem")
    .filter({ hasText: staffName });
  await assignedRow
    .getByRole("button", { name: "Gỡ phân công", exact: true })
    .click();
  await assignedRow
    .getByRole("button", { name: "Xác nhận gỡ", exact: true })
    .click();
  await expect(assignedRow).toHaveCount(0);
  await account.getByRole("combobox").selectOption(firstGate);
  await account.getByRole("button", { name: "Lưu phân công" }).click();
  await expect(assignedSection).toContainText(staffName);
});
test("Giám sát tự nhận check-in thành công và lần quét trùng từ API thật", async ({
  page,
  request,
}) => {
  await loginBrowser(page);
  await page.goto(`/organizer/events/${eventId}/monitor`);
  const input = {
    eventId,
    ticketCode,
    email: "buyer@tickethub.vn",
    reason: "Test giám sát W05",
    gateId: firstGate,
  };
  const success = await request.post(`${api}/gate/lookup`, {
    headers: { Authorization: `Bearer ${staffToken}` },
    data: input,
  });
  expect(success.status()).toBe(200);
  await expect(
    page.getByRole("cell", { name: "Đã check-in", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  const duplicate = await request.post(`${api}/gate/lookup`, {
    headers: { Authorization: `Bearer ${staffToken}` },
    data: input,
  });
  expect(duplicate.ok()).toBe(false);
  await expect(
    page.getByRole("cell").filter({ hasText: "Bị từ chối" }).first(),
  ).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../artifacts/w05-monitor.png",
    fullPage: true,
  });
});
test("Xuất CSV và XLSX chạy qua worker thật và tải được tệp đúng định dạng", async ({
  page,
}) => {
  test.setTimeout(60000);
  await loginBrowser(page);
  await page.goto(`/organizer/events/${eventId}/stats`);
  for (const format of ["csv", "xlsx"]) {
    await page
      .getByLabel("Định dạng báo cáo", { exact: true })
      .selectOption(format);
    const creation = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().endsWith(`/events/${eventId}/reports/exports`),
    );
    await page
      .getByRole("button", { name: "Tạo tệp báo cáo", exact: true })
      .click();
    expect((await creation).status()).toBe(202);
    await expect(
      page.getByRole("status").filter({ hasText: "Tệp báo cáo đã sẵn sàng" }),
    ).toBeVisible({ timeout: 30000 });
    const waiting = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Tải báo cáo", exact: true })
      .click();
    const file = await waiting;
    expect(file.suggestedFilename()).toMatch(new RegExp(`\\.${format}$`));
    const path = await file.path();
    expect(path).toBeTruthy();
    const bytes = await readFile(path!);
    if (format === "csv") {
      expect(bytes.toString("utf8")).toContain(eventTitle);
      expect(bytes.toString("utf8")).toContain("1200000");
    } else {
      expect(bytes.subarray(0, 2).toString()).toBe("PK");
      expect(bytes.includes(Buffer.from("xl/worksheets/sheet1.xml"))).toBe(
        true,
      );
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "../../artifacts/w05-export.png",
    fullPage: true,
  });
});
test("Sự kiện ngoài danh sách quản lý không mở được thao tác, backend cũng trả 404", async ({
  page,
  request,
}) => {
  await loginBrowser(page);
  await page.goto(
    "/organizer/events/00000000-0000-4000-8000-000000000000/staff",
  );
  await expect(
    page.getByRole("alert").filter({
      hasText: "Không tìm thấy sự kiện trong danh sách bạn quản lý",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo tài khoản nhân viên" }),
  ).toHaveCount(0);
  expect(
    (
      await request.get(
        `${api}/organizer/events/00000000-0000-4000-8000-000000000000/reports`,
        { headers: headers() },
      )
    ).status(),
  ).toBe(404);
});
