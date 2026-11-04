// Chạy mỗi 5 phút: nhắc học thêm (30 phút trước) và việc ngày mai (20:00 giờ VN).
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { blobsKV } from '../../lib/kv.mjs';
import { runSchedule } from '../../lib/push.mjs';

export default async () => {
  const env = k => process.env[k] || '';
  if (!env('TKB_VAPID_PRIVATE')) return new Response('no vapid');
  webpush.setVapidDetails('mailto:ai.nomahub@gmail.com', env('TKB_VAPID_PUBLIC'), env('TKB_VAPID_PRIVATE'));
  const sum = await runSchedule(blobsKV(getStore({ name: 'tkb', consistency: 'strong' })), webpush, Date.now());
  console.log('push-cron', JSON.stringify(sum));
  return new Response(JSON.stringify(sum));
};

export const config = { schedule: '*/5 * * * *' };
