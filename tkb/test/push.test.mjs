import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../lib/api.mjs';
import { memoryKV } from '../lib/kv.mjs';
import { runSchedule, sendTo } from '../lib/push.mjs';

const tok = 's'.repeat(64);
async function setup(now) {
  const kv = memoryKV(), api = createApi({ kv, now: () => now });
  const call = async (m, p, body) => (await api(new Request('http://x' + p, { method: m, headers: { 'x-token': tok }, body: JSON.stringify(body) }), '1.1.1.1')).json();
  const s = await call('POST', '/api/student', { name: 'An', token: tok });
  await call('POST', `/api/s/${s.code}/push`, { sub: { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } } });
  return { kv, call, code: s.code };
}
const fakePush = (fail) => { const sent = []; return { sent, sendNotification: async (sub, body) => { if (fail) { const e = new Error('gone'); e.statusCode = fail; throw e; } sent.push(JSON.parse(body)); } }; };

test('TC15a 30 phút trước học thêm thì gửi thông báo (Thứ Ba 16:30 cho buổi 17:00)', async () => {
  const tue1630 = Date.parse('2026-11-10T09:30:00Z'); // 16:30 VN, Thứ Ba
  const e = await setup(tue1630);
  await e.call('POST', `/api/s/${e.code}/ops`, { ops: [{ opId: 'a', t: 'extra.upsert', w: 1, item: { id: 'e1', name: 'Toán', place: 'Cô Hà', start: '17:00', end: '18:00' } }] });
  const wp = fakePush();
  const r = await runSchedule(e.kv, wp, tue1630 + 60e3);
  assert.equal(r.extra, 1); assert.match(wp.sent[0].title, /17:00: Toán/);
  const again = await runSchedule(e.kv, wp, tue1630 + 120e3);
  assert.equal(again.skipped, true, 'chạy trùng khung giờ thì không gửi lần 2');
});

test('TC15b 20:00 nhắc việc ngày mai; không có việc và không có tiết thì không gửi', async () => {
  const wed20 = Date.parse('2026-11-04T13:00:00Z'); // 20:00 VN Thứ Tư
  const e = await setup(wed20);
  const wp = fakePush();
  assert.equal((await runSchedule(e.kv, wp, wed20)).night, 0);
  await e.call('POST', `/api/s/${e.code}/ops`, { ops: [{ opId: 'b', t: 'task.upsert', task: { id: 't1', content: 'Làm bài Toán', day: '2026-11-05' } }] });
  const r = await runSchedule(e.kv, wp, wed20 + 864e5 * 0 + 5 * 60e3 - 5 * 60e3 + 1); // cùng khung đã chạy → bỏ qua
  assert.equal(r.skipped, true);
  await e.kv.del('pl/2026-11-04-2000');
  const r2 = await runSchedule(e.kv, wp, wed20);
  assert.equal(r2.night, 1); assert.equal(wp.sent[0].title, 'Ngày mai có 1 việc cần làm');
});

test('Đăng ký thông báo hết hạn (410) thì tự gỡ', async () => {
  const e = await setup(Date.now());
  assert.equal(await sendTo(e.kv, fakePush(410), e.code, { title: 'x' }), 'gone');
  assert.equal((await e.kv.get('st/' + e.code)).data.push, null);
  assert.equal(await e.kv.get('pn/' + e.code), null);
});
