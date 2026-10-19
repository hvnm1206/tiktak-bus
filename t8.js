// Lối tắt "Về nhà" và "Gần tôi"
const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 21.0285, longitude: 105.7787 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/dist/local.html'); await p.waitForTimeout(800);
  await p.click('#tile-home'); console.log('no home ->', await p.$eval('#toast', e => e.textContent));
  await p.click('#save-to'); await p.fill('#save-label', 'Nhà'); await p.click('#save-ok');
  console.log('tile label', await p.textContent('#tile-home-t'));
  await p.click('#tile-home'); await p.waitForTimeout(1500);
  console.log('from', await p.inputValue('#from'), '| to', await p.inputValue('#to'), '| opts', await p.$$eval('.opt', e => e.length));
  await p.click('#tile-near'); await p.waitForTimeout(1200); console.log('near rows', await p.$$eval('.stop-toggle', e => e.length));
  console.log('errors', errs); await b.close();
})();
