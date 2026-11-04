// Kho key-value có ghi điều kiện theo etag.
// Chạy thật: Netlify Blobs (nhất quán mạnh). Test: bộ nhớ.

export function memoryKV() {
  const m = new Map();
  let n = 0;
  return {
    async get(k) { const x = m.get(k); return x ? { data: JSON.parse(x.v), etag: x.e } : null; },
    async set(k, v, opt = {}) {
      const cur = m.get(k);
      if (opt.ifNew && cur) return { modified: false };
      if (opt.ifMatch && (!cur || cur.e !== opt.ifMatch)) return { modified: false };
      const e = 'e' + (++n);
      m.set(k, { v: JSON.stringify(v), e });
      return { modified: true, etag: e };
    },
    async list(prefix) { return [...m.keys()].filter(k => k.startsWith(prefix)); },
    async del(k) { m.delete(k); },
    _map: m,
  };
}

export function blobsKV(store) {
  return {
    async get(k) {
      const r = await store.getWithMetadata(k, { type: 'json' });
      return r ? { data: r.data, etag: r.etag } : null;
    },
    async set(k, v, opt = {}) {
      const o = opt.ifNew ? { onlyIfNew: true } : opt.ifMatch ? { onlyIfMatch: opt.ifMatch } : {};
      const r = await store.setJSON(k, v, o);
      return { modified: r?.modified !== false, etag: r?.etag };
    },
    async list(prefix) {
      const keys = [];
      for await (const page of store.list({ prefix, paginate: true })) keys.push(...page.blobs.map(b => b.key));
      return keys;
    },
    del: k => store.delete(k),
  };
}
