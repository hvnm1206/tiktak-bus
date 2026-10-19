const { chromium } = require(process.env.PW);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 21.0287, longitude: 105.8522 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/'); await page.waitForTimeout(1500);
  console.log('manifest', await page.$eval('link[rel=manifest]', e => e.href));
  console.log('sw', await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())));
  await page.click('#gps'); await page.waitForTimeout(500);
  console.log('gps btn', await page.textContent('#gps'), '| from', await page.inputValue('#from'));
  await page.fill('#to', 'Bến xe Mỹ Đình'); await page.click('#to-sug button'); await page.click('#go'); await page.waitForTimeout(300);
  console.log('opts', await page.$$eval('.opt-top', e => e.map(x => x.innerText.replace(/\n/g,' '))));
  await ctx.setOffline(true); await page.reload(); await page.waitForTimeout(800);
  console.log('offline opts', await page.$$eval('.opt', e => e.length));
  console.log('errors', errs);
  await browser.close();
})();
