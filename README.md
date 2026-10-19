# Tiktak Bus (PWA)

Tìm đường xe buýt Hà Nội, chạy hoàn toàn trên máy người dùng. Dữ liệu lấy từ TransitDB (nguồn Timbus), chỉ đọc.

## Cấu trúc

| File | Vai trò |
| --- | --- |
| `export_data.py` | Đọc file xlsx xuất từ TransitDB → `data/transit.json` (chỉ đọc, đọc cột theo vị trí) |
| `engine.js` | Bộ tìm đường: đi thẳng hoặc đổi xe 1 lần, 4 chế độ, giờ chạy, tra trạm/tuyến |
| `app.template.html` | Giao diện (chữ to, gợi ý địa điểm, GPS, đọc to, gửi người thân) |
| `build_pwa.py` | Đóng gói bản PWA vào `site/` (manifest, icon, service worker, CNAME) |
| `site/` | Thư mục được xuất bản lên GitHub Pages |

## Cập nhật dữ liệu

1. Tải TransitDB về dạng `.xlsx` → `data/transitdb.xlsx`
2. `python3 export_data.py data/transitdb.xlsx data/transit.json`
3. `python3 build_pwa.py`
4. Commit và push thư mục `site/`. Người dùng tự nhận bản mới ở lần mở kế tiếp.

## Triển khai lên bus.nomahubvn.com

1. GitHub repo → Settings → Pages → Source: nhánh `main`, thư mục `/site`.
2. DNS của nomahubvn.com: thêm bản ghi `CNAME`, tên `bus`, giá trị `<tài-khoản-github>.github.io`.
3. Pages → Custom domain: `bus.nomahubvn.com`, bật **Enforce HTTPS** khi chứng chỉ sẵn sàng.

## Giới hạn đã biết

- Khoảng cách đi bộ tính theo đường thẳng.
- Giờ chạy là giờ xuất bến đầu/cuối tại đầu tuyến, không phải giờ xe đến trạm.
- Tìm địa điểm theo tên trạm; địa danh không trùng tên trạm cần thêm vào `ALIASES` trong `engine.js`.
