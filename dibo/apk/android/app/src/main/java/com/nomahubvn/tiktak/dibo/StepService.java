package com.nomahubvn.tiktak.dibo;
import android.app.*;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.*;
import android.os.Build;
import android.os.IBinder;
/** Dịch vụ chạy nền: đọc cảm biến đếm bước của máy kể cả khi tắt màn hình, hiện số bước trên thông báo. */
public class StepService extends Service implements SensorEventListener {
  static final String CH = "walk";
  private SensorManager sm;
  private long lastNotif = 0;
  @Override public IBinder onBind(Intent i) { return null; }
  @Override public int onStartCommand(Intent intent, int flags, int startId) {
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CH) == null)
      nm.createNotificationChannel(new NotificationChannel(CH, "Đang đi bộ", NotificationManager.IMPORTANCE_LOW));
    Notification n = build(Steps.count(this));
    try {
      if (Build.VERSION.SDK_INT >= 34) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
      else startForeground(1, n);
    } catch (Exception e) { stopSelf(); return START_NOT_STICKY; }
    if (sm == null) {
      sm = (SensorManager) getSystemService(SENSOR_SERVICE);
      Sensor s = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
      if (s != null) sm.registerListener(this, s, SensorManager.SENSOR_DELAY_NORMAL);
    }
    return START_STICKY;
  }
  private Notification build(int steps) {
    Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
    return b.setSmallIcon(R.drawable.ic_notification).setContentTitle("TikTak Đi Bộ đang đếm bước")
        .setContentText(String.format(java.util.Locale.US, "%,d bước", steps).replace(',', '.'))
        .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(pi).build();
  }
  @Override public void onSensorChanged(SensorEvent e) {
    Steps.onSensor(this, e.values[0]);
    long now = System.currentTimeMillis();
    if (now - lastNotif > 2000) {
      lastNotif = now;
      ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(1, build(Steps.count(this)));
    }
  }
  @Override public void onAccuracyChanged(Sensor s, int a) {}
  @Override public void onDestroy() { if (sm != null) sm.unregisterListener(this); super.onDestroy(); }
  static void start(Context c) {
    Intent i = new Intent(c, StepService.class);
    if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
  }
  static void stop(Context c) { c.stopService(new Intent(c, StepService.class)); }
}
