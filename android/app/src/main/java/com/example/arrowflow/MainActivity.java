package com.example.arrowflow;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

/**
 * Hosts the Arrow Flow web game from the app's own assets (https://appassets.androidplatform.net/assets/www/),
 * and wires the secured ads bridge. Ad logic stays outside the game: the page only sees AFNativeAds.
 */
public class MainActivity extends Activity implements AdMobGateway.Events {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/www/index.html";

    private WebView webView;
    private AdMobGateway ads;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ads = new AdMobGateway(this, BuildConfig.ADMOB_REWARDED_AD_UNIT_ID,
                BuildConfig.ADMOB_INTERSTITIAL_AD_UNIT_ID, BuildConfig.ADMOB_TEST_MODE);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);            // the game is JavaScript
        s.setDomStorageEnabled(true);            // progress and settings use localStorage
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setGeolocationEnabled(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                // The WebView renderer crashed or was killed by the system: rebuild the activity instead of crashing the app.
                MainActivity.this.recreate();
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;   // our own pages only
                // Anything else never loads inside the page that holds the bridge. Plain https links open in the browser.
                if ("https".equals(u.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                }
                return true;
            }
        });

        // Registered before the page loads, so the page sees it from its first script. Exposes status() and show() only.
        webView.addJavascriptInterface(new AdsBridge(this, ads), "AFNativeAds");

        ads.start(this);
        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(START_URL);
    }

    /** Called by the gateway (any thread). Sends a result to the page as one JSON string; the page validates the token. */
    @Override
    public void onShowEvent(final String token, final String event, final boolean rewarded) {
        final WebView w = webView;
        if (w == null) return;
        try {
            JSONObject o = new JSONObject();
            o.put("token", token);
            o.put("event", event);
            o.put("rewarded", rewarded);
            final String js = "window.AF&&window.AF.Ads&&window.AF.Ads._native(" + JSONObject.quote(o.toString()) + ")";
            w.post(new Runnable() { @Override public void run() { if (webView != null) webView.evaluateJavascript(js, null); } });
        } catch (Exception ignored) { }
    }

    /** Back button: let the game step back through its own overlays and screens; leave the app only from its main screen. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        final WebView w = webView;
        if (w == null) { super.onBackPressed(); return; }
        w.evaluateJavascript("(function(){try{return !!(window.AF&&window.AF.handleBack&&window.AF.handleBack());}catch(e){return false;}})()",
                new android.webkit.ValueCallback<String>() {
                    @Override public void onReceiveValue(String handled) { if (!"true".equals(handled)) finish(); }
                });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        // While an ad is on screen the game page should keep its state as is, so only pause the page otherwise.
        if (webView != null && !ads.isShowing()) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("AFNativeAds");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
