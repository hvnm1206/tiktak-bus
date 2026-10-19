const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); // không cấp quyền vị trí
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/dist/local.html'); await p.waitForTimeout(500);
  await p.click('[data-start="0"]'); await p.waitForTimeout(300);
  const types = [];
  for (let k = 0; k < 6; k++) { const t = await p.evaluate(() => window.__tiktakTrip()); types.push(t ? t.type : 'none'); const nx = await p.$('#trip-next'); if (!nx) break; await nx.click(); await p.waitForTimeout(100); }
  console.log('manual flow:', types.join(' > '));
  console.log('back works:', await p.evaluate(() => window.__tiktakTrip().type));
  console.log('errors', errs);
  await b.close();
})();
