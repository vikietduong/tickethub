# W05 FE1: Vận hành nhân viên và báo cáo BTC

Nhánh frontend: `feat/w05-fe1-organizer-operations`, xuất phát từ `unstable` tại `db380e153063aa83b94415e694e81f433352822a`. Không chứa thay đổi W04, trang chủ hoặc giao diện mua vé.

## Backend cần dùng

Tích hợp với [nhánh W05 BE2](https://github.com/baam2603/tickethub/tree/feat/w05-be2-staff-reporting), commit đã kiểm thử `3aa1d4b752fa0754cfc496c1cf6368980351df39`. Nhánh `unstable` hiện chưa có các endpoint W05, nên chỉ checkout nhánh frontend này sẽ không đủ để thao tác nhân viên hoặc xem báo cáo.

Code backend không được merge/cherry-pick vào nhánh FE1. Khi kiểm thử, backend BE2 được chạy từ một bản sao riêng với database riêng.

## Phạm vi giao diện

- `/organizer/dashboard`: chọn sự kiện thuộc BTC từ API thật.
- `/organizer/events/[id]/staff`: tạo tài khoản GATE_STAFF, tạo cổng, phân công/đổi cổng, gỡ phân công, khóa/mở khóa tài khoản.
- `/organizer/events/[id]/stats`: tổng quan doanh thu và check-in, biểu đồ theo ngày, bảng theo hạng, bộ lọc ngày Việt Nam, xuất báo cáo nền.
- `/organizer/events/[id]/monitor`: lịch sử soát vé tự cập nhật 5 giây ở trang đầu, phân trang, hiển thị thành công/từ chối và cổng/nhân viên.
- Liên kết Vận hành được thêm trong header và menu tài khoản của cổng BTC, gồm mobile. Không thay header công khai.

## Hợp đồng và giới hạn đã xác minh

1. **Tài khoản và phân công là hai thao tác riêng.** `POST /organizer/staff` chỉ tạo tài khoản; `POST /organizer/events/:eventId/staff` gán `userId` vào `gateId`. UI không báo đã phân công khi mới tạo tài khoản. Mật khẩu tối thiểu 12 ký tự, không lưu vào localStorage hoặc ghi log.
2. **Khóa tài khoản tác động toàn bộ sự kiện.** UI có xác nhận rõ; không hiểu nhầm thành khóa riêng một phân công. Gỡ phân công không xóa tài khoản hoặc lịch sử.
3. **Báo cáo đọc đúng BE2 `{summary,sales}`.** Decimal/BIGINT và timestamp PostgreSQL được kiểm tra, chuyển đổi có giới hạn và chuẩn hóa timezone trước khi hiển thị. `summary: null` là chưa có bản cập nhật, không phải doanh thu 0. Tiền vé đã thu lấy từ `paid_revenue`; tiền hoàn chỉ gồm refund COMPLETED như backend; không tính doanh thu từ giá vé hiện tại nhân số vé.
4. **Bộ lọc ngày hiện áp dụng phía hiển thị** cho biểu đồ và bảng hạng vé từ các dòng `sales` backend trả về. Ngày cuối được tính hết ngày theo Asia/Ho_Chi_Minh. Tổng quan và tệp xuất vẫn là toàn bộ sự kiện. API BE2 không nhận filter ngày; cần BE2 mở rộng nếu muốn lọc cả tổng quan/file tại server. UI nêu rõ giới hạn, không gửi tham số bị backend bỏ qua.
5. **Độ trễ báo cáo:** worker refresh materialized view mỗi 5 phút; cache Redis 60 giây. Hiển thị `refreshed_at`; gọi lại HTTP không có nghĩa số liệu MV đã được refresh. Báo cáo có thể chậm khoảng 6 phút.
6. **Giám sát dùng `/checkins` thật**, polling 5 giây, không phải SSE. Các số đếm là trong tối đa 50 lượt của trang hiện tại; không được gọi là tổng lượt vào cổng hoặc số người đang trong sân. Không tự sinh số nhân viên online vì API chưa cung cấp. Cổng/phân công hiện giới hạn 100 dòng theo BE2; tài khoản và lịch sử có phân trang.
7. **Xuất file:** POST chỉ `{format:"csv"}` hoặc `{format:"xlsx"}` và chờ 202. Poll trạng thái PENDING/PROCESSING/COMPLETED/FAILED/EXPIRED. Tải file có Bearer, kiểm tra MIME và dữ liệu không rỗng. Không truy cập đường dẫn filesystem, không theo redirect có nguy cơ mang token. API chưa hỗ trợ Idempotency-Key hoặc danh sách job; khi mất xác nhận, UI không tự gửi lại hoặc tuyên bố đã khôi phục job cũ. Job đang xem được giữ trong phiên trang, chưa khôi phục sau F5.
8. **PATCH/DELETE từ browser** đi qua hai route cùng origin, có kiểm tra định danh/Bearer, chỉ chuyển tiếp đúng endpoint tài khoản/gỡ phân công, giữ nguyên status lỗi và không cache. Điều này xử lý CORS backend hiện chưa cho phép hai method này. Backend vẫn quyết định toàn bộ quyền sở hữu và thao tác nghiệp vụ.

Schema nằm trong `packages/shared/src/schemas/organizer-operations.schema.ts`; adapter độc lập trong `apps/web/src/lib/organizer-operations.ts`. Không sử dụng service BTC cũ có fallback mock.

## Chạy trên Windows PowerShell

Giữ frontend và backend trong hai thư mục riêng. Không merge nhánh BE2 vào nhánh PR FE1 chỉ để chạy thử.

Trong fork frontend:

```powershell
git fetch origin
git switch --track origin/feat/w05-fe1-organizer-operations
pnpm install --frozen-lockfile
pnpm --filter @tickethub/shared build
pnpm --filter @tickethub/web exec next typegen
```

Nếu đã có nhánh local, dùng `git switch feat/w05-fe1-organizer-operations` và `git pull --ff-only` thay lệnh tạo tracking branch.

Clone backend cạnh thư mục frontend:

```powershell
git clone --branch feat/w05-be2-staff-reporting https://github.com/baam2603/tickethub.git ../tickethub-be2-w05
cd ../tickethub-be2-w05
pnpm install --frozen-lockfile
docker compose up -d postgres redis
```

Tạo database mới để tránh xung đột lịch sử migration hoặc tác động dữ liệu cũ. Ví dụ dưới đây chỉ dùng tài khoản/mật khẩu phát triển của Docker Compose, không phải thông tin production:

```powershell
docker exec tickethub-postgres createdb -U tickethub tickethub_w05_dev
$env:DATABASE_URL = "postgresql://tickethub:tickethub_secret@localhost:5432/tickethub_w05_dev"
$env:REPORT_EXPORT_DIR = "$PWD/tmp/report-exports"
pnpm --filter @tickethub/shared build
pnpm db:migrate
pnpm db:seed
pnpm --filter @tickethub/api build
pnpm --filter @tickethub/api start
```

Mở terminal thứ hai trong backend, đặt cùng database và thư mục file rồi chạy worker:

```powershell
$env:DATABASE_URL = "postgresql://tickethub:tickethub_secret@localhost:5432/tickethub_w05_dev"
$env:REPORT_EXPORT_DIR = "$PWD/tmp/report-exports"
pnpm --filter @tickethub/api start:report-worker
```

Mở terminal thứ ba trong fork frontend, chạy `pnpm --filter @tickethub/web dev`. Không chạy thêm API của fork frontend ở cổng 4000 vì API cần là bản BE2.

Đăng nhập `/auth` bằng `organizer@tickethub.vn` / `Password123!`, vào `/organizer/dashboard`, chọn sự kiện rồi chuyển giữa ba tab. Đây là tài khoản seed chỉ dùng phát triển.

## Kiểm thử toàn trình trên database test riêng

Các lệnh sau là ví dụ Bash của môi trường cloud. Dùng database riêng có hậu tố `_test`, migrate và seed bằng backend BE2. Sau suite, dừng API/worker test và xóa đúng database do lần chạy đó tạo để dọn toàn bộ fixture và log bất biến. Không chạy trên database người dùng.

API BE2 của lần test cần bật IPN cục bộ để tạo doanh thu qua logic thanh toán thật:

```bash
NODE_ENV=test DATABASE_URL=postgresql://tickethub:tickethub_secret@localhost:5432/tickethub_w05_test ENABLE_VNPAY_IPN_PROCESSING=true VNPAY_TMN_CODE=W05LOCALTEST VNPAY_HASH_SECRET=w05-local-signature-fixture-only REPORT_EXPORT_DIR=/tmp/w05-report-files pnpm --filter @tickethub/api start
```

Các giá trị VNPay trên chỉ là fixture chữ ký cục bộ, không phải merchant thật; không gọi VNPay sandbox hoặc chuyển tiền ngân hàng. Từ frontend, trước khi khởi động worker:

```bash
W05_ISOLATED_TEST=true node scripts/w05-e2e-fixture.mjs
```

Script chỉ hỗ trợ API local, tạo sự kiện qua API, gửi duyệt/phê duyệt, giữ chỗ và xác nhận IPN ký cục bộ. Không can thiệp Docker hoặc database trong code test. Metadata fixture không chứa access token được ghi vào `/tmp/w05-e2e-fixture.json` (có thể đổi bằng W05_FIXTURE_PATH). Sau đó chạy worker BE2 với cùng DATABASE_URL và REPORT_EXPORT_DIR, chạy web frontend rồi:

```bash
W05_ISOLATED_TEST=true W05_BE2_INTEGRATION=true PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm --filter @tickethub/web exec playwright test test/w05-organizer-operations.spec.ts --project=chromium --workers=1 --reporter=list
```

Bỏ PLAYWRIGHT_CHROMIUM_EXECUTABLE nếu đã cài browser Playwright. Suite không chạy khi thiếu hai cờ để tránh thao tác trên môi trường không có backend/DB test tương ứng. Mỗi lần chạy lại toàn suite cần fixture mới vì check-in không được đảo ngược. Worker cần refresh view trước khi bắt đầu test báo cáo.

Unit test của frontend chạy bằng tsx để hỗ trợ imports và render component TypeScript, dùng đúng version đã có trong monorepo. Fixture đơn vị chỉ kiểm tra schema/hiển thị, không thay thế logic doanh thu, phân quyền hoặc check-in backend.

## Tự nghiệm thu

1. Tạo tài khoản mới, xác nhận chưa tự được phân công; chọn cổng và lưu phân công.
2. Đổi cổng, khóa/mở khóa, gỡ và phân công lại. Kiểm tra nhân viên bị khóa không còn soát vé được với token cũ.
3. Kiểm tra báo cáo có số liệu thật, mốc cập nhật, ngày Việt Nam, không giữ nhầm số liệu khi đổi sự kiện. Sự kiện mới chưa refresh không được hiển thị doanh thu 0 giả.
4. Lọc ngày ngoài khoảng bán: biểu đồ/bảng hạng trống nhưng tổng quan vẫn toàn bộ sự kiện, đúng nhãn.
5. Xuất CSV và XLSX, đợi hoàn tất và tải tệp; dừng worker để kiểm tra trạng thái chờ thay vì thông báo tải thành công giả.
6. Soát vé bằng tài khoản được phân công, theo dõi lượt SUCCESS và quét lại bị REJECTED. Số đếm giám sát chỉ thuộc trang đang xem.
7. Thử trên mobile 390px và thử sự kiện không có quyền. Không sửa homepage, checkout hoặc hạ tầng kiểm soát trong PR này.
