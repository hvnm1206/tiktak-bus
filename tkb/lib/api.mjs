// Thời khoá biểu v2 — máy chủ. Logic thuần, chạy được trên Netlify Edge (Deno) và Node (test).
// Thứ trong tuần: 0 = Thứ Hai … 6 = Chủ Nhật (giống V19).

export const VERSION = '2.0.0';

const KINDS = ['homework', 'test', 'prepare', 'reminder', 'other'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const OPS_KEEP = 300;
const ARCHIVE_AFTER_DAYS = 45;
const PENDING_TTL = 7 * 864e5;
const MAX_PENDING = 5;
const MAX_APPROVED = 30;
const MAX_TASKS = 3000;
const TZ_OFFSET = 7 * 3600e3; // Việt Nam, không đổi giờ

export class HttpError extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }
const fail = (s, m, x) => { throw new HttpError(s, m, x); };

export async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function randInt(max) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max; }
function randStr(n, abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') { let s = ''; for (let i = 0; i < n; i++) s += abc[randInt(abc.length)]; return s; }
const newCode8 = () => String(10000000 + randInt(90000000));
const newPin6 = () => String(100000 + randInt(900000));
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';

export function vnDate(ms, addDays = 0) { return new Date(ms + TZ_OFFSET + addDays * 864e5).toISOString().slice(0, 10); }
export function vnWeekday(ms) { return (new Date(ms + TZ_OFFSET).getUTCDay() + 6) % 7; } // 0 = Thứ Hai

export function emptyDoc(code, now) {
  return { v: 2, code, name: '', className: '', notes: '', lessons: [[], [], [], [], [], [], []], extras: [[], [], [], [], [], [], []],
    tasks: {}, owner: '', recovery: '', links: {}, calToken: '', push: null, pxKeys: [], ops: [], rev: 1, created: now, updated: now };
}

// Dữ liệu trả cho máy khách: không bao giờ có băm, token, ops, đăng ký thông báo.
export function view(doc, role, extra = {}) {
  const out = {
    code: doc.code, name: doc.name, className: doc.className, notes: doc.notes || '', rev: doc.rev, updated: doc.updated, role,
    lessons: doc.lessons, extras: doc.extras,
    tasks: Object.values(doc.tasks).sort((a, b) => (a.day || '').localeCompare(b.day || '') || (a.at || 0) - (b.at || 0)),
    ...extra,
  };
  if (role === 'student') {
    out.links = Object.values(doc.links).filter(l => l.status !== 'removed').map(l => ({ id: l.id, label: l.label, status: l.status, at: l.at }));
    out.calToken = doc.calToken;
    out.hasPush = !!doc.push;
  }
  return out;
}

function cleanExtra(it) {
  if (!it || typeof it !== 'object') fail(400, 'Buổi học thêm không hợp lệ');
  const x = { id: str(it.id, 40) || randStr(10), name: str(it.name, 60), place: str(it.place, 100), start: str(it.start, 5), end: str(it.end, 5) };
  if (!x.name) fail(400, 'Thiếu tên buổi học thêm');
  if (x.start && !HM.test(x.start)) fail(400, 'Giờ bắt đầu không hợp lệ');
  if (x.end && !HM.test(x.end)) fail(400, 'Giờ kết thúc không hợp lệ');
  return x;
}
const wday = w => { if (!Number.isInteger(w) || w < 0 || w > 6) fail(400, 'Thứ không hợp lệ'); return w; };

// Áp danh sách thao tác lên hồ sơ (sửa tại chỗ). Trả về số thao tác đã áp và việc phụ huynh nhắc mới.
export function applyOps(doc, ops, actor, now) {
  if (!Array.isArray(ops) || ops.length > 200) fail(400, 'Danh sách thao tác không hợp lệ');
  const seen = new Set(doc.ops);
  let applied = 0; const reminders = [];
  for (const op of ops) {
    const id = str(op?.opId, 60);
    if (!id) fail(400, 'Thiếu mã thao tác');
    if (seen.has(id)) continue; // gửi lại khi mất mạng: bỏ qua, không nhân đôi
    const t = op.t;
    if (actor.role === 'parent' && t !== 'reminder.add') fail(403, 'Phụ huynh chỉ được gửi lời nhắc');
    switch (t) {
      case 'profile': {
        const name = str(op.name, 60); if (!name) fail(400, 'Cần tên học sinh');
        doc.name = name; doc.className = str(op.className, 20); break;
      }
      case 'lessons.set': {
        const w = wday(op.w);
        if (!Array.isArray(op.list) || op.list.length > 20) fail(400, 'Danh sách tiết không hợp lệ');
        doc.lessons[w] = op.list.map(s => str(s, 40)).filter(Boolean); break;
      }
      case 'extra.upsert': {
        const w = wday(op.w), x = cleanExtra(op.item), day = doc.extras[w];
        const i = day.findIndex(e => e.id === x.id);
        if (i >= 0) day[i] = x; else { if (day.length >= 12) fail(400, 'Tối đa 12 buổi học thêm mỗi ngày'); day.push(x); }
        day.sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
        if (Number.isInteger(op.from) && op.from !== w) doc.extras[wday(op.from)] = doc.extras[op.from].filter(e => e.id !== x.id);
        break;
      }
      case 'extra.del': { const w = wday(op.w); doc.extras[w] = doc.extras[w].filter(e => e.id !== op.id); break; }
      case 'task.upsert': {
        const it = op.task || {}, tid = str(it.id, 60); if (!tid) fail(400, 'Thiếu mã việc');
        const old = doc.tasks[tid];
        const content = str(it.content, 300); if (!content) fail(400, 'Nội dung việc trống');
        const day = str(it.day, 10); if (!DAY.test(day)) fail(400, 'Ngày không hợp lệ');
        if (!old && Object.keys(doc.tasks).length >= MAX_TASKS) fail(400, 'Quá nhiều việc chưa xong');
        const kind = old?.kind === 'reminder' ? 'reminder' : (KINDS.includes(it.kind) && it.kind !== 'reminder' ? it.kind : 'homework');
        doc.tasks[tid] = { id: tid, kind, content, day, done: !!it.done, at: old?.at || now, ...(old?.from ? { from: old.from } : {}) };
        break;
      }
      case 'task.done': { const x = doc.tasks[op.id]; if (x) x.done = !!op.done; break; }
      case 'task.del': delete doc.tasks[op.id]; break;
      case 'reminder.add': {
        const content = str(op.content, 300); if (!content) fail(400, 'Lời nhắc trống');
        const day = str(op.day, 10); if (!DAY.test(day)) fail(400, 'Ngày không hợp lệ');
        if (Object.keys(doc.tasks).length >= MAX_TASKS) fail(400, 'Quá nhiều việc chưa xong');
        const tid = str(op.id, 60) || 'r' + randStr(12);
        const task = { id: tid, kind: 'reminder', content, day, done: false, at: now, from: actor.label || 'Phụ huynh' };
        doc.tasks[tid] = task; reminders.push(task); break;
      }
      case 'link.approve': {
        const l = doc.links[op.id]; if (!l || l.status === 'removed') fail(404, 'Không thấy yêu cầu kết nối');
        if (l.status !== 'approved' && Object.values(doc.links).filter(x => x.status === 'approved').length >= MAX_APPROVED) fail(400, 'Đã đủ 30 người, hãy gỡ bớt');
        l.status = 'approved'; l.at = now; break;
      }
      case 'link.remove': {
        const l = doc.links[op.id]; if (l) { l.status = 'removed'; l.tokenHash = ''; l.at = now; } break;
      }
      default: fail(400, 'Thao tác không hỗ trợ: ' + String(t).slice(0, 30));
    }
    seen.add(id); doc.ops.push(id); applied++;
  }
  if (doc.ops.length > OPS_KEEP) doc.ops = doc.ops.slice(-OPS_KEEP);
  return { applied, reminders };
}

// Việc đã xong quá 45 ngày → chuyển sang lưu trữ, giữ hồ sơ gọn.
export function takeArchive(doc, now) {
  const cut = vnDate(now, -ARCHIVE_AFTER_DAYS), out = {};
  for (const [id, t] of Object.entries(doc.tasks)) if (t.done && t.day < cut) { (out[t.day.slice(0, 7)] ||= {})[id] = t; delete doc.tasks[id]; }
  return out;
}

function pruneLinks(doc, now) {
  for (const [id, l] of Object.entries(doc.links)) {
    if (l.status === 'pending' && now - l.at > PENDING_TTL) delete doc.links[id];
    else if (l.status === 'removed' && now - l.at > 30 * 864e5) delete doc.links[id];
  }
}

// Khoá chỉ mục nhắc học thêm: 30 phút trước giờ bắt đầu, làm tròn xuống 5 phút. Thứ theo 0 = Thứ Hai.
export function pushSlots(doc) {
  if (!doc.push) return [];
  const out = new Set();
  doc.extras.forEach((list, w) => list.forEach(e => {
    if (!e.start) return;
    let [h, m] = e.start.split(':').map(Number), t = h * 60 + m - 30, ww = w;
    if (t < 0) { t += 1440; ww = (w + 6) % 7; }
    t -= t % 5;
    out.add(`px/${ww}${String(Math.floor(t / 60)).padStart(2, '0')}${String(t % 60).padStart(2, '0')}/${doc.code}`);
  }));
  return [...out];
}

function ics(doc, now) {
  const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const by = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NMH//Thoi khoa bieu//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:' + esc('TKB ' + (doc.name || '')), 'X-WR-TIMEZONE:Asia/Ho_Chi_Minh', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Ho_Chi_Minh', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:+0700', 'TZOFFSETTO:+0700', 'TZNAME:ICT', 'END:STANDARD', 'END:VTIMEZONE'];
  const today = vnDate(now), wToday = vnWeekday(now);
  doc.extras.forEach((list, w) => list.forEach(e => {
    if (!e.start || !e.end) return;
    const d = vnDate(now, (w - wToday + 7) % 7).replace(/-/g, '');
    L.push('BEGIN:VEVENT', `UID:x-${e.id}-${doc.code}@tkb.nomahubvn.com`, 'DTSTAMP:' + stamp,
      `DTSTART;TZID=Asia/Ho_Chi_Minh:${d}T${e.start.replace(':', '')}00`, `DTEND;TZID=Asia/Ho_Chi_Minh:${d}T${e.end.replace(':', '')}00`,
      'RRULE:FREQ=WEEKLY;BYDAY=' + by[w], 'SUMMARY:' + esc('Học thêm: ' + e.name), ...(e.place ? ['LOCATION:' + esc(e.place)] : []),
      'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.name), 'END:VALARM', 'END:VEVENT');
  }));
  const from = vnDate(now, -30);
  for (const t of Object.values(doc.tasks)) {
    if (t.kind !== 'test' || t.day < from) continue;
    const d = t.day.replace(/-/g, ''), n = new Date(Date.parse(t.day) + 864e5).toISOString().slice(0, 10).replace(/-/g, '');
    L.push('BEGIN:VEVENT', `UID:t-${t.id}-${doc.code}@tkb.nomahubvn.com`, 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + n,
      'SUMMARY:' + esc('Kiểm tra: ' + t.content), 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  // Gập dòng dài theo chuẩn (75 byte)
  return L.map(line => { const b = new TextEncoder().encode(line); if (b.length <= 74) return line;
    let out = '', cur = ''; for (const ch of line) { if (new TextEncoder().encode(cur + ch).length > 73) { out += cur + '\r\n '; cur = ''; } cur += ch; } return out + cur; }).join('\r\n') + '\r\n';
}

export function createApi({ kv, now = () => Date.now(), adminToken = '', importToken = '', salt = 'tkb', notify = null, sleep = ms => new Promise(r => setTimeout(r, ms)), defer = null, publicKey = '' }) {
  const ipHash = ip => sha256hex(salt + '|ip|' + (ip || '?')).then(h => h.slice(0, 16));

  async function hit(action, who, limit, windowSec) {
    const win = Math.floor(now() / 1000 / windowSec), k = `rl/${action}/${win}/${who}`;
    const cur = (await kv.get(k))?.data || { n: 0 };
    if (cur.n >= limit) return false;
    await kv.set(k, { n: cur.n + 1, exp: (win + 1) * windowSec * 1000 });
    return true;
  }
  async function peek(action, who, limit, windowSec) {
    const win = Math.floor(now() / 1000 / windowSec);
    return ((await kv.get(`rl/${action}/${win}/${who}`))?.data?.n || 0) < limit;
  }

  const load = async code => { if (!/^\d{8}$/.test(String(code))) fail(400, 'Mã học sinh gồm 8 chữ số'); return kv.get('st/' + code); };

  async function who(doc, token) {
    if (typeof token !== 'string' || token.length < 32) fail(401, 'Thiết bị chưa đăng ký');
    const h = await sha256hex(token);
    if (doc.owner && doc.owner === h) return { role: 'student' };
    const l = Object.values(doc.links).find(x => x.tokenHash === h);
    if (l?.status === 'approved') return { role: 'parent', label: l.label, linkId: l.id };
    if (l?.status === 'pending') fail(403, 'Đang chờ con đồng ý', { pending: true });
    fail(403, 'Thiết bị này không có quyền với học sinh này', { revoked: true });
  }

  // Đọc → sửa → ghi có điều kiện; thử lại khi có máy khác ghi chen.
  async function mutate(code, fn) {
    for (let i = 0; i < 12; i++) {
      if (i) await new Promise(r => setTimeout(r, 5 + Math.random() * 25 * i)); // lùi ngẫu nhiên khi bị ghi chen
      const cur = await load(code); if (!cur) fail(404, 'Không tìm thấy học sinh');
      const doc = structuredClone(cur.data), t = now();
      const res = await fn(doc, t);
      if (res?.noChange) return { doc: cur.data, res };
      pruneLinks(doc, t);
      const archive = takeArchive(doc, t);
      const oldPx = doc.pxKeys || []; doc.pxKeys = pushSlots(doc);
      doc.rev = (cur.data.rev || 0) + 1; doc.updated = t;
      const w = await kv.set('st/' + code, doc, { ifMatch: cur.etag });
      if (!w.modified) continue;
      const side = [];
      for (const [m, items] of Object.entries(archive)) side.push((async () => { const k = `ar/${code}/${m}`; const a = (await kv.get(k))?.data || {}; await kv.set(k, { ...a, ...items }); })());
      for (const k of oldPx) if (!doc.pxKeys.includes(k)) side.push(kv.del(k));
      for (const k of doc.pxKeys) if (!oldPx.includes(k)) side.push(kv.set(k, 1));
      await Promise.all(side);
      return { doc, res };
    }
    fail(409, 'Máy chủ đang bận, thử lại');
  }

  const R = {
    'GET /api/health': async () => ({ ok: true, version: VERSION, push: !!publicKey }),
    'GET /api/push-key': async () => ({ key: publicKey }),

    // Học sinh mở lần đầu
    'POST /api/student': async (b, ctx) => {
      if (!(await hit('enroll', await ipHash(ctx.ip), 30, 3600))) fail(429, 'Tạo quá nhiều lần, thử lại sau');
      const name = str(b.name, 60); if (!name) fail(400, 'Nhập tên học sinh');
      if (typeof b.token !== 'string' || b.token.length < 32) fail(400, 'Thiếu khoá thiết bị');
      const recovery = randStr(12), t = now();
      for (let i = 0; i < 20; i++) {
        const code = newCode8(), doc = emptyDoc(code, t);
        doc.name = name; doc.className = str(b.className, 20);
        doc.owner = await sha256hex(b.token); doc.recovery = await sha256hex(recovery.toUpperCase()); doc.calToken = randStr(24, 'abcdefghijkmnpqrstuvwxyz23456789');
        const w = await kv.set('st/' + code, doc, { ifNew: true });
        if (!w.modified) continue;
        await kv.set('cal/' + doc.calToken, { code });
        return { code, recovery, data: view(doc, 'student') };
      }
      fail(500, 'Không tạo được mã, thử lại');
    },

    // Đọc (chờ dài tối đa 20 giây nếu chưa có gì mới)
    'GET /api/s/:code': async (_b, ctx) => {
      const since = Number(ctx.url.searchParams.get('rev') || 0), wait = Math.min(Number(ctx.url.searchParams.get('wait') || 0), 20) * 1000;
      const start = now();
      for (;;) {
        const cur = await load(ctx.params.code); if (!cur) fail(404, 'Không tìm thấy học sinh');
        const a = await who(cur.data, ctx.token);
        if (cur.data.rev !== since) return { data: view(cur.data, a.role) };
        if (now() - start >= wait) return { same: true, rev: since };
        await sleep(2000);
      }
    },

    'POST /api/s/:code/ops': async (b, ctx) => {
      let actor, reminders = [];
      const { doc } = await mutate(ctx.params.code, async (d, t) => {
        actor = await who(d, ctx.token);
        const r = applyOps(d, b.ops, actor, t); reminders = r.reminders;
        return r.applied ? null : { noChange: true };
      });
      if (reminders.length && notify && doc.push) {
        const p = notify(doc.code, { title: 'Lời nhắc từ ' + (actor.label || 'phụ huynh'), body: reminders.map(r => r.content).join(' · ').slice(0, 180), tag: 'r-' + reminders[0].id });
        if (defer) defer(p); else await p;
      }
      return { data: view(doc, actor.role) };
    },

    // Phụ huynh xin kết nối
    'POST /api/link': async (b, ctx) => {
      const ih = await ipHash(ctx.ip);
      if (!(await peek('linkfail', ih, 20, 3600))) fail(429, 'Nhập sai quá nhiều lần, thử lại sau 1 giờ');
      if (typeof b.token !== 'string' || b.token.length < 32) fail(400, 'Thiếu khoá thiết bị');
      const label = str(b.label, 30) || 'Phụ huynh';
      const code = String(b.code || '').replace(/\D/g, '');
      const cur = /^\d{8}$/.test(code) ? await kv.get('st/' + code) : null;
      if (!cur) { await hit('linkfail', ih, 1e9, 3600); fail(404, 'Không đúng mã học sinh'); }
      const h = await sha256hex(b.token);
      const { doc, res } = await mutate(code, async (d, t) => {
        const ex = Object.values(d.links).find(l => l.tokenHash === h);
        if (ex) return { noChange: true, status: ex.status };
        if (d.owner === h) fail(400, 'Đây là máy của chính học sinh');
        pruneLinks(d, t);
        if (Object.values(d.links).filter(l => l.status === 'pending').length >= MAX_PENDING) fail(429, 'Đang có nhiều yêu cầu chờ con duyệt, nhờ con kiểm tra');
        const id = 'l' + randStr(10);
        d.links[id] = { id, label, tokenHash: h, status: 'pending', at: t };
        return { status: 'pending' };
      });
      if (res?.status === 'approved') return { status: 'approved', data: view(doc, 'parent') };
      if (doc.push && res?.status === 'pending' && notify) {
        const p = notify(code, { title: label + ' muốn xem thời khoá biểu', body: 'Mở app để đồng ý hoặc từ chối', tag: 'link' });
        if (defer) defer(p); else await p;
      }
      return { status: res?.status || 'pending' };
    },

    // Tạo mã chuyển máy (phụ huynh đã được duyệt hoặc chính học sinh)
    'POST /api/s/:code/handover': async (_b, ctx) => {
      const cur = await load(ctx.params.code); if (!cur) fail(404, 'Không tìm thấy học sinh');
      await who(cur.data, ctx.token);
      for (let i = 0; i < 20; i++) {
        const pin = newPin6();
        const w = await kv.set('ho/' + pin, { code: cur.data.code, exp: now() + 10 * 60e3 }, { ifNew: true });
        if (w.modified) return { pin, expiresIn: 600 };
        const old = (await kv.get('ho/' + pin))?.data; if (old && old.exp < now()) await kv.del('ho/' + pin);
      }
      fail(500, 'Không tạo được mã, thử lại');
    },

    // Máy mới nhận quyền học sinh bằng mã chuyển máy
    'POST /api/claim': async (b, ctx) => {
      const ih = await ipHash(ctx.ip);
      if (!(await hit('claim', ih, 10, 3600))) fail(429, 'Thử quá nhiều lần, thử lại sau 1 giờ');
      if (typeof b.token !== 'string' || b.token.length < 32) fail(400, 'Thiếu khoá thiết bị');
      const pin = String(b.pin || '').replace(/\D/g, '');
      const ho = /^\d{6}$/.test(pin) ? (await kv.get('ho/' + pin))?.data : null;
      if (!ho || ho.exp < now()) fail(400, 'Mã chuyển máy sai hoặc đã hết hạn');
      await kv.del('ho/' + pin);
      const h = await sha256hex(b.token);
      const { doc } = await mutate(ho.code, async d => { d.owner = h; d.push = null; });
      return { code: doc.code, data: view(doc, 'student') };
    },

    // Khôi phục bằng mã khôi phục
    'POST /api/recover': async (b, ctx) => {
      const ih = await ipHash(ctx.ip);
      if (!(await hit('recover', ih, 10, 3600))) fail(429, 'Thử quá nhiều lần, thử lại sau 1 giờ');
      if (typeof b.token !== 'string' || b.token.length < 32) fail(400, 'Thiếu khoá thiết bị');
      const cur = await load(String(b.code || '').replace(/\D/g, ''));
      const rh = await sha256hex(String(b.recovery || '').replace(/[\s-]/g, '').toUpperCase());
      if (!cur || !cur.data.recovery || cur.data.recovery !== rh) fail(400, 'Mã học sinh hoặc mã khôi phục không đúng');
      const h = await sha256hex(b.token);
      const { doc } = await mutate(cur.data.code, async d => { d.owner = h; d.push = null; });
      return { code: doc.code, data: view(doc, 'student') };
    },

    'POST /api/s/:code/recovery': async (_b, ctx) => {
      const recovery = randStr(12);
      await mutate(ctx.params.code, async d => { const a = await who(d, ctx.token); if (a.role !== 'student') fail(403, 'Chỉ học sinh'); d.recovery = await sha256hex(recovery); });
      return { recovery };
    },

    'POST /api/s/:code/push': async (b, ctx) => {
      const sub = b.sub;
      if (sub !== null && (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth || JSON.stringify(sub).length > 2000)) fail(400, 'Đăng ký thông báo không hợp lệ');
      const { doc } = await mutate(ctx.params.code, async d => { const a = await who(d, ctx.token); if (a.role !== 'student') fail(403, 'Chỉ học sinh'); d.push = sub; });
      if (doc.push) await kv.set('pn/' + doc.code, 1); else await kv.del('pn/' + doc.code);
      return { ok: true, hasPush: !!doc.push };
    },

    'GET /api/cal/:file': async (_b, ctx) => {
      const tok = ctx.params.file.replace(/\.ics$/, '');
      const c = /^[a-z0-9]{24}$/.test(tok) ? (await kv.get('cal/' + tok))?.data : null;
      if (!c) fail(404, 'Không tìm thấy lịch');
      const cur = await kv.get('st/' + c.code);
      if (!cur || cur.data.calToken !== tok) fail(404, 'Không tìm thấy lịch');
      return new Response(ics(cur.data, now()), { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
    },

    // Quản trị
    'GET /api/admin/stats': async (_b, ctx) => {
      admin(ctx);
      const keys = await kv.list('st/'); let tasks = 0, links = 0, bytes = 0, maxBytes = 0, push = 0;
      for (let i = 0; i < keys.length; i += 50) for (const r of await Promise.all(keys.slice(i, i + 50).map(k => kv.get(k)))) {
        if (!r) continue; const n = JSON.stringify(r.data).length; bytes += n; maxBytes = Math.max(maxBytes, n);
        tasks += Object.keys(r.data.tasks).length; links += Object.values(r.data.links).filter(l => l.status === 'approved').length; if (r.data.push) push++;
      }
      const cron = (await kv.list('pl/' + vnDate(now()))).map(k => k.slice(14));
      return { students: keys.length, tasks, approvedParents: links, withPush: push, bytes, maxBytes, cronToday: cron.length, cronLast: cron.sort().at(-1) || null };
    },
    'GET /api/admin/list': async (_b, ctx) => {
      admin(ctx);
      const keys = await kv.list('st/'), out = [];
      for (const k of keys) { const d = (await kv.get(k))?.data; if (d) out.push({ code: d.code, name: d.name, created: d.created, tasks: Object.keys(d.tasks).length }); }
      return { students: out };
    },
    // Xoá hẳn học sinh (chỉ dùng cho dữ liệu thử)
    'POST /api/admin/delete': async (b, ctx) => {
      admin(ctx);
      const out = [];
      for (const code of b.codes || []) {
        if (!/^\d{8}$/.test(String(code))) continue;
        const cur = await kv.get('st/' + code); if (!cur) { out.push({ code, ok: false }); continue; }
        const keys = [...(cur.data.pxKeys || []), 'pn/' + code, 'cal/' + cur.data.calToken, ...(await kv.list(`ar/${code}/`))];
        await Promise.all(keys.map(k => kv.del(k))); await kv.del('st/' + code);
        out.push({ code, ok: true });
      }
      return { results: out };
    },
    // Nhập dữ liệu V19: [{ code, family: {...}, access: { owner, parents: [] } }]
    'POST /api/admin/import': async (b, ctx) => {
      admin(ctx, true);
      if (!Array.isArray(b.items)) fail(400, 'Thiếu items');
      const out = [];
      for (const it of b.items) {
        try { out.push(await importV19(it)); } catch (e) { out.push({ code: it?.code, ok: false, error: e.message }); }
      }
      return { results: out };
    },
  };

  function admin(ctx, allowImport = false) {
    const t = ctx.req.headers.get('x-admin-token') || '';
    if (adminToken && t === adminToken) return;
    if (allowImport && importToken && t === importToken) return;
    fail(401, 'Cần quyền quản trị');
  }

  async function importV19({ code, family, access }) {
    code = String(code || ''); if (!/^\d{8}$/.test(code)) fail(400, 'Mã không phải 8 số');
    const f = typeof family === 'string' ? JSON.parse(family) : family || {};
    const t = now(), doc = emptyDoc(code, t);
    doc.name = str(f.student, 60) || 'Học sinh'; doc.className = str(f.className, 20); doc.notes = str(f.notes, 2000);
    for (let w = 0; w < 7; w++) {
      doc.lessons[w] = (f.school?.[w] || []).map(s => str(s, 40)).filter(Boolean).slice(0, 20);
      doc.extras[w] = (f.extra?.[w] || []).map((e, i) => {
        if (typeof e === 'string') return { id: `v19-${w}-${i}`, name: str(e, 60), place: '', start: '', end: '' };
        return { id: str(e.id, 40) || `v19-${w}-${i}`, name: str(e.name, 60), place: str(e.place, 100), start: HM.test(e.start) ? e.start : '', end: HM.test(e.end) ? e.end : '' };
      }).filter(e => e.name).slice(0, 12);
    }
    for (const x of f.tasks || []) {
      const id = str(x.id, 60) || 'v' + randStr(10); if (!str(x.content, 300) || !DAY.test(x.day || '')) continue;
      doc.tasks[id] = { id, kind: KINDS.includes(x.kind) ? x.kind : 'homework', content: str(x.content, 300), day: x.day, done: !!x.done, at: t, ...(x.kind === 'reminder' ? { from: 'Phụ huynh' } : {}) };
    }
    // Giữ băm token cũ (cùng cách băm SHA-256 hex) → máy cũ vẫn có quyền sau khi chuyển.
    doc.owner = /^[0-9a-f]{64}$/.test(access?.owner || '') ? access.owner : '';
    for (const p of access?.parents || []) if (/^[0-9a-f]{64}$/.test(p)) { const id = 'l' + randStr(10); doc.links[id] = { id, label: 'Phụ huynh', tokenHash: p, status: 'approved', at: t }; }
    doc.calToken = randStr(24, 'abcdefghijkmnpqrstuvwxyz23456789');
    const w = await kv.set('st/' + code, doc, { ifNew: true });
    if (!w.modified) return { code, ok: false, error: 'Đã có trong v2, bỏ qua' };
    await kv.set('cal/' + doc.calToken, { code });
    return { code, ok: true, tasks: Object.keys(doc.tasks).length, parents: (access?.parents || []).length, hasOwner: !!doc.owner };
  }

  const routes = Object.entries(R).map(([k, fn]) => {
    const [method, path] = k.split(' ');
    const names = []; const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    return { method, re, names, fn };
  });

  return async function handle(req, ip = '') {
    const url = new URL(req.url);
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
    try {
      const r = routes.find(x => x.method === req.method && x.re.test(url.pathname));
      if (!r) fail(404, 'Không có đường dẫn này');
      const m = url.pathname.match(r.re), params = {}; r.names.forEach((n, i) => params[n] = decodeURIComponent(m[i + 1]));
      let body = {};
      if (req.method === 'POST') { const txt = await req.text(); if (txt.length > 300000) fail(413, 'Dữ liệu quá lớn'); try { body = txt ? JSON.parse(txt) : {}; } catch { fail(400, 'JSON không hợp lệ'); } }
      const out = await r.fn(body, { req, url, params, ip, token: req.headers.get('x-token') || '' });
      if (out instanceof Response) return out;
      return new Response(JSON.stringify(out), { headers });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      return new Response(JSON.stringify({ error: status === 500 ? 'Lỗi máy chủ' : e.message, ...(e.extra || {}) }), { status, headers });
    }
  };
}
