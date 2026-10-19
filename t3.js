const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.__said = [];
    const fake = { getVoices: () => [{ name: 'Linh', lang: 'vi-VN', localService: true }, { name: 'Linh (Enhanced)', lang: 'vi-VN', localService: true }, { name: 'Samantha', lang: 'en-US' }],
      speak: u => window.__said.push({ text: u.text, voice: u.voice && u.voice.name }), cancel: () => {}, onvoiceschanged: null };
    Object.defineProperty(window, 'speechSynthesis', { value: fake });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/dist/local.html'); await p.waitForTimeout(500);
  console.log('clear visible from/to:', await p.$eval('#from + .clear', e => !e.hidden), await p.$eval('#to + .clear', e => !e.hidden));
  await p.click('[data-speak="0"]'); await p.waitForTimeout(100);
  console.log('SAID:', JSON.stringify(await p.evaluate(() => window.__said), null, 1));
  await p.click('#from + .clear');
  console.log('after clear from=', JSON.stringify(await p.inputValue('#from')), 'btn hidden', await p.$eval('#from + .clear', e => e.hidden), 'focused', await p.evaluate(() => document.activeElement.id));
  await p.fill('#from', 'bach m'); await p.waitForTimeout(100);
  console.log('typing shows clear', await p.$eval('#from + .clear', e => !e.hidden));
  await p.click('#from-sug button'); console.log('picked', await p.inputValue('#from'), 'clear shown', await p.$eval('#from + .clear', e => !e.hidden));
  await p.screenshot({ path: 'shots/clear.png', clip: { x: 0, y: 0, width: 390, height: 420 } });
  console.log('errors', errs);
  await b.close();
})();
