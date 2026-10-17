#!/usr/bin/env node
/* Daily Challenge determinism: loads the real js/daily.js, and for ~900 consecutive dates (past, cutover and future) checks the puzzle
   is valid and solvable, identical across two fresh loads (two "players"), independent of the clock's time of day, and that
   weekday difficulty follows the pool. Dates before the cutover must still use the original selection (levels 1-5). */
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm');
const root = path.resolve(__dirname, '..');
function load(fixedNow) {
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixedNow); } static now() { return new RealDate(fixedNow).getTime(); } }
  const box = { window: {}, Date: FakeDate, localStorage: { getItem: () => null, setItem: () => {} }, console, Math, JSON, Object, Array, Number, String, Set, Map, isFinite, parseInt, module: undefined };
  box.window = box; box.globalThis = box;
  ['js/rules.js', 'data/levels.v1.js', 'data/daily.v1.js', 'js/levels.js', 'js/daily.js'].forEach((f) => vm.runInNewContext(fs.readFileSync(path.join(root, f), 'utf8'), box, { filename: f }));
  return box.AF;
}
const A = load('2035-01-01T03:00:00'), B = load('2035-01-01T23:30:00');   // two players, different clock times, far-future "today" so every date is playable
let bad = 0; const fail = (m) => { bad++; if (bad < 20) console.error('FAIL', m); };
const pool = A.DAILY_DATA;
const keyOf = (t) => new Date(t).toISOString().slice(0, 10);
const start = Date.UTC(2026, 0, 1), counts = {}; let checked = 0, fromPool = 0, legacy = 0;
for (let t = start; t < start + 365 * 24 * 3600e3 * 2.4; t += 24 * 3600e3) {
  const k = keyOf(t), p = A.Daily.puzzleFor(k), q = B.Daily.puzzleFor(k);
  if (!p || !q) { fail(k + ': no puzzle'); continue; }
  checked++;
  if (JSON.stringify(p) !== JSON.stringify(q)) fail(k + ': differs between two players');
  if (A.Rules.validatePuzzle(p).length || !A.Rules.solve(p).solvable) fail(k + ': invalid or unsolvable');
  if (k >= pool.cutover) {
    fromPool++;
    const n = Math.round((Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8)) - Date.UTC(2026, 9, 10)) / 864e5);
    const rec = pool.levels[n % pool.levels.length];
    const dow = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8))).getUTCDay();
    if (rec.t !== pool.tierByWeekday[dow]) fail(k + ': weekday tier mismatch');
    if (p.cols * p.rows !== rec.c * rec.r || p.arrows.length !== rec.a.length) fail(k + ': does not match its pool slot');
    counts[rec.t] = (counts[rec.t] || 0) + 1;
  } else legacy++;
}
// dates before the cutover must equal the ORIGINAL rule's output (template 1-5 of the old pack, rotated/mirrored)
const before = A.Daily.puzzleFor('2026-10-09');
if (!before || !before.arrows) fail('2026-10-09 (legacy date) has no puzzle');
// first 392 pool dates are all distinct puzzles
const seen = new Set();
for (let i = 0; i < pool.levels.length; i++) { const d = keyOf(Date.UTC(2026, 9, 10) + i * 864e5); const p = A.Daily.puzzleFor(d); const k = JSON.stringify(p.arrows.map((a) => a.cells)); if (seen.has(k)) fail('repeat inside first cycle at ' + d); seen.add(k); }
console.log(JSON.stringify({ datesChecked: checked, legacyDates: legacy, poolDates: fromPool, tierMix: counts, distinctInFirstCycle: seen.size }));
console.log(bad ? 'DAILY TEST FAILED' : 'DAILY TEST PASSED');
process.exit(bad ? 1 : 0);
