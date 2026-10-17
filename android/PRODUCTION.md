# Arrow Flow – production APK / AAB guide

The default build uses Google’s sample App ID and official test ad units. For a release build, enter your own AdMob IDs and complete the privacy/consent checks described in `../ADMOB_SETUP.md`. To explicitly disable ads, set `admobTestMode=false` and leave the ad unit IDs blank.

## 0. Decide the package name (once, permanent)
`com.example.arrowflow` is only a placeholder: **Google Play rejects `com.example.*`**, and the package name can never be changed after the first upload.
Choose yours (e.g. `com.yourname.arrowflow`) and put `appApplicationId=...` in `admob.properties` (or `gradle.properties`). Sideloading/testing works with the placeholder.

## 1. Quick test APK (installable, debug key)
```
cd android
gradle wrapper --gradle-version 8.9      # once
./gradlew assembleDebug
# -> app/build/outputs/apk/debug/app-debug.apk   (copy to the phone and install)
```
Needs JDK 17, Android SDK platform 35 (`ANDROID_HOME` or `local.properties: sdk.dir=...`), internet for Gradle dependencies.
No local SDK? Push this folder to a GitHub repo and run **Actions → Android build** (`.github/workflows/android-apk.yml`); download the APK from the run's artifacts.

## 2. Signed release (what you publish)
1. Create a keystore once and **back it up safely** (losing it = cannot update the app):
   `keytool -genkeypair -v -keystore arrowflow-release.jks -alias arrowflow -keyalg RSA -keysize 4096 -validity 10000`
2. Copy `keystore.properties.example` to `keystore.properties`, fill in the passwords (git-ignored).
3. `./gradlew assembleRelease` -> `app/build/outputs/apk/release/app-release.apk` (direct install / other stores)
   `./gradlew bundleRelease`   -> `app/build/outputs/bundle/release/app-release.aab` (**upload this to Google Play**)
Before each Play upload raise `appVersionCode` (and optionally `appVersionName`) in `admob.properties`/`gradle.properties`.
Without `keystore.properties` the release build is unsigned and will not install.
For CI signing, add repository secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.

## 3. Included for release
Adaptive + legacy launcher icons generated from `assets/icon.svg`; 512x512 Play icon in `store-assets/icon-512.png`; R8 shrinking + resource shrinking;
WebView hardened (no file access, no cleartext, no external navigation) with crash recovery; Android back button; backup disabled.

## 4. Still owner-side (cannot be done in code)
- Final package name; keystore; Play Console developer account.
- Host `privacy-policy/index.html` at a public URL (Play requires a privacy-policy link) and fill its highlighted `Developer:` placeholders.
- Play Console: Data safety form, content rating, target audience (child-directed or not), store listing text/screenshots, 1024x500 feature graphic.
- Even with ads off, the merged manifest may still declare INTERNET/ACCESS_NETWORK_STATE/AD_ID (the Google AdMob SDK is still compiled in); declare them accurately in Data safety.
- Real-device testing: this project has **never been built or run on a device** by the author; do a full play-through on a real phone before publishing.
