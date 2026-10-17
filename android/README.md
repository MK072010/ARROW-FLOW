# Arrow Flow — Android WebView + Google AdMob

The Android wrapper hosts the existing HTML/CSS/JavaScript game from bundled assets and connects it to the native Google Mobile Ads SDK through a narrow JavaScript bridge. Existing game functionality is preserved.

## AdMob configuration

The Android App ID defaults to the client-provided value `ca-app-pub-4964591304995043~5576971671`. The production rewarded unit defaults to `ca-app-pub-4964591304995043/2617047673`. For development, `admobTestMode` defaults to `true` and the gateway uses Google's official test rewarded unit. Do not click live ads while testing.

Optional local configuration: copy `admob.properties.example` to `admob.properties` and adjust values as appropriate. Keep client credentials private. The interstitial ID is intentionally blank; interstitial ads remain disabled until the client provides a real ID.

Example properties:

```properties
admobAppId=ca-app-pub-4964591304995043~5576971671
admobRewardedAdUnitId=ca-app-pub-4964591304995043/2617047673
admobInterstitialAdUnitId=
admobTestMode=true
appApplicationId=com.example.arrowflow
```

For production, verify the actual application ID/package, use the client's confirmed ad units, set `admobTestMode=false` only after replacing test configuration, complete Google UMP consent requirements where applicable, review the intended audience and privacy disclosures, and configure release signing. The Play Store listing and AdMob app review are not completed by this source-code setup.

## Build

Requires JDK 17, Android SDK/Build Tools for compileSdk 35, and network access to Google's Maven repository and Maven Central. This repository includes Gradle wrapper properties but may not include the wrapper JAR/script. If Gradle is installed: `cd android && gradle assembleDebug`.

The debug build and real-device ad flow must be verified in an Android build environment. This workspace did not have guaranteed access to Android SDK dependencies or a device, so do not assume a successful APK build from the source edits alone.
