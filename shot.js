const { chromium } = require(process.env.PW);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errs.push(scheme + ': ' + m.text()); });
    page.on('pageerror', e => errs.push(scheme + ' PAGEERROR: ' + e.message));
    await page.goto('file://' + process.cwd() + '/dist/local.html');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `shots/${scheme}-home.png`, fullPage: true });
    if (scheme === 'light') {
      const opts = await page.$$eval('.opt', e => e.length);
      console.log('example options', opts);
      // sentence input
      await page.fill('#from', 'từ Hồ Gươm về bến xe Mỹ Đình'); await page.fill('#to', '');
      await page.click('#go'); await page.waitForTimeout(300);
      console.log('sentence ->', await page.inputValue('#from'), '|', await page.inputValue('#to'), '| opts', await page.$$eval('.opt', e => e.length), '| err', await page.$eval('#plan-err', e => e.hidden ? '' : e.textContent));
      if (await page.$('[data-pick="0"]')) { await page.click('[data-pick="0"]'); await page.waitForTimeout(200); console.log('picked from chooser, opts', await page.$$eval('.opt', e => e.length)); }
      await page.click('[data-mode="lesswalk"]'); await page.waitForTimeout(200);
      await page.click('[data-stops="0:0"]');
      await page.screenshot({ path: 'shots/light-sentence.png', fullPage: true });
      await page.fill('#to', 'xyzxyz'); sel = null; await page.click('#go');
      console.log('bad ->', await page.$eval('#plan-err', e => e.textContent));
      await page.click('#tab-stop'); await page.fill('#stopq', 'bach mai'); await page.waitForTimeout(150);
      await page.click('#stopq-sug button'); await page.waitForTimeout(150);
      console.log('stop rows', await page.$$eval('#stop-out .row', e => e.length));
      await page.screenshot({ path: 'shots/light-stop.png', fullPage: true });
      await page.click('#tab-plan'); await page.click('#tab-route'); await page.fill('#routeq', '32'); await page.waitForTimeout(200);
      console.log('route dirs', await page.$$eval('#route-out .dirs > div', e => e.length));
      await page.screenshot({ path: 'shots/light-route.png' });
      const sw = await page.evaluate(() => document.documentElement.scrollWidth); console.log('scrollWidth', sw);
    }
    await ctx.close();
  }
  console.log('errors', errs);
  await browser.close();
})();
