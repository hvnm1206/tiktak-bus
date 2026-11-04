# Kế hoạch — Thời khoá biểu v2

A3 đã duyệt 04/11/2026: Netlify như CMT · học sinh duyệt phụ huynh · phụ huynh cấp mã chuyển máy · tkb.nomahubvn.com.

## Kiến trúc
- `site/` PWA một trang (`index.html`, `sw.js`, `manifest.webmanifest`, biểu tượng). Lưu bản sao trên máy, xếp hàng thao tác khi mất mạng.
- `netlify/edge-functions/api.js` → `/api/*`, gọi `lib/api.mjs` (logic thuần, test được bằng Node).
- `netlify/functions/push.mjs` (Node, `web-push`): chạy định kỳ 5 phút + nhận lệnh gửi ngay khi phụ huynh nhắc.
- Netlify Blobs, store `tkb`, nhất quán mạnh. Ghi có điều kiện theo etag (đọc → áp thao tác → ghi nếu chưa ai sửa, thử lại tối đa 6 lần).
- Mã nguồn ở repo `tiktak-bus`, thư mục `tkb/`; deploy thẳng vào project Netlify `nmh-tkb`.

## Dữ liệu (khoá Blobs)
| Khoá | Nội dung |
|---|---|
| `st/<mã8>` | Hồ sơ học sinh: tên, lớp, `lessons[7][]`, `extras[7][]`, `tasks{id:…}`, `owner` (băm), `recovery` (băm), `links{}`, `calToken`, `push`, `ops[]` (300 mã thao tác gần nhất, chống nhân đôi), `rev` |
| `ar/<mã8>/<YYYY-MM>` | Việc đã xong quá 45 ngày (lưu trữ, không tải mỗi lần) |
| `ho/<pin6>` | Mã chuyển máy, hết hạn 10 phút, dùng 1 lần |
| `cal/<token>` | Link lịch điện thoại → mã học sinh |
| `px/<thứ><HHMM>/<mã8>` | Chỉ mục giờ học thêm cần nhắc |
| `pn/<mã8>` | Học sinh đã bật thông báo (cho lượt nhắc 20:00) |
| `rl/…` | Đếm lượt theo cửa sổ giờ (chống dò mã) |

Mọi phản hồi API đều bỏ trường băm, token, `ops`.

## Phân quyền (kiểm tại máy chủ)
- **Học sinh:** token 32 byte sinh trên máy; máy chủ lưu băm SHA-256 ở `owner`. Mọi thao tác ghi.
- **Phụ huynh:** token sinh trên máy, gửi kèm yêu cầu kết nối; chỉ được đọc khi link `approved`; ghi duy nhất `reminder.add`.
- **Chống dò:** 20 lần sai mỗi giờ theo IP băm; tối đa 5 yêu cầu chờ duyệt mỗi học sinh; yêu cầu chờ quá 7 ngày tự hết hạn. Không có trần số phụ huynh đã duyệt, học sinh tự gỡ.
- **Chuyển máy:** phụ huynh đã duyệt (hoặc chính học sinh) tạo mã 6 số; máy mới nhập → `owner` đổi sang máy mới, máy cũ mất quyền. Thử mã tối đa 10 lần/giờ theo IP.
- **Mã khôi phục** 12 ký tự: tạo lúc đăng ký, máy chủ chỉ giữ băm.
- **Băm giống V19** (SHA-256 hex) → token cũ của V19 dùng tiếp được sau khi chuyển dữ liệu.

## Đồng bộ
- Tải về: `GET /api/s/<mã>?rev=&wait=20`. Máy chủ chờ tối đa 20 giây, có thay đổi thì trả ngay → thay đổi hiện ở máy kia khoảng 2 giây, ít lượt gọi.
- Gửi lên: `POST /api/s/<mã>/ops`. Thao tác theo từng mục (sửa việc A, xoá việc B, đặt môn thứ 3…) → hai máy sửa hai mục khác nhau đều được giữ. Mỗi thao tác có id → gửi lại khi mất mạng không bị nhân đôi.

## Việc làm theo thứ tự
| # | Việc | Tiêu chí A3 |
|---|---|---|
| T1 | `lib/api.mjs` + test Node: đăng ký, đọc/ghi, thao tác, kết nối/duyệt/gỡ, chống dò, chuyển máy, khôi phục, lưu trữ việc cũ, nhập V19 | 1–3, 5–14, 17 |
| T2 | Edge function + kho Blobs | 18 |
| T3 | Giao diện PWA: học sinh, phụ huynh, nhiều con, offline, cài lên màn hình | 1, 4, 8, 13, 19 |
| T4 | Web Push (VAPID) + lịch `.ics` đăng ký | 6, 15, 16 |
| T5 | Deploy `nmh-tkb`, biến môi trường, NMH Apps, CNAME `tkb` | — |
| T6 | Chuyển dữ liệu: hàm xuất V19 (anh chạy 1 lần) → `/api/admin/import`; nút "Mở app mới" ở V19 mang token sang | 17 |
| T7 | Nghiệm thu trên bản live, kiểm tải 200 phiên, ghi `verify.md` | tất cả |

## Rủi ro
- **Hạn mức Netlify miễn phí** (lượt gọi Edge/Functions). Chờ dài 20 giây giúp giảm lượt gọi; phải kiểm hạn mức tài khoản khi deploy.
- **iPhone** chỉ nhận thông báo khi app đã "Thêm vào MH chính" (iOS ≥ 16.4). App phải hướng dẫn ngắn đúng lúc bật thông báo.
- **Google Calendar** làm mới link đăng ký theo chu kỳ của Google (thường vài giờ tới 24 giờ).
- **Lượt nhắc 20:00** đọc mọi học sinh đã bật thông báo; quá khoảng 3.000 em cần chia lô.
