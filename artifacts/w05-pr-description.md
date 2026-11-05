# feat(web): implement W05 organizer staff and reporting

W05-FE1 bổ sung quản lý nhân viên soát vé, báo cáo và xuất file trong cổng BTC. Tạo tài khoản, phân công, khóa/mở khóa, check-in và xuất CSV/XLSX được kiểm thử qua backend BE2 thật, PostgreSQL/Redis thật và worker báo cáo thật.

Nhánh `feat/w05-fe1-organizer-operations` tạo riêng từ `unstable`; không gồm commit W04. Không thay đổi trang chủ, danh mục sự kiện công khai, checkout hoặc code backend.

## 1. Loại thay đổi (PR Type)

Đánh dấu vào loại thay đổi tương ứng:

- [x] `feat`: Tính năng mới
- [ ] `fix`: Sửa lỗi hệ thống
- [ ] `docs`: Cập nhật tài liệu
- [ ] `refactor`: Tái cấu trúc mã nguồn (không thay đổi hành vi)
- [ ] `chore`: Cấu hình công cụ, nâng cấp thư viện, tác vụ bảo trì

## 2. Kiểm tra kỹ thuật trước khi gửi (Pre-flight Checks)

Bắt buộc thực thi và tích chọn toàn bộ các bước sau tại môi trường cục bộ:

- [x] Đã chạy `pnpm typecheck` và không có lỗi TypeScript
- [x] Đã chạy `pnpm lint` và không có lỗi vi phạm quy tắc lint
- [x] Đã chạy `pnpm format:check` và mã nguồn đã được định dạng nhất quán
- [x] Đã chạy `pnpm test` và tất cả các bài kiểm thử đều vượt qua (PASS)

## 3. Cam kết chất lượng mã nguồn (Code Quality Guarantees)

Bắt buộc xác nhận toàn bộ các cam kết dưới đây:

- [x] Không chứa mã giả lập ở client (không dùng localStorage hoặc mock để thay thế API backend)
- [x] Không sử dụng kiểu `any` (dùng schema Zod hoặc kiểu `unknown` có kiểm tra kiểu)
- [x] Tuân thủ token màu tại `docs/DESIGN_TOKENS.md` (không dùng mã hex thô không khai báo)
- [x] Không chứa biểu tượng cảm xúc (emoji) trong commit message và nội dung trao đổi
- [x] Không chứa ký tự gạch ngang dài (em-dash) trong commit message và nội dung
- [x] Không can thiệp trái phép vào hạ tầng kiểm soát (không sửa đổi .github/workflows/, scripts/pr-gate-_, scripts/audit-doc-_, tests/pr-gate-*)

## 4. Danh sách ca kiểm thử (Test Cases)

- Chưa đăng nhập không truy cập được dashboard BTC.
- Báo cáo hiển thị 1.200.000 VND từ giao dịch fixture đã được xử lý qua API thật; filter ngày áp dụng cho biểu đồ/bảng, không làm thay đổi tổng quan toàn sự kiện.
- Tạo tài khoản, tạo cổng và phân công; mobile 390px không tràn ngang.
- Khóa/mở khóa tài khoản; token nhân viên bị khóa bị backend từ chối; đổi cổng, gỡ và phân công lại.
- Giám sát tự cập nhật lượt check-in thành công và lượt quét trùng bị từ chối.
- Yêu cầu xuất nhận 202, worker xử lý, tải được CSV và workbook XLSX thực tế.
- Sự kiện ngoài quyền sở hữu bị chặn ở UI và backend trả 404.

Kết quả cloud: 7/7 E2E với BE2, 43 test web và 191 test API của nhánh nền đạt. Unit test có fixture để kiểm tra schema/hiển thị và truyền tải HTTP; không dùng mock cho nghiệp vụ tạo tài khoản, doanh thu, check-in hoặc worker trong E2E.

## 5. Ghi chú bổ sung (Additional Notes)

- **Phụ thuộc backend:** [baam2603/tickethub, nhánh feat/w05-be2-staff-reporting](https://github.com/baam2603/tickethub/tree/feat/w05-be2-staff-reporting), commit kiểm thử `3aa1d4b752fa0754cfc496c1cf6368980351df39`. Backend được chạy riêng khi kiểm thử, không merge code BE2 vào PR này. unstable hiện chưa cung cấp các API W05.
- Routes: `/organizer/dashboard`, `/organizer/events/[id]/staff`, `/organizer/events/[id]/stats`, `/organizer/events/[id]/monitor`.
- Tạo tài khoản và phân công là hai bước riêng, không tuyên bố thành công cả hai khi mới tạo tài khoản. Khóa tài khoản tác động toàn bộ sự kiện, gỡ phân công giữ lại lịch sử.
- Bộ lọc ngày Việt Nam áp dụng cho biểu đồ/bảng ngày bán ở client. API BE2 chưa hỗ trợ lọc ngày cho tổng quan hoặc file xuất; UI ghi rõ tổng quan/file là toàn bộ sự kiện. Cần mở rộng backend nếu yêu cầu lọc cả phần đó.
- Số liệu báo cáo từ materialized view có thể chậm khoảng 6 phút; mốc refreshed_at được hiển thị. summary null không được chuyển thành tiền bằng 0.
- Giám sát dùng polling 5 giây trên lịch sử thật, không phải SSE. Số đếm chỉ thuộc tối đa 50 lượt của trang hiện tại, không tự sinh số nhân viên online.
- PATCH/DELETE đi qua proxy cùng origin có Bearer để xử lý CORS backend; giữ nguyên mã lỗi và kiểm tra quyền ở backend. Không sửa workflow hoặc gate.
- Thêm tsx làm dev dependency web, dùng đúng version đã có ở API, để test imports và component TypeScript nhất quán. Không thêm thư viện biểu đồ hoặc sửa production dependency.
- Không có migration backend trong PR FE1. Backend BE2 cần migration 0003 và report worker chạy với cùng DATABASE_URL/REPORT_EXPORT_DIR.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `node scripts/audit-doc-parity.mjs` đã kiểm tra trên cloud.
- Production build: shared/API build được; web còn bị chính sách mạng cloud chặn Google Fonts. Cần kiểm tra lại trên CI/môi trường có quyền truy cập font trước khi merge. Không tắt TLS hoặc thay đổi kiểm soát để bỏ qua lỗi.
- Fixture IPN là chữ ký test cục bộ qua endpoint thật, không phải giao dịch ngân hàng/VNPay sandbox thật.
- Hướng dẫn chạy PowerShell, cấu hình BE2, kiểm thử và giới hạn: [docs/W05_FE1_INTEGRATION.md](../docs/W05_FE1_INTEGRATION.md).

## 6. Minh chứng trực quan (Visual Evidence)

Ảnh chụp từ web chạy với backend BE2 và database test thật:

![Báo cáo doanh thu](https://github.com/vikietduong/tickethub/blob/feat/w05-fe1-organizer-operations/artifacts/w05-reports.png?raw=true)

![Quản lý nhân viên](https://github.com/vikietduong/tickethub/blob/feat/w05-fe1-organizer-operations/artifacts/w05-staff.png?raw=true)

![Nhân viên trên mobile](https://github.com/vikietduong/tickethub/blob/feat/w05-fe1-organizer-operations/artifacts/w05-staff-mobile.png?raw=true)

![Giám sát vào cổng](https://github.com/vikietduong/tickethub/blob/feat/w05-fe1-organizer-operations/artifacts/w05-monitor.png?raw=true)

![Xuất báo cáo hoàn tất](https://github.com/vikietduong/tickethub/blob/feat/w05-fe1-organizer-operations/artifacts/w05-export.png?raw=true)
