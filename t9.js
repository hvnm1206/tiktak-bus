// Nút "Dùng vị trí của tôi": nhỏ, không át ô Từ/Đến; trạng thái đã lấy và đặt lại khi xóa
const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const big of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['geolocation'], geolocation: { latitude: 21.0285, longitude: 105.7787 } });
    if (big) await ctx.addInitScript(() => localStorage.setItem('tiktak.big', 'true'));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + process.cwd() + '/dist/local.html'); await p.waitForTimeout(800);
    await p.click('#gps'); await p.waitForTimeout(800);
    const h = await p.evaluate(() => ({ gps: Math.round(document.getElementById('gps').getBoundingClientRect().height), input: Math.round(document.getElementById('from').getBoundingClientRect().height), fs: getComputedStyle(document.getElementById('gps')).fontSize, inFs: getComputedStyle(document.getElementById('from')).fontSize }));
    console.log(big ? 'big' : 'normal', JSON.stringify(h), '|', await p.textContent('#gps'), '| from', await p.inputValue('#from'));
    await p.screenshot({ path: `shots/gps-${big ? 'big' : 'normal'}.png`, clip: { x: 0, y: 0, width: 390, height: 640 } });
    await p.click('#from + .clear').catch(() => p.click('.inwrap:has(#from) .clear'));
    console.log('after clear:', await p.textContent('#gps'), 'errors', errs);
    await ctx.close();
  }
  await b.close();
})();
