#!/usr/bin/env node
/* Optional end-to-end check in a real browser (needs Playwright with Chromium, which is NOT a dependency of the game).
     node tools/e2e-browser.js [outDir]
   Plays every one of the 1000 campaign levels through the game's real engine (AF.Game), checks saved-progress behaviour,
   page errors and load cost, and takes screenshots. */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const root = path.resolve(__dirname, '..');
const out = process.argv[2] || path.join(__dirname, 'out/shots');
fs.mkdirSync(out, { recursive: true });
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((q, s) => {
  let f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); s.end(b); } });
});
const ONB = JSON.stringify({ consent: { version: '1.0', acceptedAt: new Date().toISOString() }, tutorial: { status: 'skipped', at: new Date().toISOString() } });
const results = {};
const check = (name, ok, info) => { results[name] = { ok: !!ok, info: info }; console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  async function open(save, opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, opts || {}));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript((a) => { try { localStorage.setItem('arrowflow.onboarding.v1', a.onb); if (a.save) localStorage.setItem('arrowflow.save.v1', a.save); } catch (e) {} }, { onb: ONB, save: save || null });
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    return { ctx, page, errors };
  }

  // 1. Every level through the real engine.
  {
    const { ctx, page, errors } = await open(null);
    const r = await page.evaluate(() => {
      document.documentElement.dataset.motion = 'reduced';
      const bad = [];
      let moves = 0;
      for (let id = 1; id <= AF.Levels.TOTAL; id++) {
        const snap = AF.Game.loadLevel(id);
        if (!snap) { bad.push([id, 'did not load']); continue; }
        const p = AF.Game.getPuzzle();
        const order = AF.Rules.solve(p).order;
        for (const a of order) {
          if (!AF.Game.canArrowExit(a)) { bad.push([id, 'arrow ' + a + ' not free in solver order']); break; }
          const res = AF.Game.attemptArrowMove(a); moves++;
          if (res !== 'moving') { bad.push([id, 'move ' + a + ' -> ' + res]); break; }
        }
        const st = AF.Game.getState();
        if (st.status !== 'complete' || st.lives !== 3 || st.cleared !== p.arrows.length) bad.push([id, 'ended as ' + st.status + ' lives ' + st.lives + ' cleared ' + st.cleared + '/' + p.arrows.length]);
      }
      return { bad, moves, highest: AF.Storage.getHighestUnlocked() };
    });
    check('all 1000 levels play to completion in the real engine, no life lost', r.bad.length === 0, { failures: r.bad.slice(0, 5), moves: r.moves, highestUnlockedAfter: r.highest });
    check('playing every level in order unlocked level 1000 / all cleared', r.highest === 1000);
    check('no page errors while playing all levels', errors.length === 0, errors.slice(0, 3));
    await ctx.close();
  }

  // 2. Blocked taps still cost lives; hint/undo/restart still work on a generated level.
  {
    const { ctx, page } = await open(null);
    const r = await page.evaluate(() => {
      document.documentElement.dataset.motion = 'reduced';
      AF.Game.loadLevel(60);
      const p = AF.Game.getPuzzle();
      const blocked = p.arrows.find((a) => !AF.Game.canArrowExit(a.id));
      const lives0 = AF.Game.getState().lives;
      const res = AF.Game.attemptArrowMove(blocked.id);
      const lives1 = AF.Game.getState().lives;
      const hint = AF.Game.hint();
      const free = p.arrows.find((a) => AF.Game.canArrowExit(a.id));
      AF.Game.attemptArrowMove(free.id);
      const u = AF.Game.undo();
      const cleared = AF.Game.getState().cleared;
      AF.Game.restartLevel();
      return { res, lives0, lives1, hint: hint.status, undo: u.status, clearedAfterUndo: cleared, afterRestart: AF.Game.getState().cleared, lives: AF.Game.getState().lives };
    });
    check('blocked tap costs a life; hint, undo, restart work', r.res === 'blocked' && r.lives1 === r.lives0 - 1 && r.hint === 'ok' && r.undo === 'ok' && r.clearedAfterUndo === 0 && r.afterRestart === 0 && r.lives === 3, r);
    await ctx.close();
  }

  // 3. Saves: old 50-level finisher, mid-campaign resume with partial level progress, fresh player.
  {
    const old = await open(JSON.stringify({ highestUnlocked: 50, allCleared: true, currentLevel: 50, levelProgress: null, settings: { sound: true, vibration: true, reduceMotion: false } }));
    const r = await old.page.evaluate(() => ({ h: AF.Storage.getHighestUnlocked(), c50: AF.Storage.isCompleted(50), c51: AF.Storage.isCompleted(51), count: AF.Storage.completedCount(), all: AF.Storage.isAllCleared() }));
    check('save from the 50-level build: level 50 stays cleared, level 51 unlocked', r.h === 51 && r.c50 && !r.c51 && r.count === 50 && !r.all, r);
    await old.ctx.close();

    const mid = await open(JSON.stringify({ highestUnlocked: 23, allCleared: false, currentLevel: 23, levelProgress: { levelId: 23, exited: [], lives: 2 }, settings: { sound: true, vibration: true, reduceMotion: true } }));
    const m = await mid.page.evaluate(() => {
      const p = AF.Levels.get(23).puzzle, first = AF.Rules.solve(p).order.slice(0, 2);
      AF.Storage.saveLevelProgress(23, first, 2);
      const snap = AF.Game.loadLevel(23, AF.Storage.getLevelProgress(23));
      return { cleared: snap.cleared, lives: snap.lives, h: AF.Storage.getHighestUnlocked(), cur: AF.Storage.getCurrentLevel() };
    });
    check('mid-campaign save: level 23 resumes with 2 arrows cleared and 2 lives, unlock state kept', m.cleared === 2 && m.lives === 2 && m.h === 23 && m.cur === 23, m);
    await mid.ctx.close();
  }

  // 4. Load cost on a throttled phone-like CPU.
  {
    const { ctx, page } = await open(null);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(base, { waitUntil: 'load' });
    const perf = await page.evaluate(() => {
      const res = performance.getEntriesByType('resource').filter((e) => /data\/.*\.js$/.test(e.name)).map((e) => ({ f: e.name.split('/').pop(), kb: Math.round(e.transferSize / 1024) || Math.round(e.decodedBodySize / 1024), ms: Math.round(e.duration) }));
      const nav = performance.getEntriesByType('navigation')[0];
      const t0 = performance.now(); const p = AF.Levels.get(1000).puzzle; const t1 = performance.now();
      const t2 = performance.now(); AF.Game.loadLevel(1000); const t3 = performance.now();
      return { res, domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), loadMs: Math.round(nav.loadEventEnd), decodeLevel1000Ms: +(t1 - t0).toFixed(2), loadLevel1000Ms: +(t3 - t2).toFixed(1), arrows: p.arrows.length };
    });
    check('load cost with 4x CPU throttle (informational)', perf.loadMs < 3000, perf);
    await ctx.close();
  }

  // 5. Screens and screenshots.
  {
    const save = JSON.stringify({ highestUnlocked: 51, allCleared: false, currentLevel: 51, levelProgress: null, settings: { sound: false, vibration: false, reduceMotion: true } });
    const { ctx, page, errors } = await open(save);
    await page.screenshot({ path: path.join(out, '01-home.png') });
    const lvlShown = async (id, name) => {
      await page.evaluate((i) => { document.documentElement.dataset.motion = 'reduced'; AF.Game.loadLevel(i); AF.UI.renderGame(AF.Game.getState()); AF.UI.show('game', 'fade'); }, id);
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, name) });
    };
    await lvlShown(1, '02-level-1.png'); await lvlShown(36, '03-level-36.png'); await lvlShown(51, '04-level-51.png');
    await page.evaluate(() => { AF.UI.renderLevels(); AF.UI.show('levels', 'fade'); });
    await page.waitForTimeout(700);
    // The campaign screen is tabbed (js/skin.js): one tab of 10 levels at a time, tab containing the current level preselected.
    const tiles = await page.evaluate(() => ({ buttons: document.querySelectorAll('#levels-list .lv').length, tabs: document.querySelectorAll('#levels-tabs .m-tab').length, onTab: (document.querySelector('#levels-tabs .m-tab.on') || {}).textContent, current: (document.querySelector('#levels-list .lv--cur b') || {}).textContent }));
    check('levels screen: light DOM (10 tiles), 100 tabs, current level 51 highlighted on tab 51-60', tiles.buttons === 10 && tiles.tabs === 100 && tiles.onTab === '51-60' && tiles.current === '51', tiles);
    await page.screenshot({ path: path.join(out, '05-levels.png') });
    await page.evaluate(() => { AF.UI.renderDaily({ y: new Date().getFullYear(), m: new Date().getMonth() }); AF.UI.show('daily', 'fade'); });
    await page.waitForTimeout(500); await page.screenshot({ path: path.join(out, '06-daily.png') });
    // a real finger tap on the real board: tap a blocked arrow, then a free one, through the DOM
    await page.evaluate(() => { document.documentElement.dataset.motion = 'reduced'; AF.Game.loadLevel(300); AF.UI.renderGame(AF.Game.getState()); AF.UI.show('game', 'fade'); });
    await page.waitForTimeout(600);
    const ids = await page.evaluate(() => { const p = AF.Game.getPuzzle(); return { free: p.arrows.find((a) => AF.Game.canArrowExit(a.id)).id, blocked: p.arrows.find((a) => !AF.Game.canArrowExit(a.id)).id }; });
    // Real touch taps at a point on each arrow's own path (the middle of a bent arrow's bounding box is often empty board).
    const pointOn = (id) => page.evaluate((i) => { const el = document.querySelector('#board .arrow[data-id="' + i + '"] .arrow__hit'); const m = el.getPointAtLength(el.getTotalLength() / 2), t = el.getScreenCTM(); return { x: t.a * m.x + t.c * m.y + t.e, y: t.b * m.x + t.d * m.y + t.f }; }, id);
    let pt = await pointOn(ids.blocked); await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(150);
    let st = await page.evaluate(() => AF.Game.getState());
    const lifeLost = st.lives === 2;
    pt = await pointOn(ids.free); await page.touchscreen.tap(pt.x, pt.y);
    await page.waitForTimeout(150);
    st = await page.evaluate(() => AF.Game.getState());
    check('real DOM taps on level 300: blocked tap costs a life, free tap clears an arrow', lifeLost && st.cleared === 1, { lives: st.lives, cleared: st.cleared });
    await page.screenshot({ path: path.join(out, '07-level-300-after-taps.png') });
    await lvlShown(1000, '08-level-1000.png');
    check('no page errors on any screen', errors.length === 0, errors.slice(0, 3));
    await ctx.close();
  }
  await browser.close(); server.close();
  const failed = Object.keys(results).filter((k) => !results[k].ok);
  fs.writeFileSync(path.join(__dirname, 'out/e2e-report.json'), JSON.stringify(results, null, 1));
  console.log(failed.length ? 'E2E FAILED: ' + failed.length : 'E2E PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
