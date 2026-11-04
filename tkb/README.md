# Thời khoá biểu v2 (NMH)

Thay V19 (Apps Script). Live: https://nmh-tkb.netlify.app — Netlify project `nmh-tkb` (id a4f1db92-b431-4e5f-9f96-fa1a60369ef5).

- `site/` PWA một trang (học sinh + phụ huynh), `sw.js` (offline + thông báo đẩy)
- `lib/api.mjs` máy chủ (Edge `/api/*`), `lib/kv.mjs` Netlify Blobs ghi có điều kiện, `lib/push.mjs` Web Push
- `netlify/functions/push-cron.mjs` (5 phút/lần), `push-now.mjs` (gửi ngay, cần `TKB_PUSH_SECRET`)
- `spec/tkb-v2/` A3, kế hoạch, nghiệm thu · `migration/` bộ chuyển dữ liệu V19

Biến môi trường (Netlify): `TKB_VAPID_PUBLIC`, `TKB_VAPID_PRIVATE`, `TKB_PUSH_SECRET`, `TKB_ADMIN_TOKEN`, `TKB_IMPORT_TOKEN`, `TKB_SALT` (không bật cờ secret).

Kiểm: `npm test` · thử máy: `npm run dev` · live: `node scripts/live-api.mjs <base> <admin> <pushSecret>`, `python3 scripts/e2e.py <base> <ảnh>`.
Deploy: connector `deploy-site` lấy proxy-path → `sh scripts/deploy.sh "<proxy-path>"` trong thư mục này.
Quản trị: `/api/admin/stats`, `/api/admin/list`, POST `/api/admin/delete {codes}` (header `x-admin-token`). Dữ liệu thử phải xoá ngay.
