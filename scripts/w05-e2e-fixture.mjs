import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
if (process.env.W05_ISOLATED_TEST !== "true")
  throw new Error("Chỉ chạy fixture trên database test riêng.");
const base = process.env.W05_API_URL || "http://localhost:4000/api/v1";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Fixture chỉ hỗ trợ API kiểm thử local.");
async function request(path, token, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Fixture ${path}: HTTP ${response.status}`);
  return payload.data ?? payload;
}
const login = async (email) =>
  (await request("/auth/login", null, { email, password: "Password123!" }))
    .accessToken;
const organizer = await login("organizer@tickethub.vn"),
  admin = await login("admin@tickethub.vn"),
  buyer = await login("buyer@tickethub.vn");
const now = Date.now(),
  iso = (offset) => new Date(now + offset).toISOString();
const event = await request("/organizer/events", organizer, {
  title: "W05 FE1 - Kiểm thử vận hành",
  slug: `w05-fe1-operations-${now}`,
  description: "Sự kiện kiểm thử riêng cho chức năng nhân viên và báo cáo W05.",
  category: "CONCERT",
  bannerUrl: "http://localhost:3000/file.svg",
  venueName: "Địa điểm kiểm thử",
  venueAddress: "Địa chỉ kiểm thử local",
  city: "Hà Nội",
  startTime: iso(3600000),
  endTime: iso(14400000),
  gateOpeningTime: iso(-1800000),
  isWaitingRoomEnabled: false,
  refundPolicyType: "FLEXIBLE",
  refundPolicyRules: [],
  ticketTypes: [
    {
      name: "Khu GA kiểm thử",
      price: 600000,
      capacity: 50,
      isSeated: false,
      saleStartTime: iso(-3600000),
      saleEndTime: iso(1800000),
      maxPerOrder: 6,
      sortOrder: 1,
    },
  ],
});
const submitted = await request(
  `/organizer/events/${event.id}/submit`,
  organizer,
  {},
);
await request(`/admin/events/${event.id}/approve`, admin, {
  version: submitted.version,
});
const detail = await request(`/organizer/events/${event.id}`, organizer);
const held = await request("/booking/hold", buyer, {
  eventId: event.id,
  items: [{ ticketTypeId: detail.ticketTypes[0].id, quantity: 2 }],
});
const payment = await request(
  `/payments/orders/${held.orderId}/vnpay`,
  buyer,
  {},
);
const params = new URLSearchParams({
  vnp_TmnCode: process.env.W05_VNPAY_TEST_TMN || "W05LOCALTEST",
  vnp_TxnRef: payment.transactionRef,
  vnp_Amount: String(payment.amountVnd * 100),
  vnp_ResponseCode: "00",
  vnp_TransactionStatus: "00",
  vnp_TransactionNo: String(now),
  vnp_PayDate: "20261106010000",
});
params.sort();
params.set(
  "vnp_SecureHash",
  createHmac(
    "sha512",
    process.env.W05_VNPAY_TEST_SECRET || "w05-local-signature-fixture-only",
  )
    .update(params.toString())
    .digest("hex"),
);
const ipn = await request(`/payments/vnpay/ipn?${params}`);
if (ipn.RspCode !== "00")
  throw new Error(`IPN fixture chưa thành công: ${ipn.RspCode}`);
const order = await request(`/buyer/orders/${held.orderId}`, buyer);
if (order.status !== "PAID" || order.tickets.length !== 2)
  throw new Error("Đơn fixture chưa được cấp vé thật.");
const fixture = {
  eventId: event.id,
  eventTitle: event.title,
  orderId: held.orderId,
  expectedPaidRevenue: payment.amountVnd,
  ticketId: order.tickets[0].id,
  ticketCode: order.tickets[0].ticketCode,
};
await writeFile(
  process.env.W05_FIXTURE_PATH || "/tmp/w05-e2e-fixture.json",
  JSON.stringify(fixture),
  { mode: 0o600 },
);
console.log(
  `Đã tạo fixture W05 qua API thật, sự kiện ${event.id}, đơn PAID và 2 vé.`,
);
