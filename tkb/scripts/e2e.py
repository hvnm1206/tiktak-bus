# Kiểm thử đầu-cuối trên trình duyệt thật: một máy học sinh, một máy phụ huynh.
import sys, time, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1]; OUT = sys.argv[2]
res = []
def ok(name, cond, note=''):
    res.append((name, bool(cond), note)); print(('PASS ' if cond else 'FAIL ') + name + (' — ' + note if note else ''), flush=True)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/google/chrome/chrome', args=['--no-sandbox'])
    def phone():
        c = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='vi-VN', timezone_id='Asia/Ho_Chi_Minh')
        c.route('**/fonts.g*/**', lambda r: r.abort())
        c.route('**/.netlify/scripts/hud*', lambda r: r.abort())  # nhãn Netlify che thanh dưới (anh Hải tắt trong cài đặt)
        pg = c.new_page(); pg.on('dialog', lambda d: d.accept()); return c, pg
    sc, s = phone(); pc, pa = phone()

    # TC1: học sinh mở lần đầu
    s.goto(BASE); s.screenshot(path=f'{OUT}/01-chao.png')
    t0 = time.time()
    s.click('text=Tôi là học sinh'); s.fill('#f_name', 'Minh Anh'); s.fill('#f_cls', '8A'); s.click('button:has-text("Bắt đầu")')
    s.wait_for_selector('.code'); dt = time.time() - t0
    code = s.evaluate("JSON.parse(localStorage.tkb2).student.code")
    ok('TC1 có mã 8 số sau khi nhập tên', len(code) == 8 and code.isdigit(), f'{code}, {dt:.1f}s')
    s.screenshot(path=f'{OUT}/02-ma.png'); s.click('button:has-text("Nhập lịch học")')

    # TC2: nhập 9 tiết cho Thứ Năm (ngày mai, vì hôm nay Thứ Tư 4/11)
    s.click('[data-wday="3"]')
    for m in ['Chào cờ','Toán','Toán','Ngữ văn','Tiếng Anh','Vật lý','Lịch sử','Thể dục','Tin học']:
        s.click('text=＋ Thêm tiết'); s.fill('#f_name', m); s.click('.modal button[type=submit]:has-text("Lưu")')
    ok('TC2 hiện đủ 9 tiết', s.locator('.lesson').count() == 9)
    s.click('text=＋ Thêm buổi học thêm'); s.fill('#f_name', 'Toán nâng cao'); s.fill('#f_place', 'Nhà cô Lan, ngõ 12')
    s.fill('#f_start', '17:30'); s.fill('#f_end', '19:00'); s.click('.modal button:has-text("Lưu")')
    s.screenshot(path=f'{OUT}/03-ca-tuan.png', full_page=True)
    s.click('[data-tab="tasks"]'); s.click('text=＋ Thêm việc'); s.click('label.chip:has-text("Kiểm tra")'); s.fill('#f_c', 'Kiểm tra 15 phút Vật lý bài 8'); s.click('.modal button:has-text("Lưu")')
    s.click('[data-tab="home"]'); s.wait_for_timeout(800)
    s.screenshot(path=f'{OUT}/04-ngay-mai.png', full_page=True)

    # TC3: phụ huynh kết nối, chưa duyệt chưa thấy
    pa.goto(BASE); pa.click('text=Tôi là phụ huynh'); pa.fill('#f_code', code[:4] + ' ' + code[4:]); pa.fill('#f_label', 'Mẹ'); pa.click('button:has-text("Gửi yêu cầu")')
    pa.wait_for_selector('text=Đang chờ con đồng ý'); pa.screenshot(path=f'{OUT}/05-ph-cho.png')
    ok('TC3 chưa duyệt: phụ huynh không thấy lịch', pa.locator('.lesson').count() == 0)
    s.wait_for_selector('text=muốn xem thời khoá biểu', timeout=25000); s.screenshot(path=f'{OUT}/06-hs-duyet.png')
    s.click('.notice button:has-text("Đồng ý")')
    pa.wait_for_selector('.kid.on:has-text("Minh Anh")', timeout=20000)
    pa.wait_for_timeout(500)
    ok('TC3 duyệt xong: phụ huynh thấy đủ 9 tiết ngày mai', pa.locator('.lesson').count() == 9)
    pa.screenshot(path=f'{OUT}/07-ph-ngay-mai.png', full_page=True)
    ok('Phụ huynh không có nút sửa', pa.locator('[data-do=editLesson], [data-do=addTask]').count() == 0)

    # TC4: học sinh sửa môn → máy phụ huynh thấy trong ≤ 10 giây
    s.click('[data-tab="week"]'); s.click('[data-wday="3"]'); s.click('[data-do=editLesson][data-i="1"]'); s.fill('#f_name', 'Đại số'); s.click('.modal button:has-text("Lưu")')
    t0 = time.time(); pa.wait_for_selector('.lesson .s:has-text("Đại số")', timeout=15000); dt = time.time() - t0
    ok('TC4 phụ huynh thấy thay đổi ≤ 10 giây', dt <= 10, f'{dt:.1f}s')

    # TC6: phụ huynh gửi lời nhắc → học sinh thấy; xoá được và không quay lại
    pa.click('text=＋ Gửi lời nhắc cho con'); pa.fill('#f_c', 'Nhớ mang áo khoác, trời lạnh'); pa.click('.modal button:has-text("Gửi lời nhắc")')
    s.click('[data-tab="home"]'); t0 = time.time()
    s.wait_for_selector('text=Nhớ mang áo khoác', timeout=15000); dt = time.time() - t0
    ok('TC6 học sinh thấy lời nhắc', True, f'{dt:.1f}s, có ghi "Mẹ nhắc": {s.locator("text=Mẹ nhắc").count() > 0}')
    s.screenshot(path=f'{OUT}/08-hs-loi-nhac.png', full_page=True)
    s.locator('.task:has-text("Nhớ mang áo khoác") [data-do=editTask]').click(); s.click('.modal button:has-text("Xoá việc này")')
    s.wait_for_timeout(1500); s.click('[data-tab="week"]'); s.click('[data-do=editLesson][data-i="0"]'); s.click('.modal button:has-text("Lưu")')
    s.wait_for_timeout(1500); s.reload(); s.wait_for_timeout(1500)
    ok('TC6 lời nhắc đã xoá không quay lại', s.locator('text=Nhớ mang áo khoác').count() == 0)

    # TC13: mất mạng, thêm 3 việc, có mạng lại → đủ 3, không nhân đôi
    s.click('[data-tab="tasks"]'); sc.set_offline(True)
    for i in range(3):
        s.click('button.btn:has-text("＋ Thêm việc")'); s.fill('#f_c', f'Việc khi mất mạng {i+1}'); s.click('.modal button:has-text("Lưu")')
    ok('TC13 khi mất mạng vẫn thấy 3 việc vừa thêm', s.locator('text=Việc khi mất mạng').count() == 3)
    sc.set_offline(False); s.evaluate("dispatchEvent(new Event('online'))")
    s.wait_for_function("JSON.parse(localStorage.tkb2).student.queue.length===0", timeout=15000)
    pa.click('[data-tab="tasks"]'); pa.click('[data-filter="all"]')
    pa.wait_for_selector('text=Việc khi mất mạng 3', timeout=15000)
    ok('TC13 có mạng lại: máy phụ huynh thấy đủ 3 việc, không trùng', pa.locator('text=Việc khi mất mạng').count() == 3)

    # TC9: học sinh gỡ phụ huynh
    s.click('[data-tab="more"]'); s.screenshot(path=f'{OUT}/09-ca-nhan.png', full_page=True)
    s.click('.list-item:has-text("Mẹ") button:has-text("Gỡ")')
    pa.wait_for_selector('text=đã gỡ', timeout=25000)
    ok('TC9 gỡ xong: máy phụ huynh mất quyền', pa.locator('.lesson').count() == 0)
    pa.screenshot(path=f'{OUT}/10-ph-bi-go.png')

    # TC12: chuyển máy bằng mã chuyển máy
    pin = None
    s.click('button:has-text("Tạo mã chuyển máy")'); pin = s.locator('.modal .code').inner_text().strip(); s.click('.modal button:has-text("Xong")')
    nc, n = phone(); n.goto(BASE); n.click('text=Tôi đã dùng app trên máy khác'); n.fill('#f_pin', pin); n.click('.modal button:has-text("Tiếp tục")')
    n.wait_for_selector('.lesson'); n.wait_for_timeout(500)
    n.click('[data-tab="week"]'); n.click('[data-wday="3"]')
    ok('TC12 máy mới có đủ dữ liệu', n.locator('.lesson').count() == 9)
    s.click('[data-tab="week"]'); s.click('[data-wday="3"]'); s.click('[data-do=editLesson][data-i="0"]'); s.fill('#f_name', 'Máy cũ sửa'); s.click('.modal button:has-text("Lưu")')
    s.wait_for_timeout(2500)
    n.reload(); n.wait_for_timeout(1500); n.click('[data-tab="week"]'); n.click('[data-wday="3"]')
    ok('TC12 máy cũ không sửa được nữa', n.locator('text=Máy cũ sửa').count() == 0)
    n.click('[data-tab="home"]'); n.screenshot(path=f'{OUT}/11-may-moi.png', full_page=True)
    b.close()
json.dump(res, open(f'{OUT}/e2e.json', 'w'), ensure_ascii=False)
print('TONG', sum(1 for r in res if r[1]), '/', len(res))
