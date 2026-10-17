#!/usr/bin/env node
/* Browser test of AF.handleBack() (what the Android back button calls). Needs Playwright + Chromium.  node tools/test-back.js */
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
const check = (n, ok, i) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
(async () => {
  await new Promise((r) => server.listen(0, r));
  const browser = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((o) => { try { localStorage.setItem('arrowflow.onboarding.v1', o); } catch (e) {} }, ONB);
  await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.AF && AF.UI && AF.UI.currentName() === 'home', null, { timeout: 8000 });
  const back = () => page.evaluate(() => ({ handled: AF.handleBack(), screen: AF.UI.currentName() }));
  let r = await back();
  check('home: back is NOT handled (app may exit)', r.handled === false && r.screen === 'home', r);
  await page.evaluate(() => { document.documentElement.dataset.motion = 'reduced'; const s = AF.Game.loadLevel(7); AF.Extra.begin(); AF.UI.renderGame(s); AF.UI.show('game', 'fade'); });
  r = await back();
  check('game: back opens the pause sheet (handled)', r.handled === true && r.screen === 'game' && await page.evaluate(() => document.getElementById('sheet-pause').classList.contains('is-open')), r);
  r = await back();
  check('pause sheet: back closes it (handled), still in game', r.handled === true && r.screen === 'game' && !(await page.evaluate(() => document.getElementById('sheet-pause').classList.contains('is-open'))), r);
  await page.evaluate(() => { AF.UI.renderLevels(); AF.UI.show('levels', 'fade'); });
  r = await back();
  check('levels: back goes to home (handled)', r.handled === true && r.screen === 'home', r);
  r = await back();
  check('home again: not handled', r.handled === false, r);
  check('no page errors', errors.length === 0, errors);
  await browser.close(); server.close();
  console.log(failed ? 'BACK TEST FAILED: ' + failed : 'BACK TEST PASSED');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
