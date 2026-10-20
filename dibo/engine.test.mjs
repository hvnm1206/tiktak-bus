import test from "node:test";
import assert from "node:assert/strict";
import * as E from "./engine.mjs";

const nam35 = { sex: "nam", age: 35, height: 170, weight: 72, activity: "it", goal: "timmach", restHr: 72, conditions: [] };

test("Ví dụ mẫu trong đặc tả – chỉ số nền", () => {
  const r = E.computeProfile(nam35, 4500);
  assert.equal(r.stride, 70.6);
  assert.equal(r.bmi, 24.9);
  assert.equal(r.bmiClass, "Thừa cân");
  assert.equal(r.bmr, 1613);
  assert.equal(r.hrMax, 184);
  assert.deepEqual(r.hrZone, [117, 139]);
  assert.equal(r.group, "A");
  assert.equal(r.target, 4500);
});

test("Ví dụ mẫu – buổi chính", () => {
  const r = E.computeProfile(nam35, 4500);
  const s = E.planSession(nam35, { group: r.group, target: r.target }, 1500);
  assert.equal(s.type, "deu");
  assert.equal(s.steps, 3000);
  assert.equal(s.km, 2.1);
  assert.equal(s.minutes, 29);
  assert.equal(s.cadence, 105);
  assert.equal(s.speed, 4.4);
  assert.equal(s.kcal, 120);
});

test("Ví dụ mẫu – tuần 2 đạt ≥ 85% tăng 5% (nhóm A)", () => {
  const w = E.weeklyAdjust(nam35, { group: "A", target: 4500 }, { daysMet: 6, daysTotal: 7, tiredCount: 0, daysInactive: 0 });
  assert.equal(w.target, 4700);
});

test("Phân nhóm theo thứ tự ưu tiên", () => {
  const base = { sex: "nu", height: 160, weight: 52, activity: "vua", conditions: [] };
  assert.equal(E.assignGroup({ ...base, age: 65 }, 5000), "D");
  assert.equal(E.assignGroup({ ...base, age: 30 }, 9000), "C");
  assert.equal(E.assignGroup({ ...base, age: 40 }, 5000), "B");
  assert.equal(E.assignGroup({ ...base, age: 65, conditions: ["huyetap"] }, 5000), "A");
  assert.equal(E.assignGroup({ ...base, age: 80 }, 5000), "D"); // chỉ cờ tuổi 75 → vẫn nhóm D
});

test("Cờ tim mạch: chặn nhịp bước ≤ 100, không đi ngắt quãng", () => {
  const p = { ...nam35, activity: "vua", conditions: ["tim"] };
  const r = E.computeProfile(p, 7000);
  const s = E.planSession(p, { group: r.group, target: r.target }, 0);
  assert.equal(r.group, "A");
  assert.ok(s.cadence <= 100);
  assert.notEqual(s.type, "ngatquang");
});

test("Nhóm B mục tiêu tim mạch → đi ngắt quãng", () => {
  const p = { sex: "nam", age: 30, height: 175, weight: 68, activity: "vua", goal: "timmach", conditions: [] };
  const r = E.computeProfile(p, 6500);
  assert.equal(r.group, "B");
  assert.equal(E.planSession(p, { group: "B", target: r.target }, 0).type, "ngatquang");
});

test("Điều chỉnh tuần: giảm và quay về", () => {
  const st = { group: "B", target: 8000 };
  assert.equal(E.weeklyAdjust(nam35, st, { daysMet: 3, daysTotal: 7, tiredCount: 0, daysInactive: 0 }).target, 7200);
  assert.equal(E.weeklyAdjust(nam35, st, { daysMet: 2, daysTotal: 7, tiredCount: 0, daysInactive: 0 }).target, 6400);
  assert.equal(E.weeklyAdjust(nam35, st, { daysMet: 5, daysTotal: 7, tiredCount: 0, daysInactive: 0 }).target, 8000);
  assert.equal(E.weeklyAdjust(nam35, st, { daysMet: 7, daysTotal: 7, tiredCount: 2, daysInactive: 0 }).target, 8000);
  assert.equal(E.weeklyAdjust(nam35, st, { daysMet: 0, daysTotal: 7, tiredCount: 0, daysInactive: 7 }).target, 6000);
});

test("Không vượt trần nhóm", () => {
  const w = E.weeklyAdjust({ ...nam35, activity: "vua" }, { group: "B", target: 9800 }, { daysMet: 7, daysTotal: 7, tiredCount: 0, daysInactive: 0 });
  assert.equal(w.target, 10000);
});

test("Tiểu đường: lời khuyên theo thuốc đang dùng", () => {
  const base = { sex: "nam", age: 50, height: 168, weight: 70, activity: "vua", goal: "duonghuyet", conditions: ["tieuduong"] };
  const plan = (hypoMeds) => E.planSession({ ...base, hypoMeds }, { group: "A", target: 5000 }, 0).notes.join(" | ");
  const co = plan("co"), khong = plan("khong"), chuaro = plan("chuaro");
  assert.match(co, /15 g đường/); assert.match(co, /5,0 mmol/);
  assert.doesNotMatch(khong, /đường hấp thu nhanh|kẹo|ngọt/); assert.match(khong, /sau bữa ăn/);
  assert.doesNotMatch(chuaro, /kẹo|ngọt/); assert.match(chuaro, /cập nhật trong Hồ sơ/);
  for (const n of [co, khong, chuaro]) assert.doesNotMatch(n, /đồ ăn ngọt/);
});

test("Không tiểu đường, mục tiêu đường huyết: chỉ gợi ý đi sau bữa tối", () => {
  const p = { sex: "nu", age: 40, height: 158, weight: 55, activity: "vua", goal: "duonghuyet", conditions: [] };
  const n = E.planSession(p, { group: "B", target: 7000 }, 0).notes;
  assert.deepEqual(n, ["Thêm 10–15 phút đi nhẹ sau bữa tối."]);
});
