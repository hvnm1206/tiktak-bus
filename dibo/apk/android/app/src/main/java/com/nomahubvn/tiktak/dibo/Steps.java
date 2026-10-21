package com.nomahubvn.tiktak.dibo;
import android.content.Context;
import android.content.SharedPreferences;
/**
 * Số bước của buổi đi, lưu bền (không mất khi hệ thống dừng tiến trình).
 * Hai nguồn: TYPE_STEP_COUNTER (chính xác, chạy cả khi tắt màn hình nhưng báo trễ, gom nhiều bước)
 * và TYPE_STEP_DETECTOR (báo ngay từng bước). Số của đoạn đang đi = max(bộ đếm, bộ phát hiện):
 * mở màn hình thì nhảy theo từng bước, tắt màn hình thì bộ đếm giữ đúng tổng.
 */
final class Steps {
  private static SharedPreferences p(Context c) { return c.getSharedPreferences("steps", Context.MODE_PRIVATE); }
  static synchronized boolean running(Context c) { return p(c).getBoolean("run", false); }
  /** Số bước của đoạn đang chạy (từ lần resume gần nhất). */
  static int segment(float base, float last, int det) {
    int byCounter = base < 0 || last < base ? 0 : Math.round(last - base);
    return Math.max(byCounter, det);
  }
  static synchronized int count(Context c) {
    SharedPreferences s = p(c);
    int acc = s.getInt("acc", 0);
    if (!s.getBoolean("run", false)) return acc;
    return acc + segment(s.getFloat("base", -1f), s.getFloat("last", -1f), s.getInt("det", 0));
  }
  /** TYPE_STEP_COUNTER: giá trị cộng dồn từ lúc bật máy. */
  static synchronized void onCounter(Context c, float v, long ts) {
    SharedPreferences s = p(c);
    if (!s.getBoolean("run", false)) return;
    float base = s.getFloat("base", -1f);
    int det = s.getInt("det", 0);
    SharedPreferences.Editor e = s.edit();
    if (base >= 0 && v < base) {           // máy vừa khởi động lại: bộ đếm về 0, chốt đoạn cũ
      e.putInt("acc", s.getInt("acc", 0) + segment(base, s.getFloat("last", -1f), det));
      det = 0; base = -1; e.putLong("sync", 0L);
    }
    if (base < 0) {                          // lần đọc đầu của đoạn (Android báo ngay khi đăng ký): lấy làm mốc
      base = v; e.putFloat("base", base);
    }
    int byCounter = Math.round(v - base);
    if (byCounter >= det) {                  // bộ đếm vượt (vd. sau khi tắt màn hình): bộ phát hiện theo kịp,
      det = byCounter; e.putLong("sync", ts);// bỏ các sự kiện phát hiện bước cũ hơn mốc này (máy dồn lại khi thức dậy)
    }
    e.putFloat("last", v).putInt("det", det).apply();
  }
  /** TYPE_STEP_DETECTOR: mỗi sự kiện là một bước. */
  static synchronized void onDetector(Context c, int n, long ts) {
    SharedPreferences s = p(c);
    if (!s.getBoolean("run", false) || ts <= s.getLong("sync", 0L)) return;
    s.edit().putInt("det", s.getInt("det", 0) + n).apply();
  }
  static synchronized void resume(Context c) {
    p(c).edit().putBoolean("run", true).putFloat("base", -1f).putFloat("last", -1f).putInt("det", 0).putLong("sync", 0L).apply();
  }
  static synchronized void pause(Context c) { int n = count(c); p(c).edit().putInt("acc", n).putBoolean("run", false).apply(); }
  static synchronized void reset(Context c) {
    p(c).edit().putInt("acc", 0).putBoolean("run", false).putFloat("base", -1f).putFloat("last", -1f).putInt("det", 0).putLong("sync", 0L).apply();
  }
}
