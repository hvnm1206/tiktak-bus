import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, sha256hex, vnDate, pushSlots } from '../lib/api.mjs';
import { memoryKV } from '../lib/kv.mjs';

let clock = Date.parse('2026-11-04T05:00:00Z'); // 12:00 giờ VN, Thứ Tư
function setup(opts = {}) {
  clock = Date.parse('2026-11-04T05:00:00Z');
  const kv = memoryKV(), sent = [];
  const api = createApi({ kv, now: () => clock, adminToken: 'adm', notify: async (code, p) => { sent.push({ code, ...p }); }, sleep: async () => { clock += 2000; }, ...opts });
  let ipN = 0;
  const call = async (method, path, { body, token, ip = '1.1.1.1', headers = {} } = {}) => {
    const r = await api(new Request('http://x' + path, { method, headers: { ...(token ? { 'x-token': token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }), ip);
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, body: ct.includes('json') ? await r.json() : await r.text() };
  };
  return { kv, api, call, sent, newIp: () => '9.9.9.' + (++ipN) };
}
const tok = c => c.repeat(64);
let opn = 0; const op = o => ({ opId: 'op' + (++opn), ...o });

async function student(env, name = 'An') {
  const r = await env.call('POST', '/api/student', { body: { name, className: '9A', token: tok('s') } });
  assert.equal(r.status, 200); return r.body;
}
async function linkParent(env, code, t = tok('p'), label = 'Mẹ') {
  const r = await env.call('POST', '/api/link', { body: { code, label, token: t } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const st = await env.call('GET', `/api/s/${code}`, { token: tok('s') });
  const l = st.body.data.links.find(x => x.label === label && x.status === 'pending');
  await env.call('POST', `/api/s/${code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'link.approve', id: l.id })] } });
  return l.id;
}

test('TC1 học sinh nhập tên lần đầu thì có mã 8 số và mã khôi phục', async () => {
  const env = setup(); const s = await student(env);
  assert.match(s.code, /^\d{8}$/); assert.equal(s.recovery.length, 12);
  assert.equal(s.data.name, 'An'); assert.equal(s.data.role, 'student');
  assert.ok(!('owner' in s.data) && !('recovery' in s.data.links));
});

test('TC2 một ngày 9 tiết thì lưu đủ 9', async () => {
  const env = setup(); const s = await student(env);
  const list = ['Toán', 'Văn', 'Anh', 'Lý', 'Hoá', 'Sinh', 'Sử', 'Địa', 'GDCD'];
  const r = await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'lessons.set', w: 0, list })] } });
  assert.deepEqual(r.body.data.lessons[0], list);
});

test('TC3 phụ huynh nhập mã đúng: chưa duyệt thì không thấy gì; duyệt xong thì thấy', async () => {
  const env = setup(); const s = await student(env);
  const r = await env.call('POST', '/api/link', { body: { code: s.code, label: 'Mẹ', token: tok('p') } });
  assert.equal(r.body.status, 'pending'); assert.equal(r.body.data, undefined);
  const g = await env.call('GET', `/api/s/${s.code}`, { token: tok('p') });
  assert.equal(g.status, 403); assert.equal(g.body.pending, true); assert.equal(g.body.data, undefined);
  const st = await env.call('GET', `/api/s/${s.code}`, { token: tok('s') });
  const l = st.body.data.links[0]; assert.equal(l.status, 'pending'); assert.equal(l.label, 'Mẹ');
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'link.approve', id: l.id })] } });
  const g2 = await env.call('GET', `/api/s/${s.code}`, { token: tok('p') });
  assert.equal(g2.status, 200); assert.equal(g2.body.data.name, 'An'); assert.equal(g2.body.data.role, 'parent');
  assert.equal(g2.body.data.links, undefined, 'phụ huynh không thấy danh sách thiết bị');
});

test('TC4 đọc chờ dài: có thay đổi thì trả ngay, không thì trả same', async () => {
  const env = setup(); const s = await student(env); await linkParent(env, s.code);
  const g = await env.call('GET', `/api/s/${s.code}`, { token: tok('p') });
  const rev = g.body.data.rev;
  const same = await env.call('GET', `/api/s/${s.code}?rev=${rev}&wait=4`, { token: tok('p') });
  assert.equal(same.body.same, true);
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'lessons.set', w: 2, list: ['Toán'] })] } });
  const ch = await env.call('GET', `/api/s/${s.code}?rev=${rev}&wait=20`, { token: tok('p') });
  assert.deepEqual(ch.body.data.lessons[2], ['Toán']);
});

test('TC5 phụ huynh gọi thẳng máy chủ để sửa lịch thì bị từ chối', async () => {
  const env = setup(); const s = await student(env); await linkParent(env, s.code);
  for (const o of [{ t: 'lessons.set', w: 0, list: ['X'] }, { t: 'task.upsert', task: { id: 'a', content: 'x', day: '2026-11-05' } }, { t: 'task.del', id: 'a' }, { t: 'link.approve', id: 'x' }, { t: 'profile', name: 'Y' }]) {
    const r = await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('p'), body: { ops: [op(o)] } });
    assert.equal(r.status, 403, o.t);
  }
  const r = await env.call('POST', `/api/s/${s.code}/recovery`, { token: tok('p') }); assert.equal(r.status, 403);
  const n = await env.call('GET', `/api/s/${s.code}`, { token: tok('x') }); assert.equal(n.status, 403);
});

test('TC6 lời nhắc phụ huynh: học sinh thấy, có thông báo, xoá được và không quay lại', async () => {
  const env = setup(); const s = await student(env); await linkParent(env, s.code);
  await env.call('POST', `/api/s/${s.code}/push`, { token: tok('s'), body: { sub: { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } } } });
  const r = await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('p'), body: { ops: [op({ t: 'reminder.add', content: 'Mang áo khoác', day: '2026-11-05' })] } });
  assert.equal(r.status, 200);
  assert.equal(env.sent.at(-1).title, 'Lời nhắc từ Mẹ');
  let d = (await env.call('GET', `/api/s/${s.code}`, { token: tok('s') })).body.data;
  const rem = d.tasks.find(t => t.kind === 'reminder'); assert.equal(rem.from, 'Mẹ');
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'task.del', id: rem.id })] } });
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'lessons.set', w: 1, list: ['Anh'] })] } });
  d = (await env.call('GET', `/api/s/${s.code}`, { token: tok('s') })).body.data;
  assert.equal(d.tasks.length, 0);
});

test('TC7 học sinh có 1.000 việc vẫn thêm, sửa, lưu bình thường', async () => {
  const env = setup(); const s = await student(env);
  const ops = []; for (let i = 0; i < 1000; i++) ops.push(op({ t: 'task.upsert', task: { id: 'k' + i, kind: 'homework', content: 'Làm bài tập Toán trang ' + i + ', bài 1 đến bài 5', day: '2026-11-20' } }));
  for (let i = 0; i < 1000; i += 200) { const r = await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: ops.slice(i, i + 200) } }); assert.equal(r.status, 200); }
  const r = await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'task.upsert', task: { id: 'k5', content: 'Đã sửa', day: '2026-11-21' } }), op({ t: 'task.upsert', task: { id: 'new', content: 'Việc mới', day: '2026-11-21' } })] } });
  assert.equal(r.status, 200); assert.equal(r.body.data.tasks.length, 1001); assert.equal(r.body.data.tasks.find(t => t.id === 'k5').content, 'Đã sửa');
});

test('TC7b việc đã xong quá 45 ngày tự chuyển sang lưu trữ', async () => {
  const env = setup(); const s = await student(env);
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'task.upsert', task: { id: 'old', content: 'cũ', day: '2026-08-01', done: true } }), op({ t: 'task.upsert', task: { id: 'open', content: 'chưa xong', day: '2026-08-01' } })] } });
  const d = (await env.call('GET', `/api/s/${s.code}`, { token: tok('s') })).body.data;
  assert.deepEqual(d.tasks.map(t => t.id), ['open']);
  assert.ok((await env.kv.get(`ar/${s.code}/2026-08`)).data.old);
});

test('TC8 một phụ huynh hai con: dữ liệu không lẫn', async () => {
  const env = setup();
  const a = await student(env, 'An');
  const b2 = (await env.call('POST', '/api/student', { body: { name: 'Bình', token: tok('t') } })).body;
  await linkParent(env, a.code);
  await env.call('POST', '/api/link', { body: { code: b2.code, label: 'Mẹ', token: tok('p') } });
  const l = (await env.call('GET', `/api/s/${b2.code}`, { token: tok('t') })).body.data.links[0];
  await env.call('POST', `/api/s/${b2.code}/ops`, { token: tok('t'), body: { ops: [op({ t: 'link.approve', id: l.id })] } });
  await env.call('POST', `/api/s/${a.code}/ops`, { token: tok('p'), body: { ops: [op({ t: 'reminder.add', content: 'cho An', day: '2026-11-05' })] } });
  const da = (await env.call('GET', `/api/s/${a.code}`, { token: tok('p') })).body.data, db = (await env.call('GET', `/api/s/${b2.code}`, { token: tok('p') })).body.data;
  assert.equal(da.name, 'An'); assert.equal(db.name, 'Bình'); assert.equal(da.tasks.length, 1); assert.equal(db.tasks.length, 0);
  // Học sinh này không đọc được dữ liệu học sinh kia
  assert.equal((await env.call('GET', `/api/s/${b2.code}`, { token: tok('s') })).status, 403);
});

test('TC9 học sinh gỡ phụ huynh thì máy đó mất quyền ngay', async () => {
  const env = setup(); const s = await student(env); const id = await linkParent(env, s.code);
  assert.equal((await env.call('GET', `/api/s/${s.code}`, { token: tok('p') })).status, 200);
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'link.remove', id })] } });
  const g = await env.call('GET', `/api/s/${s.code}`, { token: tok('p') });
  assert.equal(g.status, 403); assert.equal(g.body.revoked, true);
});

test('TC10 một máy thử 20 mã sai thì bị chặn; phụ huynh ở mạng khác vẫn kết nối được', async () => {
  const env = setup(); const s = await student(env);
  for (let i = 0; i < 20; i++) { const r = await env.call('POST', '/api/link', { body: { code: String(20000000 + i), token: tok('z') }, ip: '6.6.6.6' }); assert.equal(r.status, 404); }
  const blocked = await env.call('POST', '/api/link', { body: { code: s.code, token: tok('z') }, ip: '6.6.6.6' });
  assert.equal(blocked.status, 429);
  const ok = await env.call('POST', '/api/link', { body: { code: s.code, label: 'Bố', token: tok('b') }, ip: '7.7.7.7' });
  assert.equal(ok.status, 200); assert.equal(ok.body.status, 'pending');
});

test('TC10b quá 5 yêu cầu chờ duyệt thì từ chối thêm; quá 7 ngày yêu cầu chờ tự hết hạn', async () => {
  const env = setup(); const s = await student(env);
  for (let i = 0; i < 5; i++) assert.equal((await env.call('POST', '/api/link', { body: { code: s.code, token: tok(String(i)) }, ip: env.newIp() })).status, 200);
  assert.equal((await env.call('POST', '/api/link', { body: { code: s.code, token: tok('9') }, ip: env.newIp() })).status, 429);
  clock += 8 * 864e5;
  assert.equal((await env.call('POST', '/api/link', { body: { code: s.code, token: tok('9') }, ip: env.newIp() })).status, 200);
});

test('TC11 phụ huynh xoá dữ liệu trình duyệt rồi kết nối lại 20 lần vẫn được', async () => {
  const env = setup(); const s = await student(env);
  for (let i = 0; i < 20; i++) {
    const t = ('pp' + i).padEnd(64, 'x');
    const r = await env.call('POST', '/api/link', { body: { code: s.code, label: 'Mẹ', token: t }, ip: env.newIp() });
    assert.equal(r.status, 200, 'lần ' + (i + 1));
    const d = (await env.call('GET', `/api/s/${s.code}`, { token: tok('s') })).body.data;
    const pend = d.links.find(l => l.status === 'pending');
    const old = d.links.filter(l => l.status === 'approved');
    await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'link.approve', id: pend.id }), ...old.map(l => op({ t: 'link.remove', id: l.id }))] } });
    assert.equal((await env.call('GET', `/api/s/${s.code}`, { token: t })).status, 200);
  }
});

test('TC12 đổi máy bằng mã chuyển máy: dữ liệu còn nguyên, máy cũ mất quyền', async () => {
  const env = setup(); const s = await student(env); await linkParent(env, s.code);
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'lessons.set', w: 0, list: ['Toán', 'Văn'] })] } });
  const h = await env.call('POST', `/api/s/${s.code}/handover`, { token: tok('p') });
  assert.match(h.body.pin, /^\d{6}$/);
  const c = await env.call('POST', '/api/claim', { body: { pin: h.body.pin, token: tok('n') } });
  assert.equal(c.status, 200); assert.deepEqual(c.body.data.lessons[0], ['Toán', 'Văn']);
  assert.equal((await env.call('GET', `/api/s/${s.code}`, { token: tok('s') })).status, 403);
  assert.equal((await env.call('GET', `/api/s/${s.code}`, { token: tok('n') })).body.data.role, 'student');
  assert.equal((await env.call('GET', `/api/s/${s.code}`, { token: tok('p') })).status, 200, 'phụ huynh vẫn giữ quyền');
  assert.equal((await env.call('POST', '/api/claim', { body: { pin: h.body.pin, token: tok('q') } })).status, 400, 'mã dùng một lần');
  const h2 = await env.call('POST', `/api/s/${s.code}/handover`, { token: tok('p') });
  clock += 11 * 60e3;
  assert.equal((await env.call('POST', '/api/claim', { body: { pin: h2.body.pin, token: tok('q') } })).status, 400, 'hết hạn 10 phút');
});

test('TC12b khôi phục bằng mã khôi phục; sai thì không được', async () => {
  const env = setup(); const s = await student(env);
  assert.equal((await env.call('POST', '/api/recover', { body: { code: s.code, recovery: 'AAAAAAAAAAAA', token: tok('n') } })).status, 400);
  const r = await env.call('POST', '/api/recover', { body: { code: s.code, recovery: s.recovery.toLowerCase(), token: tok('n') } });
  assert.equal(r.status, 200);
  assert.equal((await env.call('GET', `/api/s/${s.code}`, { token: tok('s') })).status, 403);
});

test('TC13 gửi lại thao tác khi mất mạng không nhân đôi', async () => {
  const env = setup(); const s = await student(env);
  const ops = [op({ t: 'task.upsert', task: { id: 'a', content: 'A', day: '2026-11-05' } }), op({ t: 'reminder.add', content: 'x', day: '2026-11-05' })].slice(0, 1);
  ops.push(op({ t: 'task.upsert', task: { id: 'b', content: 'B', day: '2026-11-05' } }), op({ t: 'task.done', id: 'a', done: true }));
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops } });
  const again = await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops } });
  assert.equal(again.status, 200); assert.equal(again.body.data.tasks.length, 2);
  // lời nhắc gửi 2 lần cùng opId chỉ có 1
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [{ opId: 'same', t: 'task.upsert', task: { id: 'c', content: 'C', day: '2026-11-05' } }] } });
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [{ opId: 'same', t: 'task.del', id: 'c' }] } });
  const d = (await env.call('GET', `/api/s/${s.code}`, { token: tok('s') })).body.data; assert.equal(d.tasks.length, 3);
});

test('TC14 hai bên ghi cùng lúc vào hai mục khác nhau thì giữ cả hai', async () => {
  const env = setup(); const s = await student(env); await linkParent(env, s.code);
  const reqs = [];
  for (let i = 0; i < 10; i++) {
    reqs.push(env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'task.upsert', task: { id: 's' + i, content: 'HS ' + i, day: '2026-11-05' } })] } }));
    reqs.push(env.call('POST', `/api/s/${s.code}/ops`, { token: tok('p'), body: { ops: [op({ t: 'reminder.add', content: 'PH ' + i, day: '2026-11-05' })] } }));
  }
  const rs = await Promise.all(reqs);
  assert.ok(rs.every(r => r.status === 200), rs.map(r => r.status).join(','));
  const d = (await env.call('GET', `/api/s/${s.code}`, { token: tok('s') })).body.data;
  assert.equal(d.tasks.length, 20);
});

test('TC16 link lịch điện thoại có học thêm hằng tuần và bài kiểm tra; đổi giờ thì link cập nhật', async () => {
  const env = setup(); const s = await student(env);
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'extra.upsert', w: 1, item: { id: 'e1', name: 'Toán nâng cao', place: 'Nhà cô Lan, số 5', start: '17:00', end: '18:30' } }), op({ t: 'task.upsert', task: { id: 't1', kind: 'test', content: 'Kiểm tra 15 phút Lý', day: '2026-11-10' } })] } });
  let cal = await env.call('GET', `/api/cal/${s.data.calToken}.ics`);
  assert.equal(cal.status, 200);
  assert.match(cal.body, /RRULE:FREQ=WEEKLY;BYDAY=TU/); assert.match(cal.body, /DTSTART;TZID=Asia\/Ho_Chi_Minh:20261110T170000/);
  assert.match(cal.body, /LOCATION:Nhà cô Lan\\, số 5/); assert.match(cal.body, /DTSTART;VALUE=DATE:20261110/);
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'extra.upsert', w: 1, item: { id: 'e1', name: 'Toán nâng cao', start: '18:00', end: '19:30' } })] } });
  cal = await env.call('GET', `/api/cal/${s.data.calToken}.ics`);
  assert.match(cal.body, /T180000/); assert.doesNotMatch(cal.body, /T170000/);
  assert.equal((await env.call('GET', '/api/cal/' + 'a'.repeat(24) + '.ics')).status, 404);
});

test('TC15 chỉ mục nhắc học thêm 30 phút trước, chỉ khi bật thông báo', async () => {
  const env = setup(); const s = await student(env);
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'extra.upsert', w: 1, item: { id: 'e1', name: 'Anh', start: '17:10', end: '18:30' } }), op({ t: 'extra.upsert', w: 0, item: { id: 'e2', name: 'Bơi', start: '00:10', end: '01:00' } })] } });
  assert.equal((await env.kv.list('px/')).length, 0);
  await env.call('POST', `/api/s/${s.code}/push`, { token: tok('s'), body: { sub: { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } } } });
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'lessons.set', w: 0, list: [] })] } });
  assert.deepEqual((await env.kv.list('px/')).sort(), [`px/11640/${s.code}`, `px/62340/${s.code}`]);
  assert.ok(await env.kv.get('pn/' + s.code));
  await env.call('POST', `/api/s/${s.code}/ops`, { token: tok('s'), body: { ops: [op({ t: 'extra.del', w: 1, id: 'e1' })] } });
  assert.deepEqual(await env.kv.list('px/'), [`px/62340/${s.code}`]);
});

test('TC17 nhập dữ liệu V19: giữ mã, lịch, việc; token cũ của học sinh và phụ huynh vẫn dùng được', async () => {
  const env = setup();
  const oldOwner = 'f'.repeat(64), oldParent = 'e'.repeat(64);
  const family = { student: 'Minh', className: '8B', school: [['Toán', 'Văn'], [], [], [], [], [], []], extra: [[], ['Tiếng Anh', { name: 'Toán', place: 'Cô Hà', start: '17:00', end: '18:00' }], [], [], [], [], []], notes: '', tasks: [{ id: 'x', kind: 'reminder', content: 'Mang sách', day: '2026-11-05', done: false }] };
  const r = await env.call('POST', '/api/admin/import', { headers: { 'x-admin-token': 'adm' }, body: { items: [{ code: '12345678', family: JSON.stringify(family), access: { owner: await sha256hex(oldOwner), parents: [await sha256hex(oldParent)] } }] } });
  assert.equal(r.body.results[0].ok, true);
  const d = (await env.call('GET', '/api/s/12345678', { token: oldOwner })).body.data;
  assert.equal(d.name, 'Minh'); assert.deepEqual(d.lessons[0], ['Toán', 'Văn']); assert.equal(d.extras[1].length, 2); assert.equal(d.tasks[0].content, 'Mang sách');
  assert.equal((await env.call('GET', '/api/s/12345678', { token: oldParent })).body.data.role, 'parent');
  const again = await env.call('POST', '/api/admin/import', { headers: { 'x-admin-token': 'adm' }, body: { items: [{ code: '12345678', family }] } });
  assert.equal(again.body.results[0].ok, false, 'không ghi đè');
  assert.equal((await env.call('POST', '/api/admin/import', { body: { items: [] } })).status, 401);
});

test('Băm khớp V19 (SHA-256 hex của chuỗi)', async () => {
  assert.equal(await sha256hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(vnDate(Date.parse('2026-11-04T18:00:00Z')), '2026-11-05');
});

test('Quản trị xoá dữ liệu thử: xoá sạch hồ sơ, link lịch', async () => {
  const env = setup(); const s = await student(env);
  assert.equal((await env.call('POST', '/api/admin/delete', { body: { codes: [s.code] } })).status, 401);
  const r = await env.call('POST', '/api/admin/delete', { headers: { 'x-admin-token': 'adm' }, body: { codes: [s.code] } });
  assert.equal(r.body.results[0].ok, true);
  assert.equal(await env.kv.get('st/' + s.code), null); assert.equal(await env.kv.get('cal/' + s.data.calToken), null);
});

test('Khoá nhập chỉ được nhập, không xoá/xem danh sách', async () => {
  const env = setup({ importToken: 'imp' });
  assert.equal((await env.call('POST', '/api/admin/import', { headers: { 'x-admin-token': 'imp' }, body: { items: [] } })).status, 200);
  assert.equal((await env.call('POST', '/api/admin/delete', { headers: { 'x-admin-token': 'imp' }, body: { codes: [] } })).status, 401);
  assert.equal((await env.call('GET', '/api/admin/list', { headers: { 'x-admin-token': 'imp' } })).status, 401);
  assert.equal((await env.call('GET', '/api/admin/list', { headers: { 'x-admin-token': 'adm' } })).status, 200);
});
