#!/usr/bin/env bash
# Build TikTak Đi Bộ APK (TWA) on Netlify build server
set -eo pipefail
ROOT=$PWD; T=$ROOT/.tools; mkdir -p $T public
log(){ echo "== $(date +%T) $*"; }
JV=$(java -version 2>&1 | grep -oE 'version "[0-9]+' | grep -oE '[0-9]+$' || echo 0)
if [ "$JV" != 17 ]; then
  log "download JDK 17"
  curl -fsSL "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" -o $T/jdk.tgz
  mkdir -p $T/jdk && tar xzf $T/jdk.tgz -C $T/jdk --strip-components=1
  export JAVA_HOME=$T/jdk; export PATH=$JAVA_HOME/bin:$PATH
fi
java -version
log "Android cmdline-tools"
export ANDROID_HOME=$T/sdk ANDROID_SDK_ROOT=$T/sdk
mkdir -p $ANDROID_HOME/cmdline-tools
curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o $T/clt.zip
unzip -q $T/clt.zip -d $ANDROID_HOME/cmdline-tools && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest
SDKM=$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager
yes | $SDKM --licenses >/dev/null || true
$SDKM "platforms;android-35" "build-tools;34.0.0" "platform-tools" >/dev/null
log "Gradle 8.9"
curl -fsSL https://services.gradle.org/distributions/gradle-8.9-bin.zip -o $T/gradle.zip
unzip -q $T/gradle.zip -d $T
log "keystore"
[ -n "$KS_B64" ] || { echo "KS_B64 missing"; exit 3; }
echo "$KS_B64" | base64 -d > $T/release.jks
export KS_PATH=$T/release.jks
log "assembleRelease"
cd $ROOT/android && $T/gradle-8.9/bin/gradle assembleRelease --no-daemon --console=plain -q
APK=$ROOT/android/app/build/outputs/apk/release/app-release.apk
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --print-certs $APK | tee $ROOT/public/verify.txt
cp $APK $ROOT/public/tiktak-dibo.apk
sha256sum $ROOT/public/tiktak-dibo.apk | tee -a $ROOT/public/verify.txt
rm -f $T/release.jks
log "done"
