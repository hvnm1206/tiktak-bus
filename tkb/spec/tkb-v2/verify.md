# Nghiệm thu — Thời khoá biểu v2 (04/11/2026)

Bản kiểm: https://nmh-tkb.netlify.app (Netlify `nmh-tkb`). Dữ liệu thử đã xoá sạch sau khi kiểm (`/api/admin/stats` → 0 học sinh).

Cách kiểm:
- **API trên live:** `node scripts/live-api.mjs`, `node scripts/live-rate.mjs`.
- **Trình duyệt thật** (Chrome, khung điện thoại 390×844, 2–3 máy cùng lúc): `python3 scripts/e2e.py https://nmh-tkb.netlify.app <thư mục ảnh>`.
- **Logic:** `npm test` (26/26).

| # | Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|---|
| 1 | Nhập tên lần đầu → có mã 8 số, ≤ 3 giây | ĐẠT | e2e live: mã 8 số sau 1,2 giây |
| 2 | Một ngày 9 tiết thì lưu và hiện đủ 9 | ĐẠT | e2e live: 9/9 tiết |
| 3 | Phụ huynh nhập mã: chưa duyệt không thấy gì; duyệt xong thấy | ĐẠT | e2e live + test 403 `pending` |
| 4 | Học sinh sửa môn → phụ huynh thấy ≤ 10 giây | ĐẠT | e2e live: 0,8–1,3 giây |
| 5 | Phụ huynh gọi thẳng máy chủ để sửa → bị từ chối | ĐẠT | live: 4/4 thao tác bị 403; máy lạ 403 |
| 6 | Lời nhắc: học sinh thấy + có thông báo; xoá được, không quay lại | ĐẠT | e2e live; `push-now` gửi thật → `sent` |
| 7 | 1.000 việc vẫn thêm, sửa, lưu | ĐẠT | live: 1.001 việc, tải 126 ms (136KB); việc xong quá 45 ngày tự lưu trữ |
| 8 | Một phụ huynh 2 con không lẫn | ĐẠT | live |
| 9 | Gỡ phụ huynh → máy đó mất quyền | ĐẠT | e2e live |
| 10 | Một máy thử 20 mã sai → bị chặn; máy khác vẫn kết nối | ĐẠT | live: lần 21 trả 429; nhánh "máy khác vẫn được" kiểm bằng test (live không đổi được IP) |
| 11 | Kết nối lại 20 lần vẫn được | ĐẠT | live: 20/20 |
| 12 | Đổi máy bằng mã chuyển máy: dữ liệu nguyên, máy cũ mất quyền | ĐẠT | e2e live (3 máy) |
| 13 | Mất mạng sửa 3 việc → có mạng đủ 3, không trùng | ĐẠT | e2e live: tắt mạng thật trên trình duyệt |
| 14 | Hai máy ghi cùng lúc → giữ cả hai | ĐẠT | live: 20 lượt đồng thời, còn 20/20 |
| 15 | 20:00 / 30 phút trước học thêm có thông báo khi app đóng | ĐẠT phần máy chủ | Lịch chạy 5 phút đã chạy trên live (`cronToday`); logic chọn giờ đã test. **Chưa kiểm trên điện thoại thật** |
| 16 | Lịch điện thoại tự cập nhật | ĐẠT phần link | Link `.ics` đổi ngay khi sửa giờ. Google tự làm mới theo chu kỳ của Google |
| 17 | Dữ liệu V19 sang đủ, đúng mã, khoá cũ dùng tiếp | ĐẠT trên dữ liệu giả | live import + cầu nối `#v19` (học sinh và phụ huynh) chạy thử ở máy. **Chờ anh Hải chạy với dữ liệu thật** |
| 18 | 200 phiên cùng lúc không lỗi máy chủ | ĐẠT | live: 200/200 HTTP 200, 6,1 giây, không mất ghi |
| 19 | Không cần đăng nhập Google | ĐẠT | Mọi lượt e2e chạy trên trình duyệt không đăng nhập |

## Còn tồn tại
- **Nhãn "Powered by Netlify"** che nút "Việc học" ở thanh dưới. Tắt ở Netlify → nmh-tkb → Project configuration → Netlify badge (thao tác tay). Kịch bản e2e đang tạm chặn nhãn này.
- Thông báo đẩy và "Thêm vào MH chính" chưa thử trên iPhone/Android thật.
- Tên miền `tkb.nomahubvn.com` chưa gắn. Đổi tên miền sau khi đã có người dùng thì cần dẫn qua `#move=` (đã có sẵn trong app).
