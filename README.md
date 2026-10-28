# Badminton Club

App web quản lý CLB cầu lông: thành viên, lịch đánh, điểm danh, thu tiền và quỹ. Thiết kế cho điện thoại trước, host trên Vercel, dữ liệu trên Supabase.

## Trạng thái

Bản mẫu. Đã có:

- `lib/billing.ts`: toàn bộ quy tắc tính tiền (giá vãng lai Nam/Nữ, phí tháng, vào giữa tháng, nghỉ cả tháng, tổng tiền buổi, quỹ tồn). Có test trong `lib/billing.test.ts`.
- `supabase/migrations/0001_init.sql`: 10 bảng và 2 hàm ghi sổ thu chi.
- Đăng nhập 1 tài khoản, ID và mật khẩu lấy từ biến môi trường.
- Nối Supabase ở server (`lib/supabase.ts`). Lần đầu mở app sẽ hiện form tạo CLB.
- Màn Thành viên `/members`: danh sách, tìm theo tên hoặc số điện thoại, lọc Cố định / Vãng lai / Nghỉ, thêm, sửa, đổi loại, đổi Đang chơi / Nghỉ.
- Menu dưới 5 mục: Tổng quan, Lịch, Thành viên, Quỹ, Cài đặt.
- Tổng quan: buổi 7 ngày tới, tiền đã thu và còn nợ trong tháng, quỹ tồn. Người còn nợ `/debts`, bấm Đã nộp ngay tại chỗ.
- Quỹ: quỹ tồn, tổng thu chi theo tháng, quý, toàn bộ. Ghi, sửa, xóa khoản thu chi tay.
- Cài đặt: giá phí tháng và giá vãng lai Nam/Nữ, thông tin CLB, danh sách sân cầu (tên, địa chỉ, giá thuê mỗi giờ, dùng chung cho mọi CLB; mỗi CLB chọn 1 sân), nhiều CLB (tạo, chuyển, xóa), đăng xuất.
- Lịch: xem theo tuần hoặc tháng, lịch cố định (app tự tạo buổi cho 4 tuần tới), thêm buổi lẻ, sửa, hủy, khôi phục, xóa buổi chưa có dữ liệu. Sân của buổi và lịch cố định chọn từ danh sách sân cầu.
- Điểm danh từng buổi: có mặt, thêm nhanh khách (người cũ hoặc người mới), giá tự điền theo giới tính, sửa giá riêng, Đã nộp ghi vào sổ thu chi.
- Phí tháng `/fees`: phiếu tự tạo đầu tháng cho người cố định, Đã nộp, Miễn, hết tháng không đi buổi nào tự chuyển Miễn.
- Chi tiết thành viên có tiền còn nợ, phiếu phí tháng và các buổi đã đi.

## Chạy trên máy

Cần Node.js 24 (xem `.nvmrc`; dùng nvm thì chạy `nvm use`).

```bash
npm install
cp .env.example .env.local   # rồi điền ADMIN_ID, ADMIN_PASSWORD, SESSION_SECRET
npm run dev                  # mở http://localhost:3000
npm test                     # chạy test
```

## Đưa lên Vercel

1. Vercel, Add New, Project, chọn repo này.
2. Trước khi bấm Deploy, mở Environment Variables và thêm:
   - `ADMIN_ID`: ID đăng nhập
   - `ADMIN_PASSWORD`: mật khẩu
   - `SESSION_SECRET`: chuỗi ngẫu nhiên từ 32 ký tự trở lên
3. Bấm Deploy.

ID và mật khẩu không nằm trong code. Muốn đổi thì sửa biến môi trường trên Vercel rồi Redeploy.

`vercel.json` đặt server chạy ở Singapore (`sin1`), cùng vùng với Supabase (`ap-southeast-1`). Nếu chuyển Supabase sang vùng khác thì đổi vùng ở file này theo.

## Tạo database trên Supabase

1. Tạo project mới trên supabase.com.
2. Mở SQL Editor, chạy lần lượt từng file trong `supabase/migrations/` theo thứ tự số (0001, 0002, ...): dán nội dung, bấm Run. Sau khi cài phần Tự chạy SQL khi merge bên dưới, file mới sẽ tự chạy.
3. Lấy Project URL và service role key (Project Settings, API), thêm vào Vercel với tên `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`.

Service role key chỉ dùng ở server. Không đưa key này vào code phía trình duyệt.

## Tự chạy SQL khi merge

Workflow `.github/workflows/supabase-migrations.yml` chạy các file mới trong `supabase/migrations/` lên Supabase mỗi khi có file mới vào nhánh `main`. File đã chạy thì bỏ qua. Xem kết quả ở tab Actions trên GitHub. Muốn chạy lại bằng tay: Actions, Supabase migrations, Run workflow.

Cài một lần:

1. Tạo access token: Supabase, Account, Access Tokens, Generate new token.
2. Trên GitHub: repo này, Settings, Secrets and variables, Actions, New repository secret. Thêm 3 secret:
   - `SUPABASE_ACCESS_TOKEN`: token vừa tạo.
   - `SUPABASE_DB_PASSWORD`: mật khẩu database của project (đặt khi tạo project; quên thì đặt lại ở Project Settings, Database).
   - `SUPABASE_PROJECT_ID`: mã project, là phần `xxxx` trong `https://xxxx.supabase.co`.
3. Chạy `supabase/setup/mark_existing_migrations.sql` một lần trong SQL Editor. File này ghi nhận 0001 đến 0004 đã chạy tay rồi.

Khi viết file migration mới: bản app đang chạy phải vẫn chạy được sau khi file chạy xong (chỉ thêm bảng, thêm cột, không xóa hay đổi tên). SQL chỉ chạy sau khi merge, nên bản Preview của PR có file mới sẽ lỗi cho tới khi merge, trừ khi chạy tay trước trong SQL Editor.

## QR chuyển khoản tự xác nhận (SePay)

Thành viên bấm "Đóng tiền nợ" ở Tổng quan, app hiện mã VietQR cho toàn bộ số nợ với nội dung là mã riêng (ví dụ `BC7K2QX9`). Khi tiền vào tài khoản TPBank, SePay gọi webhook và app tự đánh Đã nộp.

Cài một lần:

1. Cài đặt, Tài khoản nhận tiền: nhập số tài khoản TPBank và tên chủ tài khoản.
2. Tạo tài khoản trên sepay.vn, liên kết tài khoản TPBank đó.
3. Trong SePay, thêm Webhook: URL `https://<domain app>/api/webhooks/sepay`, kiểu chứng thực API Key, tự đặt một key dài.
4. Thêm key đó vào Vercel với tên `SEPAY_WEBHOOK_KEY` (Production), rồi Redeploy.
5. Chuyển thử một khoản nhỏ từ tài khoản thành viên.

Chuyển khoản không có mã của app thì không được lưu. Chuyển thiếu, chuyển thừa hoặc mã không khớp hiện ở Người còn nợ, mục "Chuyển khoản cần xem".
