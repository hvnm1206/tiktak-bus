const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  await p.goto('file://' + process.cwd() + '/mockups/mock.html'); await p.waitForTimeout(400);
  for (const id of ['A', 'B', 'C']) { const el = await p.$('#' + id); await el.screenshot({ path: `mockups/mau-${id}.png` }); }
  await b.close();
})();
