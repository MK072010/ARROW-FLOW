package com.example.arrowflow;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsShowOptions;

/** Native Unity Ads gateway for the web game. Keeps the page bridge contract (AFNativeAds) unchanged. */
final class UnityAdsGateway {
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
    private final String gameId, rewardedId, interstitialId;
    private final boolean testMode;

    private Context appContext;
    private boolean initStarted, initialized;
    private boolean rewardedReady, interstitialReady;
    private boolean loadingRewarded, loadingInterstitial, showing;
    private int rewardedFails, interstitialFails;
    private long lastNudge;
    private String currentToken;

    private volatile boolean snapEnabled, snapRewardedReady, snapInterstitialReady;

    private final Runnable watchdog = new Runnable() {
        @Override public void run() { finish(currentToken, "failed", false); }
    };
    private final Runnable reloadRewarded = new Runnable() { @Override public void run() { load(REWARDED); } };
    private final Runnable reloadInterstitial = new Runnable() { @Override public void run() { load(INTERSTITIAL); } };

    UnityAdsGateway(Events events, String gameId, String rewardedId, String interstitialId, boolean testMode) {
        this.events = events;
        this.gameId = gameId == null ? "" : gameId.trim();
        this.rewardedId = rewardedId == null ? "" : rewardedId.trim();
        this.interstitialId = interstitialId == null ? "" : interstitialId.trim();
        this.testMode = testMode;
    }

    void start(Activity activity) {
        if (activity == null || gameId.isEmpty() || rewardedId.isEmpty()) {
            Log.i(TAG, "Unity Ads not configured (game ID / rewarded placement missing): ads disabled.");
            return;
        }
        if (initStarted || initialized) return;
        initStarted = true;
        appContext = activity.getApplicationContext();
        UnityAds.initialize(appContext, gameId, testMode, new IUnityAdsInitializationListener() {
            @Override public void onInitializationComplete() {
                main.post(new Runnable() { @Override public void run() {
                    initialized = true;
                    load(REWARDED);
                    load(INTERSTITIAL);
                    publish();
                }});
            }
            @Override public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                Log.w(TAG, "Unity Ads init failed: " + error + " " + message);
                main.post(new Runnable() { @Override public void run() { initStarted = false; publish(); } });
            }
        });
    }

    private String idFor(int kind) { return kind == REWARDED ? rewardedId : interstitialId; }

    private void load(final int kind) {
        final String id = idFor(kind);
        if (!initialized || id.isEmpty() || showing) return;
        if (kind == REWARDED ? (rewardedReady || loadingRewarded) : (interstitialReady || loadingInterstitial)) return;
        if (kind == REWARDED) loadingRewarded = true; else loadingInterstitial = true;
        UnityAds.load(id, new IUnityAdsLoadListener() {
            @Override public void onUnityAdsAdLoaded(String placementId) {
                main.post(new Runnable() { @Override public void run() {
                    if (kind == REWARDED) { loadingRewarded = false; rewardedReady = true; rewardedFails = 0; }
                    else { loadingInterstitial = false; interstitialReady = true; interstitialFails = 0; }
                    publish();
                }});
            }
            @Override public void onUnityAdsFailedToLoad(String placementId, UnityAds.UnityAdsLoadError error, final String message) {
                Log.w(TAG, "Unity ad load failed (" + placementId + "): " + error + " " + message);
                main.post(new Runnable() { @Override public void run() {
                    int fails;
                    if (kind == REWARDED) { loadingRewarded = false; rewardedReady = false; fails = ++rewardedFails; }
                    else { loadingInterstitial = false; interstitialReady = false; fails = ++interstitialFails; }
                    scheduleReload(kind, fails);
                    publish();
                }});
            }
        });
    }

    private void scheduleReload(int kind, int fails) {
        Runnable r = kind == REWARDED ? reloadRewarded : reloadInterstitial;
        main.removeCallbacks(r);
        if (fails <= MAX_AUTO_RETRIES) main.postDelayed(r, BACKOFF_MS[Math.min(Math.max(fails, 1), BACKOFF_MS.length) - 1]);
    }

    private void nudge() {
        long now = System.currentTimeMillis();
        if (now - lastNudge < NUDGE_MIN_GAP_MS) return;
        if (!initialized) {
            if (!initStarted && activityForRetry != null) { lastNudge = now; start(activityForRetry); }
            return;
        }
        lastNudge = now;
        if (rewardedFails > MAX_AUTO_RETRIES) rewardedFails = MAX_AUTO_RETRIES;
        if (interstitialFails > MAX_AUTO_RETRIES) interstitialFails = MAX_AUTO_RETRIES;
        load(REWARDED); load(INTERSTITIAL);
    }

    private Activity activityForRetry;
    void attach(Activity a) { activityForRetry = a; }

    private void publish() {
        snapEnabled = initialized;
        snapRewardedReady = initialized && rewardedReady && !showing;
        snapInterstitialReady = initialized && interstitialReady && !showing;
    }

    String statusJson() {
        main.post(new Runnable() { @Override public void run() { nudge(); } });
        return "{\"enabled\":" + snapEnabled + ",\"rewardedReady\":" + snapRewardedReady + ",\"interstitialReady\":" + snapInterstitialReady + "}";
    }

    boolean isShowing() { return showing; }

    void show(Activity activity, final int kind, final String token) {
        if (showing || activity == null || activity.isFinishing() || !initialized) { emit(token, "failed", false); return; }
        boolean ready = kind == REWARDED ? rewardedReady : kind == INTERSTITIAL && interstitialReady;
        if (!ready) { emit(token, "failed", false); nudge(); return; }
        if (kind == REWARDED) rewardedReady = false; else interstitialReady = false;
        begin(token);
        UnityAds.show(activity, idFor(kind), new UnityAdsShowOptions(), new IUnityAdsShowListener() {
            @Override public void onUnityAdsShowStart(String placementId) {
                main.post(new Runnable() { @Override public void run() { if (token.equals(currentToken)) emit(token, "started", false); } });
            }
            @Override public void onUnityAdsShowClick(String placementId) { }
            @Override public void onUnityAdsShowComplete(String placementId, final UnityAds.UnityAdsShowCompletionState state) {
                final boolean earned = kind == REWARDED && state == UnityAds.UnityAdsShowCompletionState.COMPLETED;
                main.post(new Runnable() { @Override public void run() { finish(token, "result", earned); } });
            }
            @Override public void onUnityAdsShowFailure(String placementId, UnityAds.UnityAdsShowError error, String message) {
                Log.w(TAG, "Unity ad show failed: " + error + " " + message);
                main.post(new Runnable() { @Override public void run() { finish(token, "failed", false); } });
            }
        });
    }

    private void begin(String token) {
        showing = true; currentToken = token; publish();
        main.removeCallbacks(watchdog);
        main.postDelayed(watchdog, SHOW_WATCHDOG_MS);
    }

    private void finish(String token, String event, boolean rewarded) {
        if (!showing || token == null || !token.equals(currentToken)) return;
        main.removeCallbacks(watchdog);
        showing = false; currentToken = null;
        emit(token, event, rewarded);
        publish();
        load(REWARDED); load(INTERSTITIAL);
    }

    private void emit(String token, String event, boolean rewarded) {
        try { events.onShowEvent(token, event, rewarded); } catch (Throwable t) { Log.w(TAG, "Event delivery failed", t); }
    }
}
