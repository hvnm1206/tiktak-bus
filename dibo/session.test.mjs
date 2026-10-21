import test from "node:test";
import assert from "node:assert/strict";
import * as E from "./engine.mjs";

const p = { sex: "nam", age: 35, height: 170, weight: 72 };
// đi về phía bắc: 1 độ vĩ ≈ 111.195 m
const north = (m) => m / 111195;

test("Haversine 1 km theo kinh tuyến", () => {
  const d = E.haversine({ lat: 21, lon: 105.8 }, { lat: 21 + north(1000), lon: 105.8 });
  assert.ok(Math.abs(d - 1000) < 1, d);
});

test("GPS: cộng quãng đường, bỏ điểm sai số lớn và điểm nhảy xa", () => {
  const g = E.createGpsTrack();
  for (let i = 0; i <= 100; i++) g.add({ lat: 21 + north(i * 1.4), lon: 105.8, acc: 8, t: i }); // 1,4 m/s
  g.add({ lat: 21 + north(140 + 500), lon: 105.8, acc: 8, t: 101 }); // nhảy 500 m trong 1 s → bỏ
  g.add({ lat: 21 + north(150), lon: 105.8, acc: 60, t: 110 });      // sai số 60 m → bỏ
  assert.ok(Math.abs(g.meters - 140) < 2, g.meters);
  assert.ok(Math.abs(g.speed(100) - 5.04) < 0.2, g.speed(100));
});

test("GPS: đứng yên rung nhẹ < 3 m không cộng", () => {
  const g = E.createGpsTrack();
  for (let i = 0; i < 60; i++) g.add({ lat: 21 + north((i % 2) * 2), lon: 105.8, acc: 6, t: i });
  assert.equal(g.meters, 0);
});

test("Nhắc nhịp lệch quá 10%", () => {
  assert.equal(E.cadenceAdvice(105, 90), "nhanh");
  assert.equal(E.cadenceAdvice(105, 120), "cham");
  assert.equal(E.cadenceAdvice(105, 100), null);
  assert.equal(E.cadenceAdvice(105, 0), null);
});

test("Tổng kết: ưu tiên GPS, không có thì từ số bước", () => {
  const a = E.sessionSummary(p, { steps: 3000, seconds: 29 * 60, meters: 2200, strideCmVal: 70.55, plannedSteps: 3000 });
  assert.equal(a.kmSource, "gps"); assert.equal(a.km, 2.2); assert.equal(a.avgCad, 103); assert.equal(a.pctPlan, 100);
  assert.equal(a.speed, 4.6); assert.equal(a.kcal, 122);
  const b = E.sessionSummary(p, { steps: 3000, seconds: 29 * 60, meters: null, strideCmVal: 70.55 });
  assert.equal(b.kmSource, "buoc"); assert.equal(b.km, 2.12);
});

test("Sải chân đo thật và trung bình 5 buổi", () => {
  assert.equal(E.measuredStride(150, 300), null);
  assert.equal(E.measuredStride(2100, 3000), 70);
  assert.equal(E.measuredStride(5000, 3000), null); // 166 cm: vô lý
  assert.equal(E.effectiveStride(p, [70, 72, 68, 70, 70, 90]), (72 + 68 + 70 + 70 + 90) / 5);
  assert.ok(Math.abs(E.effectiveStride(p, []) - 70.55) < 0.01);
});

test("GPS: tạm dừng rồi đi tiếp không cộng đoạn đi lúc dừng", () => {
  const g = E.createGpsTrack();
  for (let i = 0; i <= 10; i++) g.add({ lat: 21 + north(i * 1.4), lon: 105.8, acc: 8, t: i });
  g.cut();
  for (let i = 0; i <= 10; i++) g.add({ lat: 21 + north(500 + i * 1.4), lon: 105.8, acc: 8, t: 600 + i });
  // mỗi đoạn 14 m; bộ lọc 3 m làm hụt phần lẻ cuối đoạn → 25–28 m, không phải ~500 m
  assert.ok(g.meters >= 25 && g.meters <= 28, g.meters);
});

test("Ước tính khoảng tắt màn hình: 300 m / 5 phút, sải 70 cm ≈ 429 bước", () => {
  const a = { lat: 21, lon: 105.8, acc: 8 }, b = { lat: 21 + north(300), lon: 105.8, acc: 10 };
  const r = E.estimateGap(a, b, 300, 70);
  assert.equal(r.ok, true); assert.ok(Math.abs(r.meters - 300) < 1); assert.equal(r.steps, 429);
});
test("Ước tính: bỏ qua khi đi xe, khi gần chỗ cũ, khi GPS kém, khi thiếu điểm", () => {
  const a = { lat: 21, lon: 105.8, acc: 8 };
  assert.equal(E.estimateGap(a, { lat: 21 + north(3000), lon: 105.8, acc: 8 }, 300, 70).reason, "nhanh"); // 10 m/s
  assert.equal(E.estimateGap(a, { lat: 21 + north(10), lon: 105.8, acc: 8 }, 300, 70).reason, "gan");
  assert.equal(E.estimateGap(a, { lat: 21 + north(300), lon: 105.8, acc: 60 }, 300, 70).reason, "saiso");
  assert.equal(E.estimateGap(null, a, 300, 70).reason, "thieu");
});
