// Điểm vào API Thời khoá biểu v2 (Netlify Edge). Logic ở lib/api.mjs.
import { getStore } from '@netlify/blobs';
import { createApi } from '../../lib/api.mjs';
import { blobsKV } from '../../lib/kv.mjs';

export default async (req, context) => {
  const env = k => (globalThis.Netlify?.env?.get(k)) || '';
  const secret = env('TKB_PUSH_SECRET');
  const notify = secret ? (code, payload) => fetch(new URL('/.netlify/functions/push-now', req.url), {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-push-secret': secret }, body: JSON.stringify({ code, payload }),
  }).then(r => r.text()).catch(e => console.error('notify', e.message)) : null;
  const api = createApi({
    kv: blobsKV(getStore({ name: 'tkb', consistency: 'strong' })),
    adminToken: env('TKB_ADMIN_TOKEN'), importToken: env('TKB_IMPORT_TOKEN'), salt: env('TKB_SALT') || 'tkb', publicKey: env('TKB_VAPID_PUBLIC'), notify,
    defer: typeof context.waitUntil === 'function' ? p => context.waitUntil(p) : null,
  });
  return api(req, context.ip || '');
};

export const config = { path: '/api/*' };
