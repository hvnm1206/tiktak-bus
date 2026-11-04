// Trả trang app và bỏ đoạn mã thanh công cụ Netlify chèn vào (nó che thanh điều hướng dưới đáy).
export default async (req, context) => {
  const r = await context.next();
  if (!(r.headers.get('content-type') || '').includes('text/html')) return r;
  const html = (await r.text()).replace(/<script[^>]*\/\.netlify\/scripts\/hud[^>]*><\/script>/g, '');
  const h = new Headers(r.headers); h.delete('content-length');
  return new Response(html, { status: r.status, headers: h });
};
export const config = { path: ['/', '/index.html'] };
