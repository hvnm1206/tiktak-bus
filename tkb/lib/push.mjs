// Gửi thông báo đẩy (chạy trong Netlify Functions — Node, thư viện web-push).
import { vnDate, vnWeekday } from './api.mjs';

const TZ = 7 * 3600e3;

async function dropSub(kv, code) {
  for (let i = 0; i < 5; i++) {
    const cur = await kv.get('st/' + code); if (!cur || !cur.data.push) break;
    const d = { ...cur.data, push: null, pxKeys: [] };
    const w = await kv.set('st/' + code, d, { ifMatch: cur.etag });
    if (w.modified) { await Promise.all([kv.del('pn/' + code), ...(cur.data.pxKeys || []).map(k => kv.del(k))]); break; }
  }
}

export async function sendTo(kv, webpush, code, payload, doc = null) {
  doc ||= (await kv.get('st/' + code))?.data;
  if (!doc?.push) return 'no-sub';
  try {
    await webpush.sendNotification(doc.push, JSON.stringify({ url: '/', ...payload }), { TTL: 6 * 3600, urgency: 'high' });
    return 'sent';
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) { await dropSub(kv, code); return 'gone'; }
    console.error('push', code, e.statusCode, e.body || e.message);
    return 'error';
  }
}

// Gọi mỗi 5 phút. Trả về tóm tắt để ghi log.
export async function runSchedule(kv, webpush, now) {
  const local = new Date(now + TZ), mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  const slot = mins - (mins % 5), hhmm = String(Math.floor(slot / 60)).padStart(2, '0') + String(slot % 60).padStart(2, '0');
  const w = vnWeekday(now), today = vnDate(now);
  const mark = await kv.set(`pl/${today}-${hhmm}`, 1, { ifNew: true }); // chạy trùng thì bỏ qua
  if (!mark.modified) return { slot: hhmm, skipped: true };
  const sum = { slot: hhmm, extra: 0, night: 0 };

  // 1) 30 phút trước học thêm
  const keys = await kv.list(`px/${w}${hhmm}/`);
  await pool(keys.map(k => k.split('/')[2]), 20, async code => {
    const doc = (await kv.get('st/' + code))?.data; if (!doc) return;
    // Buổi học bắt đầu trong khoảng 30–35 phút tới (có thể sang ngày hôm sau nếu gần nửa đêm)
    const hits = [];
    for (let add = 30; add < 35; add++) {
      const t = slot + add, ww = t >= 1440 ? (w + 1) % 7 : w, hm = t % 1440;
      const s = String(Math.floor(hm / 60)).padStart(2, '0') + ':' + String(hm % 60).padStart(2, '0');
      for (const e of doc.extras[ww] || []) if (e.start === s) hits.push(e);
    }
    for (const e of hits) {
      if ((await sendTo(kv, webpush, code, { title: `Học thêm lúc ${e.start}: ${e.name}`, body: e.place ? '📍 ' + e.place : 'Chuẩn bị đi học nhé', tag: 'x-' + e.id }, doc)) === 'sent') sum.extra++;
    }
  });

  // 2) 20:00 — việc của ngày mai
  if (hhmm === '2000') {
    const tomorrow = vnDate(now, 1), tw = (w + 1) % 7;
    const codes = (await kv.list('pn/')).map(k => k.slice(3));
    await pool(codes, 25, async code => {
      const doc = (await kv.get('st/' + code))?.data; if (!doc?.push) return;
      const tasks = Object.values(doc.tasks).filter(t => !t.done && t.day === tomorrow);
      const lessons = doc.lessons[tw] || [];
      if (!tasks.length && !lessons.length) return;
      const title = tasks.length ? `Ngày mai có ${tasks.length} việc cần làm` : 'Ngày mai học gì?';
      const body = tasks.length ? tasks.slice(0, 4).map(t => '• ' + t.content).join('\n') : lessons.join(', ');
      if ((await sendTo(kv, webpush, code, { title, body: body.slice(0, 220), tag: 'night-' + tomorrow }, doc)) === 'sent') sum.night++;
    });
  }
  return sum;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}
