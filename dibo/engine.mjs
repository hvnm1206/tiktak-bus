// TikTak Đi Bộ – bộ máy tính toán gợi ý (theo "Đặc tả thuật toán gợi ý" 20/10/2026)
// Thuần hàm, không phụ thuộc giao diện. Dùng được trong trình duyệt và Node.

const r1 = (x) => Math.round(x * 10) / 10;
const r100 = (x) => Math.round(x / 100) * 100;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---- 1. Công thức nền ----
export function strideCm(heightCm, sex) {
  return (sex === "nu" ? 0.413 : 0.415) * heightCm;
}

export function bmi(weightKg, heightCm) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiClass(b) {
  if (b < 18.5) return "Thiếu cân";
  if (b < 23) return "Bình thường";
  if (b < 25) return "Thừa cân";
  return "Béo phì";
}

export function bmr(weightKg, heightCm, age, sex) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "nu" ? -161 : 5);
}

export function metForSpeed(kmh) {
  if (kmh < 3.2) return 2.0;
  if (kmh < 4.0) return 3.0;
  if (kmh < 5.0) return 3.5;
  if (kmh < 5.6) return 4.3;
  if (kmh <= 6.4) return 5.0;
  return 7.0;
}

export function kcal(met, weightKg, minutes) {
  return met * weightKg * (minutes / 60);
}

export function hrMax(age) {
  return 208 - 0.7 * age;
}

export function hrZone(age, restHr) {
  const max = hrMax(age);
  if (restHr) {
    const reserve = max - restHr;
    return [restHr + 0.4 * reserve, restHr + 0.6 * reserve];
  }
  return [0.5 * max, 0.7 * max];
}

export function intensityFromCadence(c) {
  if (c < 80) return "Rất nhẹ";
  if (c < 100) return "Nhẹ";
  if (c < 130) return "Vừa";
  return "Mạnh";
}

export function speedFromCadence(cadence, stride) {
  return (cadence * stride * 60) / 100000;
}

export function cadenceFromSpeed(kmh, stride) {
  return (kmh * 100000) / (stride * 60);
}

// ---- 2. Cờ an toàn ----
export const CONDITIONS = {
  tim: "Bệnh tim / từng đau ngực khi gắng sức",
  huyetap: "Huyết áp cao",
  tieuduong: "Tiểu đường",
  mangthai: "Đang mang thai",
  khop: "Đau khớp gối / hông",
};

export function safetyFlags(p) {
  const flags = [...(p.conditions || [])];
  if (bmi(p.weight, p.height) >= 30) flags.push("bmi30");
  if (p.age >= 75) flags.push("tuoi75");
  return flags;
}

// ---- 3. Phân nhóm ----
export const GROUPS = {
  A: { name: "Khởi động", min: 3000, long: [6000, 8000], speed: [3.5, 4.5], inc: 0.05 },
  B: { name: "Phổ thông", min: 6000, long: [8000, 10000], speed: [4.5, 5.5], inc: 0.10 },
  C: { name: "Tích cực", min: 0, long: [10000, 12000], speed: [5.5, 6.5], inc: 0.10 },
  D: { name: "Cao tuổi", min: 4000, long: [6000, 8000], speed: [3.5, 4.5], inc: 0.05 },
};

// Thứ tự ưu tiên: cờ an toàn → D → A → C → B
export function assignGroup(p, baseline) {
  const flags = safetyFlags(p);
  if (flags.length && !(flags.length === 1 && flags[0] === "tuoi75")) return "A";
  if (p.age >= 60) return "D";
  if (p.activity === "it" || bmi(p.weight, p.height) >= 25) return "A";
  if (p.age < 50 && baseline >= 8000) return "C";
  return "B";
}

export function initialTarget(group, baseline) {
  const g = GROUPS[group];
  const b = baseline || 0;
  const t = group === "C" ? Math.max(b * 1.1, g.long[0]) : Math.max(b, g.min);
  return r100(Math.min(t, g.long[1]));
}

// Tốc độ tăng tối đa/tuần, tính cả cờ an toàn
export function maxIncrease(group, flags) {
  if (flags.includes("huyetap") || flags.includes("bmi30")) return 0.05;
  return GROUPS[group].inc;
}

// ---- 4. Gợi ý buổi đi ----
export const WALK_TYPES = {
  deu: { name: "Đi đều", how: "Giữ nhịp bước đều suốt buổi" },
  ngatquang: { name: "Đi ngắt quãng", how: "3 phút nhanh (≥ 120 bước/phút) xen 3 phút chậm, 5 lượt" },
  sauan: { name: "Đi sau ăn", how: "10–15 phút nhẹ trong vòng 30 phút sau bữa" },
  dai: { name: "Đi dài", how: "45–60 phút, giữ nhịp vừa" },
  phuchoi: { name: "Đi phục hồi", how: "20 phút nhẹ, dưới 100 bước/phút" },
};

const NO_INTERVAL = ["tim", "huyetap", "mangthai"];

export function chooseWalkType(p, group, flags, { weekend = false, lastFeeling = null } = {}) {
  if (lastFeeling === "met") return "phuchoi";
  const canInterval = (group === "B" || group === "C") && !flags.some((f) => NO_INTERVAL.includes(f));
  if (weekend && canInterval && (p.goal === "giamcan" || p.goal === "suc-ben")) return "dai";
  if (canInterval && (p.goal === "timmach" || p.goal === "giamcan")) return "ngatquang";
  return "deu";
}

const BASE_CADENCE = { A: 105, B: 110, C: 115, D: 105 };

export function targetCadence(group, flags, type, stride) {
  if (type === "phuchoi") return 90;
  let c = BASE_CADENCE[group];
  if (type === "ngatquang") c = 115; // trung bình của nhanh/chậm
  // Chặn tốc độ trong khoảng của nhóm
  const [lo, hi] = GROUPS[group].speed;
  c = clamp(c, cadenceFromSpeed(lo, stride), cadenceFromSpeed(hi, stride));
  if (flags.includes("tim")) c = Math.min(c, 100);
  return Math.round(c);
}

export function planSession(p, state, stepsToday = 0, opts = {}) {
  const flags = safetyFlags(p);
  const stride = state.stride || strideCm(p.height, p.sex);
  const type = chooseWalkType(p, state.group, flags, opts);
  const cadence = targetCadence(state.group, flags, type, stride);

  let steps = Math.max(state.target - stepsToday, 2000);
  if (type === "phuchoi") steps = Math.round(20 * cadence);
  if (type === "dai") steps = Math.max(steps, Math.round(45 * cadence));
  let minutes = steps / cadence;

  const notes = [];
  if (flags.includes("khop") && minutes > 30) {
    notes.push(`Chia thành ${Math.ceil(minutes / 30)} buổi ngắn, mỗi buổi tối đa 30 phút.`);
  }
  if (flags.includes("tieuduong")) notes.push("Ưu tiên đi sau bữa ăn; mang theo đồ ăn ngọt dự phòng.");
  if (p.goal === "duonghuyet" && !flags.includes("tieuduong")) notes.push("Thêm 10–15 phút đi nhẹ sau bữa tối.");
  if (flags.includes("tim")) notes.push("Giữ nhịp nhẹ–vừa. Hỏi ý kiến bác sĩ trước khi tăng cường độ.");
  if (flags.includes("mangthai")) notes.push("Chỉ đi nhẹ–vừa, dừng ngay nếu chóng mặt hoặc khó thở.");

  const speed = speedFromCadence(cadence, stride);
  return {
    type,
    typeName: WALK_TYPES[type].name,
    how: WALK_TYPES[type].how,
    steps: r100(steps),
    km: r1((steps * stride) / 100000),
    minutes: Math.round(minutes),
    cadence,
    speed: r1(speed),
    kcal: Math.round(kcal(metForSpeed(speed), p.weight, minutes)),
    intensity: intensityFromCadence(cadence),
    notes,
  };
}

// ---- 5. Điều chỉnh hằng tuần ----
// week: { daysMet, daysTotal, tiredCount, avgCadence, cadenceAboveWeeks, daysInactive }
export function weeklyAdjust(p, state, week) {
  const flags = safetyFlags(p);
  const g = GROUPS[state.group];
  const ratio = week.daysTotal ? week.daysMet / week.daysTotal : 0;
  let target = state.target;
  let action;

  if (week.daysInactive >= 7) {
    target = initialTarget(state.group, 0);
    action = "Nghỉ từ 7 ngày: quay về mục tiêu khởi đầu";
  } else if (ratio >= 0.85 && week.tiredCount < 2) {
    const inc = maxIncrease(state.group, flags);
    target = Math.min(target * (1 + inc), p.customTarget ? Infinity : g.long[1]);
    action = `Đạt ${Math.round(ratio * 100)}%: tăng ${Math.round(inc * 100)}%`;
  } else if (ratio >= 0.6 || (ratio >= 0.85 && week.tiredCount >= 2)) {
    action = week.tiredCount >= 2 ? "Mệt nhiều: giữ nguyên" : `Đạt ${Math.round(ratio * 100)}%: giữ nguyên`;
  } else if (ratio >= 0.4) {
    target = target * 0.9;
    action = `Đạt ${Math.round(ratio * 100)}%: giảm 10%`;
  } else {
    target = target * 0.8;
    action = `Đạt ${Math.round(ratio * 100)}%: giảm 20%, đổi sang buổi ngắn hơn`;
  }

  target = r100(Math.max(target, 2000));
  const atCap = target >= g.long[1];
  const capWeeks = atCap ? (state.capWeeks || 0) + 1 : 0;
  const order = ["A", "B", "C"];
  const suggestUpgrade = capWeeks >= 4 && state.group !== "D" && state.group !== "C" && !flags.length
    ? order[order.indexOf(state.group) + 1] : null;

  return { target, action, capWeeks, suggestUpgrade };
}

// ---- 6. Hồ sơ đầy đủ ----
export function computeProfile(p, baseline) {
  const flags = safetyFlags(p);
  const group = assignGroup(p, baseline);
  const b = bmi(p.weight, p.height);
  const [z1, z2] = hrZone(p.age, p.restHr);
  return {
    stride: r1(strideCm(p.height, p.sex)),
    bmi: r1(b),
    bmiClass: bmiClass(b),
    bmr: Math.round(bmr(p.weight, p.height, p.age, p.sex)),
    hrMax: Math.round(hrMax(p.age)),
    hrZone: [Math.round(z1), Math.round(z2)],
    group,
    groupName: GROUPS[group].name,
    target: initialTarget(group, baseline),
    longTerm: GROUPS[group].long,
    flags,
  };
}
