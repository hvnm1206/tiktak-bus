// Chụp giao diện mẫu A (sáng/tối): trang đầu, kết quả, bến gần, Đang đi
const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: scheme, permissions: ['geolocation'], geolocation: { latitude: 21.0006, longitude: 105.8410 } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + process.cwd() + '/dist/local.html'); await p.waitForTimeout(900);
    await p.screenshot({ path: `shots/A-${scheme}-top.png` });
    await p.evaluate(() => document.getElementById('results').scrollIntoView());
    await p.screenshot({ path: `shots/A-${scheme}-res.png` });
    await p.click('.stop-toggle[data-si="0"]'); await p.evaluate(() => document.querySelector('.sec').scrollIntoView());
    await p.screenshot({ path: `shots/A-${scheme}-near.png` });
    await p.click('[data-start="0"]'); await p.waitForTimeout(300);
    await p.screenshot({ path: `shots/A-${scheme}-trip.png` });
    await p.click('#trip-end');
    await p.click('#tab-stop'); await p.fill('#stopq', 'bach mai'); await p.waitForTimeout(150); await p.click('#stopq-sug button'); await p.waitForTimeout(150);
    await p.screenshot({ path: `shots/A-${scheme}-stop.png` });
    console.log(scheme, 'back visible', await p.$eval('#tab-plan', e => !e.hidden), 'errors', errs, 'sw', await p.evaluate(() => document.documentElement.scrollWidth));
    await ctx.close();
  }
  await b.close();
})();
