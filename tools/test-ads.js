#!/usr/bin/env node
/* Browser test of the ads layer and its wiring in the game (needs Playwright + Chromium, like tools/e2e-browser.js).
     node tools/test-ads.js
   It does NOT load any ad SDK. It installs a FAKE window.AFNativeAds (the same two-method shape the Android app injects)
   that can simulate: a confirmed reward, a skipped/cancelled ad, a failed show, a silent bridge, a duplicated result,
   a forged callback and a throwing bridge. No network, no real ads. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const root = path.resolve(__dirname, '..');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((q, s) => {
  let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); s.end(b); } });
});
const ONB = JSON.stringify({ consent: { version: '1.0', acceptedAt: new Date().toISOString() }, tutorial: { status: 'skipped', at: new Date().toISOString() } });
let failed = 0;
const check = (name, ok, info) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };

// Installed before any page script runs, exactly where the Android app registers its bridge.
const FAKE = function (cfg) {
  const f = window.__fake = Object.assign({ enabled: true, rewardedReady: true, interstitialReady: true, mode: 'reward', calls: [], statusCalls: 0 }, cfg || {});
  if (f.absent) return;
  const send = (o) => window.AF.Ads._native(JSON.stringify(o));
  window.AFNativeAds = {
    status() { f.statusCalls++; return JSON.stringify({ enabled: f.enabled, rewardedReady: f.rewardedReady, interstitialReady: f.interstitialReady }); },
    show(kind, token) {
      f.calls.push({ kind, token, level: window.AF.Game && window.AF.Game.getState && window.AF.Game.getState().status });
      if (f.mode === 'throw') throw new Error('bridge exploded');
      if (f.mode === 'silent') return;
      if (f.mode === 'fail') { setTimeout(() => send({ token, event: 'failed' }), 30); return; }
      setTimeout(() => send({ token, event: 'started' }), 30);
      const earned = f.mode === 'reward' || f.mode === 'dup';
      setTimeout(() => send({ token, event: 'result', rewarded: earned }), 120);
      if (f.mode === 'dup') { setTimeout(() => send({ token, event: 'result', rewarded: true }), 200); setTimeout(() => send({ token, event: 'result', rewarded: true }), 600); }
    }
  };
};

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });

  async function open(fake, save) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript((a) => { try { localStorage.setItem('arrowflow.onboarding.v1', a.onb); if (a.save) localStorage.setItem('arrowflow.save.v1', a.save); } catch (e) {} }, { onb: ONB, save: save || null });
    await page.addInitScript(FAKE, fake);
    await page.goto(base, { waitUntil: 'load' });
    // The app leaves its splash screen on its own timer (about 2.2 s) and then routes to Home. Drive the game only
    // after that has happened, otherwise the splash timer can pull the screen away in the middle of a test.
    await page.waitForFunction(() => window.AF && AF.UI && AF.UI.currentName() === 'home', null, { timeout: 8000 });
    return { ctx, page, errors };
  }
  const startLevel = (page, id) => page.evaluate((i) => { document.documentElement.dataset.motion = 'reduced'; const snap = AF.Game.loadLevel(i); AF.Extra.begin(); AF.UI.renderGame(snap); AF.UI.show('game', 'fade'); }, id);
  const useUpHints = (page) => page.evaluate(() => { while (AF.Extra.hints() > 0) AF.Extra.useHint(); return AF.Extra.hints(); });
  const tapAction = async (page, action) => { await page.locator('[data-action="' + action + '"]:visible').first().click(); };
  const hintsLeft = (page) => page.evaluate(() => AF.Extra.hints());
  const solveLevel = (page) => page.evaluate(() => { const p = AF.Game.getPuzzle(); for (const a of AF.Rules.solve(p).order) AF.Game.attemptArrowMove(a); return AF.Game.getState().status; });
  const sheetOpen = (page, id) => page.evaluate((i) => document.getElementById('sheet-' + i).classList.contains('is-open'), id);

  // 1. Plain browser (no bridge): nothing breaks, no ad UI appears.
  {
    const { ctx, page, errors } = await open({ absent: true });
    await startLevel(page, 7); await useUpHints(page);
    await tapAction(page, 'hint');
    check('no provider: out of hints just shows the old toast, no ad sheet', !(await sheetOpen(page, 'hint-ad')) && (await hintsLeft(page)) === 0);
    check('no provider: showRewarded resolves false', (await page.evaluate(async () => await AF.Ads.showRewarded())) === false);
    await solveLevel(page); await page.waitForTimeout(400);
    const t0 = Date.now(); await tapAction(page, 'next-level'); await page.waitForTimeout(150);
    check('no provider: Next continues to the next level immediately', (await page.evaluate(() => AF.Game.getState().levelId)) === 8 && Date.now() - t0 < 1500);
    check('no provider: no page errors', errors.length === 0, errors);
    await ctx.close();
  }

  // 2. Rewarded hint, confirmed reward.
  {
    const { ctx, page, errors } = await open({ mode: 'reward' });
    await startLevel(page, 7);
    const before = await hintsLeft(page);
    await tapAction(page, 'hint');
    check('with free hints left, tapping Hint never shows an ad', (await page.evaluate(() => window.__fake.calls.length)) === 0 && (await hintsLeft(page)) === before - 1);
    await useUpHints(page);
    const save0 = await page.evaluate(() => localStorage.getItem('arrowflow.save.v1'));
    await tapAction(page, 'hint');
    check('out of hints + ad ready: offer sheet opens, no ad shown yet', (await sheetOpen(page, 'hint-ad')) && (await page.evaluate(() => window.__fake.calls.length)) === 0);
    await tapAction(page, 'hint-ad-watch');
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({ calls: window.__fake.calls.length, hints: AF.Extra.hints(), hl: document.querySelectorAll('#board .arrow.is-hint').length, status: AF.Game.getState().status, level: AF.Game.getState().levelId }));
    check('confirmed reward: exactly one ad request, one hint granted AND used, game still playing', r.calls === 1 && r.hints === 0 && r.hl === 1 && r.status === 'playing' && r.level === 7, r);
    check('rewarded ad never changes saved progress', (await page.evaluate(() => localStorage.getItem('arrowflow.save.v1'))) === save0);
    check('no page errors (reward path)', errors.length === 0, errors);
    await ctx.close();
  }

  // 3. Not-earned outcomes: skipped, failed, silent, throwing. No hint in any of them.
  for (const [mode, cfg] of [['skipped', { mode: 'skip' }], ['failed', { mode: 'fail' }], ['bridge never answers', { mode: 'silent' }], ['bridge throws', { mode: 'throw' }]]) {
    const { ctx, page, errors } = await open(cfg);
    await page.evaluate(() => AF.Ads.configure({ startTimeoutMs: { rewarded: 600, interstitial: 600 } }));
    await startLevel(page, 7); await useUpHints(page);
    await tapAction(page, 'hint'); await tapAction(page, 'hint-ad-watch');
    await page.waitForTimeout(1100);
    const r = await page.evaluate(() => ({ hints: AF.Extra.hints(), hl: document.querySelectorAll('#board .arrow.is-hint').length, busy: AF.Ads.isBusy(), status: AF.Game.getState().status }));
    check('rewarded ' + mode + ': no hint granted, ads layer free again, level still playable', r.hints === 0 && r.hl === 0 && !r.busy && r.status === 'playing', r);
    check('rewarded ' + mode + ': no page errors', errors.length === 0, errors);
    await ctx.close();
  }

  // 4. Duplicate / forged callbacks and double taps.
  {
    const { ctx, page, errors } = await open({ mode: 'dup' });
    await startLevel(page, 7); await useUpHints(page);
    await tapAction(page, 'hint');
    // two rapid taps on "Watch": only one request may go out
    await page.evaluate(() => { const b = document.querySelector('#sheet-hint-ad [data-action="hint-ad-watch"]'); b.click(); b.click(); });
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({ calls: window.__fake.calls.length, hints: AF.Extra.hints() }));
    check('double tap + result delivered 3 times: one request, one hint, never a second grant', r.calls === 1 && r.hints === 0, r);
    // forged callbacks with no pending request, or with a wrong token, must do nothing
    await page.evaluate(() => { AF.Ads._native(JSON.stringify({ token: 'forged', event: 'result', rewarded: true })); AF.Ads._native('{"token":1,"event":"result","rewarded":true}'); AF.Ads._native('not json'); AF.Ads._native(null); });
    check('forged / malformed callbacks are ignored', (await hintsLeft(page)) === 0);
    check('no page errors (duplicates)', errors.length === 0, errors);
    await ctx.close();
  }
  {
    // forged result while a real request is pending must not settle it
    const { ctx, page } = await open({ mode: 'silent' });
    await page.evaluate(() => AF.Ads.configure({ startTimeoutMs: { rewarded: 2500, interstitial: 600 } }));
    const res = await page.evaluate(async () => { const p = AF.Ads.showRewarded(); AF.Ads._native(JSON.stringify({ token: 'wrong', event: 'result', rewarded: true })); return Promise.race([p, new Promise((r) => setTimeout(() => r('pending'), 400))]); });
    check('wrong-token result does not satisfy a pending rewarded request', res === 'pending', res);
    await ctx.close();
  }
  {
    // ad not ready -> never offered; no show call
    const { ctx, page } = await open({ rewardedReady: false });
    await startLevel(page, 7); await useUpHints(page); await tapAction(page, 'hint');
    check('rewarded not ready: no offer sheet and no show call', !(await sheetOpen(page, 'hint-ad')) && (await page.evaluate(() => window.__fake.calls.length)) === 0);
    await ctx.close();
  }

  // 5. Interstitials: capped, only at Next on the complete screen, never mid-puzzle, never blocking.
  {
    const { ctx, page, errors } = await open({ mode: 'reward' });   // interstitial result carries rewarded:true, which must be ignored for interstitials
    const shownAt = [];
    for (let lvl = 1; lvl <= 14; lvl++) {
      if (lvl === 1) await startLevel(page, 1);
      else await page.waitForFunction((id) => AF.UI.currentName() === 'game' && AF.Game.getState().levelId === id, lvl, { timeout: 5000 });   // reached through the app's own Next flow
      // play a few real taps mid-puzzle, then confirm no ad was requested yet
      const midCalls = await page.evaluate(() => { const p = AF.Game.getPuzzle(); const o = AF.Rules.solve(p).order; if (o.length > 2) AF.Game.attemptArrowMove(o[0]); return window.__fake.calls.length; });
      const before = await page.evaluate(() => window.__fake.calls.length);
      if (midCalls !== before) check('ad requested mid-puzzle', false, { lvl });
      await page.evaluate(() => { const p = AF.Game.getPuzzle(); AF.Rules.solve(p); });
      await page.evaluate(() => { document.documentElement.dataset.motion = 'reduced'; });
      await solveRemaining(page);
      await page.waitForTimeout(350);
      const onComplete = await page.evaluate(() => AF.UI.currentName());
      if (onComplete !== 'complete') { check('level ' + lvl + ' reached complete screen', false, onComplete); break; }
      await tapAction(page, 'next-level');
      await page.waitForTimeout(700);
      const n = await page.evaluate(() => window.__fake.calls.length);
      if (n > before) shownAt.push(lvl);
      const cur = await page.evaluate(() => AF.Game.getState().levelId);
      if (cur !== lvl + 1) { check('Next always reaches level ' + (lvl + 1), false, { cur }); break; }
    }
    check('interstitial cap: none in levels 1-5, at most one per 4 levels, min-gap respected', JSON.stringify(shownAt) === '[6]', shownAt);
    const kinds = await page.evaluate(() => window.__fake.calls.map((c) => c.kind));
    check('only interstitials were requested during level flow, none while playing', kinds.every((k) => k === 'interstitial') && (await page.evaluate(() => window.__fake.calls.every((c) => c.level === 'complete'))));
    check('no page errors (interstitial flow)', errors.length === 0, errors);
    await ctx.close();
  }
  async function solveRemaining(page) {
    await page.evaluate(() => { const p = AF.Game.getPuzzle(); const done = new Set(AF.Game.getState().exited); for (const a of AF.Rules.solve(p).order) { if (!done.has(a)) AF.Game.attemptArrowMove(a); } });
  }
  {
    // interstitial that never answers must not trap the player; failed show must not either
    for (const mode of ['silent', 'fail', 'throw']) {
      const { ctx, page } = await open({ mode });
      await page.evaluate(() => AF.Ads.configure({ interstitialEveryLevels: 1, interstitialMinLevel: 1, startTimeoutMs: { rewarded: 600, interstitial: 700 } }));
      await startLevel(page, 9); await solveRemaining(page); await page.waitForTimeout(350);
      const t0 = Date.now(); await tapAction(page, 'next-level');
      await page.waitForFunction(() => AF.Game.getState().levelId === 10, null, { timeout: 4000 });
      check('interstitial "' + mode + '": player still reaches the next level quickly', Date.now() - t0 < 2500, { ms: Date.now() - t0, calls: await page.evaluate(() => window.__fake.calls.length) });
      await ctx.close();
    }
    // double-tap Next while an interstitial is up: one level advance only
    const { ctx, page } = await open({ mode: 'reward' });
    await page.evaluate(() => AF.Ads.configure({ interstitialEveryLevels: 1, interstitialMinLevel: 1 }));
    await startLevel(page, 9); await solveRemaining(page); await page.waitForTimeout(350);
    await page.evaluate(() => { const b = document.querySelector('.screen.complete [data-action="next-level"]'); b.click(); b.click(); b.click(); });
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({ lvl: AF.Game.getState().levelId, calls: window.__fake.calls.length }));
    check('triple tap on Next: one ad request, advances exactly one level', r.lvl === 10 && r.calls === 1, r);
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(failed ? 'ADS TEST FAILED: ' + failed : 'ADS TEST PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
