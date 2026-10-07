// Cấu hình Study Case
window.CONFIG = {
  // Dán link Firebase Realtime Database vào đây để có bảng xếp hạng CHUNG cho mọi học sinh.
  // Ví dụ: "https://ten-du-an-default-rtdb.asia-southeast1.firebasedatabase.app"
  // Để trống = chỉ có bảng xếp hạng trên máy hiện tại.
  FIREBASE_DB_URL: "",

  // Các màu hiếm được nhân thêm 10% so với tỉ lệ CS:GO
  BOOST: 1.10,

  // Số giây được phép trễ sau khi hết giờ mà chưa bị trừ ELO
  GRACE_SEC: 60
};
