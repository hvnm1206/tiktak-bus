import test from "node:test";
import assert from "node:assert/strict";
import { createStepCounter } from "./stepcounter.mjs";

const G = 9.81, HZ = 60;
// nhiễu giả ngẫu nhiên lặp lại được
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);

function run(c, seconds, fn, t0 = 0) {
  for (let i = 0; i < seconds * HZ; i++) { const t = t0 + i / HZ; c.feed(t, 0.2 * rnd(), fn(t), 0.2 * rnd()); }
  return t0 + seconds;
}

test("Đi 30 giây ở 1,8 bước/giây ≈ 54 bước", () => {
  const c = createStepCounter();
  run(c, 30, (t) => G + 3 * Math.sin(2 * Math.PI * 1.8 * t) + 0.4 * rnd());
  assert.ok(Math.abs(c.count - 54) <= 3, "đếm được " + c.count);
  assert.ok(Math.abs(c.cadence(30) - 108) <= 6, "nhịp " + c.cadence(30));
});

test("Đứng yên 60 giây: không đếm", () => {
  const c = createStepCounter();
  run(c, 60, () => G + 0.3 * rnd());
  assert.equal(c.count, 0);
});

test("Cầm máy giật 2–3 cái rồi để yên: không đếm", () => {
  const c = createStepCounter();
  run(c, 10, (t) => G + (t > 3 && t < 4.2 ? 4 * Math.sin(2 * Math.PI * 2 * t) : 0) + 0.3 * rnd());
  assert.equal(c.count, 0);
});

test("Đi rồi dừng: số bước đứng yên, nhịp về 0", () => {
  const c = createStepCounter();
  let t = run(c, 20, (t) => G + 3 * Math.sin(2 * Math.PI * 1.8 * t) + 0.4 * rnd());
  const walked = c.count;
  t = run(c, 30, () => G + 0.3 * rnd(), t);
  assert.equal(c.count, walked);
  assert.equal(c.cadence(t), 0);
});
