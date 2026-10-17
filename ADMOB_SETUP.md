# Arrow Flow — Google AdMob setup (Android WebView)

## Current integration

Arrow Flow remains a plain HTML/CSS/JS game inside the existing Android WebView wrapper. Ads are handled natively by `android/app/src/main/java/com/example/arrowflow/AdMobGateway.java`; the web page continues to use the narrow `window.AFNativeAds` bridge and `js/ads.js` rules.

The game offers:
- **Rewarded video** only when the player has no hints left. A hint is granted only after AdMob calls the earned-reward callback.
- **Interstitial** only at a level-complete transition, no earlier than level 6, at most once per four completed levels and at least three minutes apart.
- No ad during active puzzle play. Failed or unavailable ads do not block play.

## Test mode is the default

The Android build defaults to Google's official sample AdMob App ID and test ad unit IDs. This is intentional: test ads must be used during development, and live ads must never be clicked by the developer. The native wrapper has not been verified on a real device by this source-edit operation; build and test it before release.

## Configure your own AdMob account

1. The account holder should create/register the Android app in AdMob and copy its **App ID** (contains `~`) and Rewarded / Interstitial **ad unit IDs** (contain `/`).
2. Copy `android/admob.properties.example` to `android/admob.properties`.
3. Enter the real values for `admobAppId`, `admobRewardedAdUnitId`, and `admobInterstitialAdUnitId`.
4. Keep `admobTestMode=true` for all development/testing. Only set it to `false` for a properly configured release build with real IDs.
5. Re-check the final package name and Play Console registration before publishing.

The `admob.properties` file is git-ignored. Do not publish it in a public repository.

## Build

Requires JDK 17, Android SDK platform 35, and internet access for Gradle dependencies. The project currently uses Google Mobile Ads SDK 25.5.0, which requires Android API 24 or newer.

```sh
cd android
gradle wrapper --gradle-version 8.9   # only if the wrapper scripts/jar are not already present
./gradlew assembleDebug
```

Expected debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

## Before production release

- Complete and verify the app's privacy policy and Google Play Data safety / ads declarations.
- Add Google's User Messaging Platform (UMP) consent flow wherever required, and configure the correct age/audience treatment. Do not assume non-personalized ads alone satisfy every consent requirement.
- Review the merged Android manifest and the SDK's data collection disclosures.
- Confirm the game audience and Google Play Families requirements, if applicable.
- Set a real package ID and release signing configuration.
- Have the adult account holder manage the advertising account, payment profile, and publishing steps where required.

This setup document is technical guidance, not legal advice or a guarantee of AdMob approval/earnings.
