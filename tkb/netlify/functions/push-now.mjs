// Gửi thông báo ngay (gọi từ API khi phụ huynh nhắc / xin kết nối). Bảo vệ bằng TKB_PUSH_SECRET.
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { blobsKV } from '../../lib/kv.mjs';
import { sendTo } from '../../lib/push.mjs';

export default async (req) => {
  const env = k => process.env[k] || '';
  if (req.method !== 'POST' || !env('TKB_PUSH_SECRET') || req.headers.get('x-push-secret') !== env('TKB_PUSH_SECRET')) return new Response('forbidden', { status: 403 });
  webpush.setVapidDetails('mailto:ai.nomahub@gmail.com', env('TKB_VAPID_PUBLIC'), env('TKB_VAPID_PRIVATE'));
  const { code, payload } = await req.json();
  const r = await sendTo(blobsKV(getStore({ name: 'tkb', consistency: 'strong' })), webpush, String(code), payload || {});
  return new Response(JSON.stringify({ result: r }), { headers: { 'content-type': 'application/json' } });
};
