package com.example.arrowflow;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardItem;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

/** Native AdMob gateway for the web game. Keeps the page bridge contract unchanged. */
final class AdMobGateway {
    static final int REWARDED = 0;
    static final int INTERSTITIAL = 1;

    interface Events {
        void onShowEvent(String token, String event, boolean rewarded);
    }

    private static final String TAG = "ArrowFlowAds";
    private static final int MAX_AUTO_RETRIES = 4;
    private static final long[] BACKOFF_MS = {5_000, 15_000, 45_000, 120_000};
    private static final long NUDGE_MIN_GAP_MS = 60_000;
    private static final long SHOW_WATCHDOG_MS = 180_000;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final Events events;
    private final String rewardedUnitId, interstitialUnitId;
    private final boolean testMode;

    private boolean initStarted, initialized;
    private RewardedAd rewardedAd;
    private InterstitialAd interstitialAd;
    private boolean loadingRewarded, loadingInterstitial, showing;
    private int rewardedFails, interstitialFails, initFailures;
    private long lastNudge;
    private String currentToken;
    private boolean earned;

    private volatile boolean snapEnabled, snapRewardedReady, snapInterstitialReady;

    private final Runnable watchdog = new Runnable() {
        @Override public void run() { finish(currentToken, "failed", false); }
    };
    private final Runnable reloadRewarded = new Runnable() { @Override public void run() { loadRewarded(); } };
    private final Runnable reloadInterstitial = new Runnable() { @Override public void run() { loadInterstitial(); } };

    AdMobGateway(Events events, String rewardedUnitId, String interstitialUnitId, boolean testMode) {
        this.events = events;
        this.testMode = testMode;
        this.rewardedUnitId = testMode ? "ca-app-pub-3940256099942544/5224354917" : (rewardedUnitId == null ? "" : rewardedUnitId.trim());
        this.interstitialUnitId = (interstitialUnitId == null ? "" : interstitialUnitId.trim());
    }

    void start(Activity activity) {
        if (activity == null || rewardedUnitId.isEmpty()) {
            Log.i(TAG, "AdMob rewarded ad unit ID not configured: ads disabled.");
            return;
        }
        if (initStarted || initialized) return;
        appContext = activity.getApplicationContext();
        initStarted = true;
        MobileAds.initialize(appContext, status -> main.post(() -> {
            initialized = true;
            initFailures = 0;
            loadRewarded();
            loadInterstitial();
            publish();
        }));
    }

    private AdRequest request() {
        // During development the configured IDs are Google's official test ad units.
        // Do not click live ads in your own app. Add a consent flow before production release where required.
        return new AdRequest.Builder().build();
    }

    private void loadRewarded() {
        if (!initialized || rewardedUnitId.isEmpty() || rewardedAd != null || loadingRewarded || showing) return;
        loadingRewarded = true;
        RewardedAd.load(nullSafeContext(), rewardedUnitId, request(), new RewardedAdLoadCallback() {
            @Override public void onAdLoaded(RewardedAd ad) {
                main.post(() -> { loadingRewarded = false; rewardedAd = ad; rewardedFails = 0; publish(); });
            }
            @Override public void onAdFailedToLoad(LoadAdError error) {
                main.post(() -> { loadingRewarded = false; rewardedAd = null; rewardedFails++; Log.w(TAG, "Rewarded ad load failed: " + error.getMessage()); scheduleReload(REWARDED, backoff(rewardedFails)); publish(); });
            }
        });
    }

    // MobileAds load methods require a Context; set by start() before any load begins.
    private android.content.Context appContext;
    private android.content.Context nullSafeContext() { return appContext; }

    private void loadInterstitial() {
        if (!initialized || interstitialUnitId.isEmpty() || interstitialAd != null || loadingInterstitial || showing) return;
        loadingInterstitial = true;
        InterstitialAd.load(appContext, interstitialUnitId, request(), new InterstitialAdLoadCallback() {
            @Override public void onAdLoaded(InterstitialAd ad) {
                main.post(() -> { loadingInterstitial = false; interstitialAd = ad; interstitialFails = 0; publish(); });
            }
            @Override public void onAdFailedToLoad(LoadAdError error) {
                main.post(() -> { loadingInterstitial = false; interstitialAd = null; interstitialFails++; Log.w(TAG, "Interstitial ad load failed: " + error.getMessage()); scheduleReload(INTERSTITIAL, backoff(interstitialFails)); publish(); });
            }
        });
    }

    private static long backoff(int fails) { return BACKOFF_MS[Math.min(Math.max(fails, 1), BACKOFF_MS.length) - 1]; }

    private void scheduleReload(int kind, long delayMs) {
        Runnable r = kind == REWARDED ? reloadRewarded : reloadInterstitial;
        int fails = kind == REWARDED ? rewardedFails : interstitialFails;
        main.removeCallbacks(r);
        if (fails <= MAX_AUTO_RETRIES) main.postDelayed(r, delayMs);
    }

    private void nudge() {
        long now = System.currentTimeMillis();
        if (now - lastNudge < NUDGE_MIN_GAP_MS) return;
        if (!initialized) {
            if (!initStarted && initFailures < 3) { lastNudge = now; /* startup is retried by Activity recreation */ }
            return;
        }
        if ((rewardedAd == null && !loadingRewarded) || (interstitialAd == null && !loadingInterstitial)) {
            lastNudge = now;
            if (rewardedFails > MAX_AUTO_RETRIES) rewardedFails = MAX_AUTO_RETRIES;
            if (interstitialFails > MAX_AUTO_RETRIES) interstitialFails = MAX_AUTO_RETRIES;
            loadRewarded(); loadInterstitial();
        }
    }

    private void publish() {
        snapEnabled = initialized;
        snapRewardedReady = initialized && rewardedAd != null && !showing;
        snapInterstitialReady = initialized && interstitialAd != null && !showing;
    }

    String statusJson() {
        main.post(this::nudge);
        return "{\"enabled\":" + snapEnabled + ",\"rewardedReady\":" + snapRewardedReady + ",\"interstitialReady\":" + snapInterstitialReady + "}";
    }

    boolean isShowing() { return showing; }

    void show(Activity activity, int kind, String token) {
        if (showing || activity == null || activity.isFinishing() || !initialized) { emit(token, "failed", false); return; }
        if (kind == REWARDED) {
            final RewardedAd ad = rewardedAd;
            if (ad == null) { emit(token, "failed", false); nudge(); return; }
            rewardedAd = null;
            begin(token);
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdShowedFullScreenContent() { main.post(() -> { if (token.equals(currentToken)) emit(token, "started", false); }); }
                @Override public void onAdDismissedFullScreenContent() { main.post(() -> finish(token, "result", earned)); }
                @Override public void onAdFailedToShowFullScreenContent(AdError error) { main.post(() -> finish(token, "failed", false)); }
            });
            ad.show(activity, (RewardItem reward) -> main.post(() -> { if (token.equals(currentToken)) earned = true; }));
        } else if (kind == INTERSTITIAL) {
            final InterstitialAd ad = interstitialAd;
            if (ad == null) { emit(token, "failed", false); nudge(); return; }
            interstitialAd = null;
            begin(token);
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override public void onAdShowedFullScreenContent() { main.post(() -> { if (token.equals(currentToken)) emit(token, "started", false); }); }
                @Override public void onAdDismissedFullScreenContent() { main.post(() -> finish(token, "result", false)); }
                @Override public void onAdFailedToShowFullScreenContent(AdError error) { main.post(() -> finish(token, "failed", false)); }
            });
            ad.show(activity);
        } else {
            emit(token, "failed", false);
        }
    }

    private void begin(String token) {
        showing = true; currentToken = token; earned = false; publish();
        main.removeCallbacks(watchdog);
        main.postDelayed(watchdog, SHOW_WATCHDOG_MS);
    }

    private void finish(String token, String event, boolean rewarded) {
        if (!showing || token == null || !token.equals(currentToken)) return;
        main.removeCallbacks(watchdog);
        showing = false; currentToken = null;
        emit(token, event, rewarded);
        publish();
        loadRewarded(); loadInterstitial();
    }

    private void emit(String token, String event, boolean rewarded) {
        try { events.onShowEvent(token, event, rewarded); } catch (Throwable t) { Log.w(TAG, "Event delivery failed", t); }
    }
}
