package com.nomahubvn.tiktak.dibo;
import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.*;
import java.util.ArrayList;
import java.util.Locale;
public class MainActivity extends Activity {
  static final String URL = "https://bus.nomahubvn.com/dibo/";
  static final String HOST = "bus.nomahubvn.com";
  private WebView web;
  private TextToSpeech tts;
  private GeolocationPermissions.Callback geoCb; private String geoOrigin;
  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    if (Build.VERSION.SDK_INT >= 21) getWindow().setStatusBarColor(0xFF23704A);
    web = new WebView(this);
    setContentView(web);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
    s.setGeolocationEnabled(true); s.setMediaPlaybackRequiresUserGesture(false);
    s.setUserAgentString(s.getUserAgentString() + " TikTakDiBoApp/2");
    web.addJavascriptInterface(new Bridge(), "NativeSteps");
    web.addJavascriptInterface(new Tts(), "NativeTTS");
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if (HOST.equals(u.getHost())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) {}
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
        if (has(Manifest.permission.ACCESS_FINE_LOCATION)) cb.invoke(origin, true, false);
        else { geoCb = cb; geoOrigin = origin; requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, 2); }
      }
    });
    tts = new TextToSpeech(this, st -> { if (st == TextToSpeech.SUCCESS) tts.setLanguage(new Locale("vi", "VN")); });
    ArrayList<String> want = new ArrayList<>();
    if (Build.VERSION.SDK_INT >= 29 && !has(Manifest.permission.ACTIVITY_RECOGNITION)) want.add(Manifest.permission.ACTIVITY_RECOGNITION);
    if (Build.VERSION.SDK_INT >= 33 && !has(Manifest.permission.POST_NOTIFICATIONS)) want.add(Manifest.permission.POST_NOTIFICATIONS);
    if (!has(Manifest.permission.ACCESS_FINE_LOCATION)) { want.add(Manifest.permission.ACCESS_FINE_LOCATION); want.add(Manifest.permission.ACCESS_COARSE_LOCATION); }
    if (!want.isEmpty()) requestPermissions(want.toArray(new String[0]), 1);
    if (b != null) web.restoreState(b); else web.loadUrl(URL);
    if (Steps.running(this)) StepService.start(this);   // tiếp tục buổi đi nếu app bị đóng giữa chừng
  }
  private boolean has(String p) { return checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED; }
  @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
    if (geoCb != null) { geoCb.invoke(geoOrigin, has(Manifest.permission.ACCESS_FINE_LOCATION) || has(Manifest.permission.ACCESS_COARSE_LOCATION), false); geoCb = null; }
  }
  @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
  @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
  @Override protected void onDestroy() { if (tts != null) tts.shutdown(); super.onDestroy(); }

  /** Cầu nối cho trang web: window.NativeSteps */
  class Bridge {
    @JavascriptInterface public boolean available() {
      SensorManager sm = (SensorManager) getSystemService(SENSOR_SERVICE);
      boolean sensor = sm != null && sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
      return sensor && (Build.VERSION.SDK_INT < 29 || has(Manifest.permission.ACTIVITY_RECOGNITION));
    }
    @JavascriptInterface public boolean hasSensor() {
      SensorManager sm = (SensorManager) getSystemService(SENSOR_SERVICE);
      return sm != null && sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }
    @JavascriptInterface public void askPermission() {
      if (Build.VERSION.SDK_INT >= 29) runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.ACTIVITY_RECOGNITION}, 3));
    }
    @JavascriptInterface public int count() { return Steps.count(MainActivity.this); }
    @JavascriptInterface public boolean running() { return Steps.running(MainActivity.this); }
    @JavascriptInterface public void resume() { if (!Steps.running(MainActivity.this)) Steps.resume(MainActivity.this); StepService.start(MainActivity.this); }
    @JavascriptInterface public void pause() { Steps.pause(MainActivity.this); StepService.stop(MainActivity.this); }
    @JavascriptInterface public void reset() { Steps.reset(MainActivity.this); StepService.stop(MainActivity.this); }
  }
  class Tts {
    @JavascriptInterface public void speak(String t) { if (tts != null) tts.speak(t, TextToSpeech.QUEUE_ADD, null, "dibo"); }
    @JavascriptInterface public void stop() { if (tts != null) tts.stop(); }
  }
}
