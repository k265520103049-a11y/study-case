# 📦 Study Case — Mở hòm học tập

Web mở hòm kiểu Counter-Strike để học sinh có động lực học. Quà quay được là **thời gian**: học thêm, đọc sách, hoặc phần thưởng giải trí. Quà phải dùng hết giờ mới được mở hòm tiếp.

## Luật chơi
- Không có kho đồ. Quay trúng gì **dùng ngay**.
- Đồng hồ chạy hết mới mở hòm tiếp. Không có nút hủy, tải lại trang hay đóng tab đều không thoát được (giờ lưu theo thời điểm thật).
- **ELO** bắt đầu 1000. Quà giải trí dùng đúng giờ: +8. Học thêm / đọc sách xong: +12 và không bao giờ bị trừ. Quà giải trí trễ quá 60 giây: −5 ELO mỗi phút trễ (tối đa −60), mất chuỗi.
- Chuỗi đúng giờ liên tiếp được cộng thêm ELO. Xếp hạng từ Sắt tới Thách Đấu.

## Tỉ lệ
Lấy tỉ lệ hòm CS:GO (79.92 / 15.98 / 3.2 / 0.64 / 0.26 %), nhân **1.10** cho các màu hiếm. Màu trắng nhận phần còn lại (khoảng 77.9%). Chỉnh trong `config.js` (`BOOST`) và danh sách quà trong `app.js` (`REWARDS`).

Ô trắng: Học thêm 15p, Đọc sách 15p, Xem MXH 5p.

## Đưa lên GitHub (GitHub Pages)
1. Tạo repo mới trên github.com, ví dụ `study-case`, để Public.
2. Tải toàn bộ các file trong thư mục này lên repo (nút **Add file → Upload files**), hoặc:
   ```bash
   git init
   git add .
   git commit -m "Study Case"
   git branch -M main
   git remote add origin https://github.com/<tên-bạn>/study-case.git
   git push -u origin main
   ```
3. Vào **Settings → Pages → Build and deployment**, chọn Source = *Deploy from a branch*, Branch = `main`, thư mục `/ (root)`, bấm Save.
4. Sau 1–2 phút web có tại `https://<tên-bạn>.github.io/study-case/`. Gửi link này cho học sinh.

## Bật bảng xếp hạng chung (Firebase, miễn phí)
GitHub Pages chỉ chứa file tĩnh nên cần một chỗ lưu điểm chung.
1. Vào console.firebase.google.com → tạo project → **Build → Realtime Database → Create database**.
2. Tab **Rules**: dán nội dung file `database.rules.json` rồi Publish.
3. Copy URL của database (dạng `https://xxx-default-rtdb.<vùng>.firebasedatabase.app`) dán vào `FIREBASE_DB_URL` trong `config.js`, rồi commit lại.

Không cấu hình thì web vẫn chạy, bảng xếp hạng chỉ có người chơi trên cùng thiết bị.

## Lưu ý trung thực
- Đây là hệ thống **dựa trên sự tự giác**: web không biết học sinh có thật sự học hay có tắt đồng hồ rồi vẫn dùng điện thoại hay không. Giáo viên nên kết hợp kiểm tra thực tế.
- Điểm ELO do trình duyệt gửi lên, học sinh rành kỹ thuật có thể sửa. Rules Firebase chỉ chặn ghi đè biệt danh của người khác, không chống gian lận ELO. Phù hợp cho lớp học, không phù hợp để đặt giải thưởng thật.
- Biệt danh được giữ bằng **mã khôi phục** (nút 🔑). Mất mã thì không lấy lại được biệt danh.
- Web không dùng hình ảnh, tên hay tài sản của Valve/CS:GO.
