const { chromium } = require(process.env.PW);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: 21.0006, longitude: 105.8410 } });
  await ctx.addInitScript(() => {
    window.__said = []; window.__buzz = [];
    const fake = { getVoices: () => [{ name: 'Linh', lang: 'vi-VN', localService: true }], speak: u => window.__said.push(u.text), cancel: () => {}, onvoiceschanged: null };
    Object.defineProperty(window, 'speechSynthesis', { value: fake });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
    navigator.vibrate = p => { window.__buzz.push(JSON.stringify(p)); return true; };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + process.cwd() + '/dist/local.html'); await p.waitForTimeout(800);
  // Near me (permission granted -> auto load)
  console.log('near cards', await p.$$eval('#near-out .stop-card', e => e.length), '| first:', await p.$eval('#near-out .stop-card .t', e => e.textContent).catch(() => '-'));
  await p.screenshot({ path: 'shots/near.png', fullPage: false });
  // Start trip on option 0 of the example
  await p.click('[data-start="0"]'); await p.waitForTimeout(300);
  const st = () => p.evaluate(() => window.__tiktakTrip());
  console.log('start', JSON.stringify(await st()));
  const raw = await p.evaluate(() => { const t = window.__tiktakTripRaw(); return t.steps.map(s => ({ type: s.type, target: s.target, ids: s.leg && s.leg.stopIds, from: s.leg && s.leg.fromPos, to: s.leg && s.leg.toPos })); });
  const pos = await p.evaluate(ids => { const d = JSON.parse(document.getElementById('transit-data').textContent); return ids.map(i => d.stops[i].slice(1)); }, raw.find(s => s.type === 'ride').ids);
  const setG = async (lat, lng) => { await ctx.setGeolocation({ latitude: lat, longitude: lng }); await p.waitForTimeout(1200); };
  const walk0 = raw[0].target; await setG(walk0[0], walk0[1]); console.log('at board stop ->', JSON.stringify(await st()));
  await p.screenshot({ path: 'shots/trip-wait.png' });
  await setG(pos[2][0], pos[2][1]); console.log('moved to stop #2 ->', JSON.stringify(await st()));
  await setG(pos[pos.length - 2][0], pos[pos.length - 2][1]); console.log('one before dest ->', JSON.stringify(await st()), 'buzz', await p.evaluate(() => window.__buzz.slice(-1)));
  await p.screenshot({ path: 'shots/trip-ride.png' });
  await setG(pos[pos.length - 1][0], pos[pos.length - 1][1]); console.log('at alight ->', JSON.stringify(await st()));
  const dest = raw[raw.length - 2].target; await setG(dest[0], dest[1]); console.log('at dest ->', JSON.stringify(await st()));
  await p.screenshot({ path: 'shots/trip-done.png' });
  console.log('said:', (await p.evaluate(() => window.__said)).join(' || '));
  await p.click('#trip-end'); console.log('closed', await p.$eval('#trip', e => e.hidden));
  console.log('errors', errs, 'sw', await p.evaluate(() => document.documentElement.scrollWidth));
  await b.close();
})();
