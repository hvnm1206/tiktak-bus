// Máy chủ thử cục bộ: phục vụ site/ và API với kho bộ nhớ.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createApi } from '../lib/api.mjs';
import { memoryKV } from '../lib/kv.mjs';

const root = new URL('../site/', import.meta.url).pathname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const sent = [];
const api = createApi({ kv: memoryKV(), adminToken: 'dev', notify: async (code, p) => { sent.push({ code, ...p }); } });

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/__sent') { res.end(JSON.stringify(sent)); return; }
  if (url.pathname.startsWith('/api/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await api(new Request(url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), req.headers['x-forwarded-for'] || req.socket.remoteAddress);
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  const file = join(root, url.pathname === '/' ? 'index.html' : url.pathname);
  try { const b = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(process.env.PORT || 8787, () => console.log('TKB dev http://localhost:' + (process.env.PORT || 8787)));
