// Nghiệm thu phía máy chủ trên bản live. Dọn sạch dữ liệu thử ở cuối.
// Dùng: node scripts/live-api.mjs <base> <adminToken>
import crypto from 'node:crypto';
const [BASE, ADM] = process.argv.slice(2);
const res = []; const made = [];
const ok = (n, c, note = '') => { res.push([n, !!c, note]); console.log((c ? 'PASS ' : 'FAIL ') + n + (note ? ' — ' + note : '')); };
const tok = () => crypto.randomBytes(32).toString('hex');
let opn = 0; const op = o => ({ opId: 'live' + Date.now() + (++opn), ...o });
async function call(m, p, { body, token, headers = {} } = {}) {
  const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(token ? { 'x-token': token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { status: r.status, body: j };
}
async function student(name) { const t = tok(); const r = await call('POST', '/api/student', { body: { name, token: t } }); made.push(r.body.code); return { ...r.body, t }; }
async function parentOf(s, label = 'Mẹ') {
  const t = tok(); await call('POST', '/api/link', { body: { code: s.code, label, token: t } });
  const d = (await call('GET', `/api/s/${s.code}`, { token: s.t })).body.data; const l = d.links.find(x => x.status === 'pending');
  await call('POST', `/api/s/${s.code}/ops`, { token: s.t, body: { ops: [op({ t: 'link.approve', id: l.id })] } }); return t;
}
try {
  // TC5
  const a = await student('Live A'); const pa = await parentOf(a);
  let denied = 0;
  for (const o of [{ t: 'lessons.set', w: 0, list: ['X'] }, { t: 'task.del', id: 'x' }, { t: 'profile', name: 'Y' }, { t: 'link.approve', id: 'x' }]) if ((await call('POST', `/api/s/${a.code}/ops`, { token: pa, body: { ops: [op(o)] } })).status === 403) denied++;
  ok('TC5 phụ huynh gọi thẳng API sửa lịch/việc/hồ sơ/duyệt bị từ chối', denied === 4, `${denied}/4 bị chặn (403)`);
  ok('TC5b máy lạ không đọc được', (await call('GET', `/api/s/${a.code}`, { token: tok() })).status === 403);

  // TC7: 1.000 việc
  const ops = Array.from({ length: 1000 }, (_, i) => op({ t: 'task.upsert', task: { id: 'k' + i, content: 'Làm bài tập Toán trang ' + i + ', bài 1 đến bài 5', day: '2026-11-20' } }));
  let t0 = Date.now();
  for (let i = 0; i < 1000; i += 200) await call('POST', `/api/s/${a.code}/ops`, { token: a.t, body: { ops: ops.slice(i, i + 200) } });
  const r7 = await call('POST', `/api/s/${a.code}/ops`, { token: a.t, body: { ops: [op({ t: 'task.upsert', task: { id: 'new', content: 'Việc thứ 1001', day: '2026-11-21' } })] } });
  t0 = Date.now(); const g7 = await call('GET', `/api/s/${a.code}`, { token: a.t }); const ms = Date.now() - t0;
  ok('TC7 có 1.000 việc vẫn thêm/lưu được', r7.status === 200 && g7.body.data.tasks.length === 1001, `1001 việc, tải lại ${ms}ms, ${(JSON.stringify(g7.body).length / 1024).toFixed(0)}KB`);

  // TC8
  const b = await student('Live B'); const shared = tok();
  for (const s of [a, b]) { await call('POST', '/api/link', { body: { code: s.code, label: 'Bố', token: shared } }); const d = (await call('GET', `/api/s/${s.code}`, { token: s.t })).body.data; const l = d.links.find(x => x.label === 'Bố'); await call('POST', `/api/s/${s.code}/ops`, { token: s.t, body: { ops: [op({ t: 'link.approve', id: l.id })] } }); }
  await call('POST', `/api/s/${b.code}/ops`, { token: shared, body: { ops: [op({ t: 'reminder.add', content: 'chỉ cho B', day: '2026-11-05' })] } });
  const da = (await call('GET', `/api/s/${a.code}`, { token: shared })).body.data, db = (await call('GET', `/api/s/${b.code}`, { token: shared })).body.data;
  ok('TC8 một phụ huynh hai con không lẫn dữ liệu', da.name === 'Live A' && db.name === 'Live B' && db.tasks.length === 1 && !da.tasks.some(t => t.content === 'chỉ cho B') && (await call('GET', `/api/s/${b.code}`, { token: a.t })).status === 403);

  // TC14: ghi đồng thời
  const c = await student('Live C'); const pc = await parentOf(c);
  const rs = await Promise.all(Array.from({ length: 10 }, (_, i) => [
    call('POST', `/api/s/${c.code}/ops`, { token: c.t, body: { ops: [op({ t: 'task.upsert', task: { id: 's' + i, content: 'HS ' + i, day: '2026-11-05' } })] } }),
    call('POST', `/api/s/${c.code}/ops`, { token: pc, body: { ops: [op({ t: 'reminder.add', content: 'PH ' + i, day: '2026-11-05' })] } }),
  ]).flat());
  const dc = (await call('GET', `/api/s/${c.code}`, { token: c.t })).body.data;
  ok('TC14 20 lượt ghi đồng thời (học sinh + phụ huynh) giữ đủ cả 20', dc.tasks.length === 20, `HTTP: ${[...new Set(rs.map(r => r.status))].join(',')}, còn ${dc.tasks.length}/20 việc`);

  // TC16
  await call('POST', `/api/s/${c.code}/ops`, { token: c.t, body: { ops: [op({ t: 'extra.upsert', w: 1, item: { id: 'e1', name: 'Toán nâng cao', place: 'Nhà cô Lan', start: '17:30', end: '19:00' } }), op({ t: 'task.upsert', task: { id: 'kt', kind: 'test', content: 'Kiểm tra Lý', day: '2026-11-10' } })] } });
  const cal = await call('GET', `/api/cal/${c.data.calToken}.ics`);
  ok('TC16 link lịch điện thoại trả lịch hợp lệ có học thêm hằng tuần và bài kiểm tra', cal.status === 200 && /RRULE:FREQ=WEEKLY;BYDAY=TU/.test(cal.body) && /T173000/.test(cal.body) && /Kiểm tra: Kiểm tra Lý/.test(cal.body));
  await call('POST', `/api/s/${c.code}/ops`, { token: c.t, body: { ops: [op({ t: 'extra.upsert', w: 1, item: { id: 'e1', name: 'Toán nâng cao', start: '18:00', end: '19:30' } })] } });
  const cal2 = await call('GET', `/api/cal/${c.data.calToken}.ics`);
  ok('TC16b đổi giờ học thêm thì link lịch đổi theo ngay', /T180000/.test(cal2.body) && !/T173000/.test(cal2.body));

  // Thông báo đẩy thật qua dịch vụ: đăng ký trỏ tới httpbin (trả 201) để kiểm mã hoá + VAPID + gửi
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const sub = { endpoint: 'https://httpbin.org/status/201', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
  ok('Bật thông báo (lưu đăng ký) cho học sinh', (await call('POST', `/api/s/${c.code}/push`, { token: c.t, body: { sub } })).body.hasPush === true);
  const pn = await call('POST', '/.netlify/functions/push-now', { headers: { 'x-push-secret': process.argv[4] || '' }, body: { code: c.code, payload: { title: 'Thử', body: 'Kiểm tra gửi' } } });
  ok('TC6/15 máy chủ mã hoá và gửi được thông báo đẩy', pn.body?.result === 'sent', JSON.stringify(pn.body));
  const sub410 = { ...sub, endpoint: 'https://httpbin.org/status/410' };
  await call('POST', `/api/s/${c.code}/push`, { token: c.t, body: { sub: sub410 } });
  const pg = await call('POST', '/.netlify/functions/push-now', { headers: { 'x-push-secret': process.argv[4] || '' }, body: { code: c.code, payload: { title: 'x' } } });
  ok('Đăng ký hết hạn (410) thì máy chủ tự gỡ', pg.body?.result === 'gone' && (await call('GET', `/api/s/${c.code}`, { token: c.t })).body.data.hasPush === false);

  // TC17: nhập V19 (dữ liệu giả, mã thử)
  const oo = tok(), op2 = tok(), sha = s => crypto.createHash('sha256').update(s).digest('hex');
  const code17 = String(90000000 + Math.floor(Math.random() * 9999999)); made.push(code17);
  const fam = { student: 'V19 Thử', className: '7C', school: [['Toán'], [], [], [], [], [], []], extra: [[], [{ name: 'Anh', place: 'Trung tâm', start: '18:00', end: '19:00' }], [], [], [], [], []], tasks: [{ id: 'x1', kind: 'reminder', content: 'Mang sách', day: '2026-11-05', done: false }] };
  const im = await call('POST', '/api/admin/import', { headers: { 'x-admin-token': ADM }, body: { items: [{ code: code17, family: JSON.stringify(fam), access: { owner: sha(oo), parents: [sha(op2)] } }] } });
  const d17 = (await call('GET', `/api/s/${code17}`, { token: oo })).body.data;
  ok('TC17 nhập dữ liệu V19: giữ mã, lịch, học thêm, việc; token cũ học sinh + phụ huynh dùng tiếp', im.body.results?.[0]?.ok && d17?.code === code17 && d17.lessons[0][0] === 'Toán' && d17.extras[1][0].start === '18:00' && (await call('GET', `/api/s/${code17}`, { token: op2 })).body.data?.role === 'parent');

  // TC18: 200 phiên đồng thời (100 đọc chờ dài + 100 ghi) trên 20 học sinh
  const pool = [a, b, c];
  for (let i = 0; i < 7; i++) pool.push(await student('Tải ' + i));
  t0 = Date.now();
  const load = await Promise.all(Array.from({ length: 200 }, (_, i) => { const s = pool[i % pool.length];
    return i % 2 ? call('GET', `/api/s/${s.code}`, { token: s.t }) : call('POST', `/api/s/${s.code}/ops`, { token: s.t, body: { ops: [op({ t: 'task.upsert', task: { id: 'load' + i, content: 'Tải ' + i, day: '2026-11-06' } })] } }); }));
  const codes = {}; load.forEach(r => codes[r.status] = (codes[r.status] || 0) + 1);
  let kept = 0; for (const s of pool) kept += (await call('GET', `/api/s/${s.code}`, { token: s.t })).body.data.tasks.filter(t => t.id.startsWith('load')).length;
  ok('TC18 200 phiên cùng lúc không lỗi máy chủ, không mất ghi', !Object.keys(codes).some(k => +k >= 500) && kept === 100, `HTTP ${JSON.stringify(codes)}, ${Date.now() - t0}ms, ghi giữ ${kept}/100`);
} catch (e) { ok('Lỗi chạy', false, e.stack); }
finally {
  const del = await call('POST', '/api/admin/delete', { headers: { 'x-admin-token': ADM }, body: { codes: made } });
  console.log('Dọn dữ liệu thử:', del.body.results.filter(r => r.ok).length + '/' + made.length);
  console.log('TONG', res.filter(r => r[1]).length, '/', res.length);
}
