// Bộ đếm bước từ gia tốc kế (DeviceMotion). Thuần hàm, kiểm thử được trong Node.
// Chỉ ghi nhận khi có ≥ 4 bước đều liên tiếp (mỗi bước cách 0,25–2 s),
// nên đứng yên, cầm máy lắc nhẹ hay chạm một cái sẽ không làm số nhảy.
export function createStepCounter(opts = {}) {
  const TH_HI = opts.hi ?? 1.0;    // m/s² trên nền để tính là đỉnh
  const TH_LO = opts.lo ?? 0.2;    // m/s² rơi xuống dưới mức này mới sẵn sàng đỉnh tiếp
  const MIN_GAP = 0.25, MAX_GAP = 2.0, CONFIRM = 4;
  let s = null, base = null, above = false, peakT = 0, peakV = 0;
  let lastCand = -Infinity, buffer = [], walking = false, count = 0;
  const times = [];

  function commit(t) { count++; times.push(t); while (times.length && t - times[0] > 15) times.shift(); }

  function candidate(t) {
    const gap = t - lastCand;
    if (gap < MIN_GAP) return;
    if (gap > MAX_GAP) { buffer = []; walking = false; }
    lastCand = t;
    if (walking) { commit(t); return; }
    buffer.push(t);
    if (buffer.length >= CONFIRM) { walking = true; buffer.forEach(commit); buffer = []; }
  }

  return {
    // t: giây, ax/ay/az: gia tốc gồm trọng lực (m/s²)
    feed(t, ax, ay, az) {
      const m = Math.sqrt(ax * ax + ay * ay + az * az);
      if (s === null) { s = m; base = m; return count; }
      s += 0.3 * (m - s);
      base += 0.02 * (s - base);
      const dev = s - base;
      if (!above && dev > TH_HI) { above = true; peakT = t; peakV = dev; }
      else if (above) {
        if (dev > peakV) { peakV = dev; peakT = t; }
        if (dev < TH_LO) { above = false; candidate(peakT); }
      }
      if (walking && t - lastCand > MAX_GAP) { walking = false; buffer = []; }
      return count;
    },
    get count() { return count; },
    get walking() { return walking; },
    // nhịp bước trong 15 s gần nhất (bước/phút); 0 khi đã dừng
    cadence(now) {
      const recent = times.filter((x) => now - x <= 15);
      if (!walking || recent.length < 3) return 0;
      const span = recent[recent.length - 1] - recent[0];
      return span > 0 ? Math.round(((recent.length - 1) / span) * 60) : 0;
    },
    reset() { count = 0; times.length = 0; buffer = []; walking = false; lastCand = -Infinity; },
  };
}
