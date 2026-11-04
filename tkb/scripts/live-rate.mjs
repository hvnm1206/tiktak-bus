import crypto from 'node:crypto';
const [BASE, ADM] = process.argv.slice(2); const made = [];
const tok = () => crypto.randomBytes(32).toString('hex'); let n = 0; const op = o => ({ opId: 'r' + Date.now() + (++n), ...o });
const call = async (m, p, { body, token, headers = {} } = {}) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(token ? { 'x-token': token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
const st = tok(); const s = (await call('POST', '/api/student', { body: { name: 'Rate', token: st } })).body; made.push(s.code);
// TC11: phụ huynh xoá dữ liệu trình duyệt rồi kết nối lại 20 lần (mỗi lần máy "mới")
let okN = 0;
for (let i = 0; i < 20; i++) {
  const pt = tok(); const r = await call('POST', '/api/link', { body: { code: s.code, label: 'Mẹ', token: pt } });
  const d = (await call('GET', `/api/s/${s.code}`, { token: st })).body.data;
  const pend = d.links.find(l => l.status === 'pending'), old = d.links.filter(l => l.status === 'approved');
  await call('POST', `/api/s/${s.code}/ops`, { token: st, body: { ops: [op({ t: 'link.approve', id: pend.id }), ...old.map(l => op({ t: 'link.remove', id: l.id }))] } });
  if (r.status === 200 && (await call('GET', `/api/s/${s.code}`, { token: pt })).status === 200) okN++;
}
console.log((okN === 20 ? 'PASS' : 'FAIL') + ' TC11 kết nối lại 20 lần đều được — ' + okN + '/20');
// TC10: 20 mã sai từ một máy → bị chặn, mã đúng cũng chặn với máy đó
const codes = [];
for (let i = 0; i < 20; i++) codes.push((await call('POST', '/api/link', { body: { code: String(10000000 + Math.floor(Math.random() * 1e7)), token: tok() } })).status);
const blocked = await call('POST', '/api/link', { body: { code: s.code, token: tok() } });
console.log((codes.filter(c => c === 404).length >= 19 && blocked.status === 429 ? 'PASS' : 'FAIL') + ' TC10 thử 20 mã sai thì máy đó bị chặn — mã sai: ' + JSON.stringify([...new Set(codes)]) + ', lần 21 (mã đúng): ' + blocked.status + ' "' + blocked.body.error + '"');
const del = await call('POST', '/api/admin/delete', { headers: { 'x-admin-token': ADM }, body: { codes: made } });
console.log('Dọn:', JSON.stringify(del.body.results));
