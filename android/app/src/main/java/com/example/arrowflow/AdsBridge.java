package com.example.arrowflow;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

import java.lang.ref.WeakReference;
import java.util.regex.Pattern;

/**
 * The ONLY object exposed to the page (as window.AFNativeAds). Two methods, both with validated input:
 *   status()           read-only JSON about ad readiness
 *   show(kind, token)  kind must be exactly "rewarded" or "interstitial"; token must match TOKEN
 * It never exposes files, the activity, the AdMob SDK or any other native capability. Reward results go back
 * to the page through MainActivity (see MainActivity#deliver), not through this class.
 */
final class AdsBridge {
    private static final Pattern TOKEN = Pattern.compile("^[A-Za-z0-9]{6,48}$");
    private final AdMobGateway gateway;
    private final WeakReference<Activity> activity;
    private final Handler main = new Handler(Looper.getMainLooper());

    AdsBridge(Activity activity, AdMobGateway gateway) {
        this.activity = new WeakReference<>(activity);
        this.gateway = gateway;
    }

    @JavascriptInterface
    public String status() {
        return gateway.statusJson();
    }

    @JavascriptInterface
    public void show(final String kind, final String token) {
        if (kind == null || token == null || !TOKEN.matcher(token).matches()) return;
        final int k;
        if ("rewarded".equals(kind)) k = AdMobGateway.REWARDED;
        else if ("interstitial".equals(kind)) k = AdMobGateway.INTERSTITIAL;
        else return;
        main.post(new Runnable() { @Override public void run() { gateway.show(activity.get(), k, token); } });
    }
}
