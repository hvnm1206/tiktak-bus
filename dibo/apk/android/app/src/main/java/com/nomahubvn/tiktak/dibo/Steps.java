package com.nomahubvn.tiktak.dibo;
import android.content.Context;
import android.content.SharedPreferences;
/** Trạng thái đếm bước của buổi đi, lưu bền để không mất khi hệ thống dừng tiến trình. */
final class Steps {
  private static SharedPreferences p(Context c) { return c.getSharedPreferences("steps", Context.MODE_PRIVATE); }
  static synchronized boolean running(Context c) { return p(c).getBoolean("run", false); }
  static synchronized int count(Context c) {
    SharedPreferences s = p(c);
    int acc = s.getInt("acc", 0);
    if (!s.getBoolean("run", false)) return acc;
    float base = s.getFloat("base", -1f), last = s.getFloat("last", -1f);
    return base < 0 || last < base ? acc : acc + Math.round(last - base);
  }
  /** Giá trị cộng dồn từ cảm biến TYPE_STEP_COUNTER. */
  static synchronized void onSensor(Context c, float v) {
    SharedPreferences s = p(c);
    if (!s.getBoolean("run", false)) return;
    float base = s.getFloat("base", -1f);
    SharedPreferences.Editor e = s.edit();
    if (base < 0 || v < base) {            // lần đọc đầu, hoặc máy vừa khởi động lại (bộ đếm về 0)
      if (base >= 0) e.putInt("acc", count(c));
      e.putFloat("base", v);
    }
    e.putFloat("last", v).apply();
  }
  static synchronized void resume(Context c) { p(c).edit().putBoolean("run", true).putFloat("base", -1f).putFloat("last", -1f).apply(); }
  static synchronized void pause(Context c) { int n = count(c); p(c).edit().putInt("acc", n).putBoolean("run", false).apply(); }
  static synchronized void reset(Context c) { p(c).edit().putInt("acc", 0).putBoolean("run", false).putFloat("base", -1f).putFloat("last", -1f).apply(); }
}
