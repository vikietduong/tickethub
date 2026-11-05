import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
let server: http.Server;
let status = 403;
let seenPath = "";
let seenAuth = "";
let seenBody = "";
let proxy: typeof import("../src/lib/api/organizer-operations-proxy.ts").proxyOrganizerMutation;
const staffId = "11111111-1111-4111-8111-111111111111",
  eventId = "22222222-2222-4222-8222-222222222222";
before(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (part) => {
      body += String(part);
    });
    req.on("end", () => {
      seenPath = req.url ?? "";
      seenAuth = req.headers.authorization ?? "";
      seenBody = body;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: status === 200,
          data: status === 200 ? { removed: true } : null,
          error: status === 200 ? undefined : { code: "FORBIDDEN" },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  proxy = (await import("../src/lib/api/organizer-operations-proxy.ts"))
    .proxyOrganizerMutation;
});
after(() => {
  server.close();
});
function request(method: "PATCH" | "DELETE", auth = true) {
  return new Request("http://localhost/api/organizer-operations", {
    method,
    headers: {
      ...(auth ? { Authorization: "Bearer transport-unit-fixture" } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "LOCKED" }),
  });
}
test("Proxy từ chối thiếu token và mã không hợp lệ trước khi gọi backend", async () => {
  assert.equal((await proxy(request("PATCH", false), { staffId })).status, 401);
  assert.equal(
    (await proxy(request("PATCH"), { staffId: "../admin" })).status,
    400,
  );
});
test("PATCH giữ nguyên lỗi 403 và chuyển đúng bearer/body tới endpoint tài khoản", async () => {
  status = 403;
  const response = await proxy(request("PATCH"), { staffId });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).success, false);
  assert.equal(seenPath, `/api/v1/organizer/staff/${staffId}`);
  assert.equal(seenAuth, "Bearer transport-unit-fixture");
  assert.equal(seenBody, '{"status":"LOCKED"}');
});
test("DELETE chỉ chuyển đúng endpoint gỡ phân công, không tạo thành công khi backend lỗi", async () => {
  status = 404;
  assert.equal(
    (await proxy(request("DELETE"), { eventId, staffId })).status,
    404,
  );
  assert.equal(
    seenPath,
    `/api/v1/organizer/events/${eventId}/staff/${staffId}`,
  );
  status = 200;
  const response = await proxy(request("DELETE"), { eventId, staffId });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.removed, true);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
