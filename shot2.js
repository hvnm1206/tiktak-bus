const { chromium } = require(process.env.PW);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + process.cwd() + '/dist/local.html'); await page.waitForTimeout(600);
  console.log('example opts', await page.$$eval('.opt', e => e.length));
  await page.fill('#from', 'từ Hồ Gươm về bến xe Mỹ Đình'); await page.fill('#to', '');
  await page.click('#go'); await page.waitForTimeout(200);
  console.log('from/to', await page.inputValue('#from'), '|', await page.inputValue('#to'));
  console.log('choices', await page.$$eval('[data-pick]', e => e.map(x => x.textContent)));
  await page.screenshot({ path: 'shots/dark-choose.png' });
  const n = await page.$$eval('[data-pick]', e => e.length);
  if (n) { await page.click('[data-pick="0"]'); await page.waitForTimeout(200); }
  console.log('after pick opts', await page.$$eval('.opt', e => e.length), await page.$$eval('[data-pick]', e => e.map(x => x.textContent)));
  await page.screenshot({ path: 'shots/dark-result.png', fullPage: true });
  console.log('errors', errs, 'sw', await page.evaluate(() => document.documentElement.scrollWidth));
  await browser.close();
})();
