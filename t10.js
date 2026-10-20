// Trang tổng NMH Apps
const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/site/apps/index.html');
  console.log('apps', await p.$$eval('a.app', a => a.map(x => x.querySelector('b').firstChild.textContent.trim() + ' -> ' + x.href)), 'sw', await p.evaluate(() => document.documentElement.scrollWidth), 'errors', errs);
  await p.screenshot({ path: 'shots/apps.png' }); await b.close();
})();
