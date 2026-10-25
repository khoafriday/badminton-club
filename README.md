# Badminton Club

App web quản lý CLB cầu lông: thành viên, lịch đánh, điểm danh, thu tiền và quỹ. Thiết kế cho điện thoại trước, host trên Vercel, dữ liệu trên Supabase.

## Trạng thái

Bản mẫu. Đã có:

- `lib/billing.ts`: toàn bộ quy tắc tính tiền (giá vãng lai Nam/Nữ, phí tháng, vào giữa tháng, nghỉ cả tháng, tổng tiền buổi, quỹ tồn). Có test trong `lib/billing.test.ts`.
- `supabase/migrations/0001_init.sql`: 10 bảng và 2 hàm ghi sổ thu chi.
- Đăng nhập 1 tài khoản, ID và mật khẩu lấy từ biến môi trường.
- Nối Supabase ở server (`lib/supabase.ts`). Lần đầu mở app sẽ hiện form tạo CLB.
- Màn Thành viên `/members`: danh sách, tìm theo tên hoặc số điện thoại, lọc Cố định / Vãng lai / Nghỉ, thêm, sửa, đổi loại, đổi Đang chơi / Nghỉ.
- Menu dưới 5 mục: Tổng quan, Lịch, Thành viên, Quỹ, Cài đặt (Tổng quan và Quỹ đang làm).
- Cài đặt: giá phí tháng và giá vãng lai Nam/Nữ, thông tin CLB và sân, nhiều CLB (tạo, chuyển, xóa), đăng xuất.
- Lịch: xem theo tuần hoặc tháng, lịch tuần (app tự tạo buổi cho 4 tuần tới), thêm buổi lẻ, sửa, hủy, khôi phục, xóa buổi chưa có dữ liệu.
- Màn Điểm danh buổi tại `/sessions/demo`, vẫn chạy bằng dữ liệu mẫu.

## Chạy trên máy

Cần Node.js 20 trở lên.

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

## Tạo database trên Supabase

1. Tạo project mới trên supabase.com.
2. Mở SQL Editor, chạy lần lượt từng file trong `supabase/migrations/` theo thứ tự số (0001, 0002, ...): dán nội dung, bấm Run. Khi có file mới, chỉ chạy file mới.
3. Lấy Project URL và service role key (Project Settings, API), thêm vào Vercel với tên `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`.

Service role key chỉ dùng ở server. Không đưa key này vào code phía trình duyệt.
