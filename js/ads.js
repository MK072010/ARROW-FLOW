/* Arrow Flow ads layer (Google AdMob, via the Android app's native bridge).

   This file contains NO ad SDK, no IDs and no keys. In a plain browser there is no provider, so every call resolves
   to "not available" and the game carries on. Inside the Android app, MainActivity injects ONE bridge object,
   `AFNativeAds`, with exactly two methods:
       status()              -> JSON string {"enabled":bool,"rewardedReady":bool,"interstitialReady":bool}
       show(kind, token)     -> kind is "rewarded" or "interstitial"; token is a one-time id made here
   The native side answers by calling AF.Ads._native(jsonString) with {token, event, rewarded}:
       event "started"  the ad is on screen
       event "result"   the ad closed; `rewarded` is true ONLY if the AdMob SDK confirmed the reward
       event "failed"   the ad could not be shown
   Rules enforced here, independent of gameplay code:
     - one ad at a time; a second request while one is pending is refused (no duplicate callbacks, no double rewards);
     - every token is single-use and ignored once settled or timed out, so a late or repeated callback does nothing;
     - ads are requested only from natural breaks (the player tapped Hint with none left, or tapped Next on the
       level-complete screen), never mid-puzzle and never on a plain tap;
     - interstitials are capped (every Nth level, a minimum gap, and never in the first levels);
     - any failure, timeout or missing provider resolves to "not shown" and never blocks the player.
   Nothing here reads or writes puzzle state or saved progress; callers decide what a reward means. */
(function (AF) {
  'use strict';
  var provider = null;
  var pending = null;            // { token, kind, resolve, started, startTimer, endTimer }
  var seq = 0;
  var lastInterstitial = 0;
  var levelsSince = 0;
  var hooks = { start: null, end: null };
  var cfg = {
    interstitialEveryLevels: 4,        // at most one interstitial per 4 completed levels...
    interstitialMinGapMs: 180000,      // ...and never closer than 3 minutes apart...
    interstitialMinLevel: 6,           // ...and never while the player is still in the first 5 levels
    startTimeoutMs: { rewarded: 8000, interstitial: 3000 },   // give up if the ad never appears
    maxShowMs: 180000                  // safety release if a result never arrives
  };

  function newToken() { seq++; return 'ad' + Date.now().toString(36) + seq.toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
  function call(fn) { try { if (typeof fn === 'function') fn(); } catch (e) { /* hooks must never break the game */ } }

  function settle(p, value) {
    if (!p || pending !== p) return;
    clearTimeout(p.startTimer); clearTimeout(p.endTimer);
    pending = null;
    if (p.started) call(hooks.end);
    p.resolve(!!value);
  }

  function refreshNativeProvider() {
    // Android may expose JavascriptInterface objects only after the page starts loading.
    // Re-discover it on demand instead of permanently caching a null provider at script startup.
    if (!provider) provider = nativeProvider();
    return provider;
  }

  function readStatus() {
    try {
      refreshNativeProvider();
      var s = provider && typeof provider.status === 'function' ? provider.status() : null;
      return s && typeof s === 'object' ? s : { enabled: false, rewardedReady: false, interstitialReady: false };
    } catch (e) { return { enabled: false, rewardedReady: false, interstitialReady: false }; }
  }

  function present(kind) {
    return new Promise(function (resolve) {
      var p = { token: newToken(), kind: kind, resolve: resolve, started: false, startTimer: 0, endTimer: 0 };
      pending = p;
      p.startTimer = setTimeout(function () { settle(p, false); }, cfg.startTimeoutMs[kind] || 5000);
      p.endTimer = setTimeout(function () { settle(p, false); }, cfg.maxShowMs);
      try { provider.show(kind, p.token); } catch (e) { settle(p, false); }
    });
  }

  // Native bridge adapter (only when the Android app injected AFNativeAds).
  function nativeProvider() {
    var b = window.AFNativeAds;
    if (!b || typeof b.status !== 'function' || typeof b.show !== 'function') return null;
    return {
      status: function () { try { return JSON.parse(b.status()); } catch (e) { return null; } },
      show: function (kind, token) { b.show(kind, token); }
    };
  }

  AF.Ads = {
    setProvider: function (p) { provider = p && typeof p === 'object' ? p : null; },
    configure: function (o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(cfg, k)) cfg[k] = o[k]; },
    // hooks.start / hooks.end let the app pause and resume its own timer around an ad. They get no arguments.
    setHooks: function (h) { hooks.start = h && h.start || null; hooks.end = h && h.end || null; },
    hasProvider: function () { return !!refreshNativeProvider(); },
    isBusy: function () { return !!pending; },
    // True when a rewarded ad could be shown right now (used to decide whether to offer "watch an ad for a hint").
    rewardedAvailable: function () { var s = readStatus(); return !!(provider && !pending && s.enabled && s.rewardedReady); },
    // Wait briefly for a rewarded ad that is still loading/reloading, then show it.
    // Resolves true ONLY if the SDK confirms the reward; never grants rewards itself.
    showRewarded: function () {
      var self = this;
      var deadline = Date.now() + 20000;
      return new Promise(function (resolve) {
        function attempt() {
          refreshNativeProvider();
          if (!provider) { resolve(false); return; }
          if (self.rewardedAvailable()) { present('rewarded').then(resolve); return; }
          if (self.isBusy() || Date.now() >= deadline) { resolve(false); return; }
          setTimeout(attempt, 400);
        }
        attempt();
      });
    },
    // Call when the player taps Next on the level-complete screen. Resolves when it is safe to continue
    // (true if an ad was shown and closed). It never rejects and never holds the player for long.
    maybeShowInterstitial: function (completedLevelId) {
      levelsSince++;
      if (!provider || pending) return Promise.resolve(false);
      if (typeof completedLevelId === 'number' && completedLevelId < cfg.interstitialMinLevel) return Promise.resolve(false);
      var now = Date.now();
      if (levelsSince < cfg.interstitialEveryLevels) return Promise.resolve(false);
      if (lastInterstitial && now - lastInterstitial < cfg.interstitialMinGapMs) return Promise.resolve(false);
      var s = readStatus();
      if (!s.enabled || !s.interstitialReady) return Promise.resolve(false);   // no ad ready: skip, try again next level
      levelsSince = 0; lastInterstitial = now;
      return present('interstitial');
    },
    // Called by the native bridge only. Ignores anything that is not for the one pending, unsettled token.
    _native: function (json) {
      var m;
      try { m = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      var p = pending;
      if (!p || typeof m.token !== 'string' || m.token !== p.token) return;
      if (m.event === 'started') {
        if (p.started) return;
        p.started = true; clearTimeout(p.startTimer); call(hooks.start);
      } else if (m.event === 'result') {
        settle(p, p.kind === 'rewarded' && m.rewarded === true);
      } else if (m.event === 'failed') {
        settle(p, false);
      }
    }
  };

  // Do not cache a missing bridge permanently; WebView may inject it after scripts begin loading.
  refreshNativeProvider();
})(window.AF = window.AF || {});
