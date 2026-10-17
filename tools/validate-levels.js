#!/usr/bin/env node
/* Independent verification of the saved packs. It trusts nothing from the builder: it reads data/*.json, decodes every level and
   checks it with the game's OWN rules (js/rules.js), then looks at duplicates, difficulty mix and variety.
     node tools/validate-levels.js        exit code 0 only if every check passes */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const Rules = require(path.join(root, 'js/rules.js'));
const { analyze, canonicalKey, signatures, transforms } = require('./lib/analyze.js');
const { extra, gate } = require('./lib/quality.js');
const { decodeArrow, idFor } = require('./lib/codec.js');

const problems = [];
const bad = (m) => { problems.push(m); if (problems.length < 40) console.error('FAIL', m); };
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const lv = JSON.parse(read('data/levels.v1.json')), dl = JSON.parse(read('data/daily.v1.json'));

// 1. Files are intact and the JS wrappers carry exactly the same data.
[['campaign', lv, 'data/levels.v1.js', 'LEVEL_DATA'], ['daily', dl, 'data/daily.v1.js', 'DAILY_DATA']].forEach(([name, data, file, prop]) => {
  const h = crypto.createHash('sha256').update(JSON.stringify(data.levels)).digest('hex');
  if (h !== data.sha256) bad(name + ': sha256 mismatch');
  const box = { window: {} }; vm.runInNewContext(read(file), box);
  if (JSON.stringify(box.window.AF[prop]) !== JSON.stringify(data)) bad(name + ': ' + file + ' differs from its JSON');
});
if (lv.count !== 1000 || lv.levels.length !== 1000) bad('campaign must hold exactly 1000 levels');
lv.levels.forEach((l, i) => { if (!l || l.id !== i + 1) bad('level order/id broken at index ' + i); });

const decode = (rec) => ({ cols: rec.c, rows: rec.r, arrows: rec.a.map((s, i) => decodeArrow(s, idFor(i))) });

// 2. Levels 1-5 are byte-for-byte the original puzzles (dates before the Daily cutover are built from them).
const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-levels-1-50.json'), 'utf8'));
legacy.slice(0, 5).forEach((o, i) => {
  const p = decode(lv.levels[i]);
  const same = p.cols === o.cols && p.rows === o.rows && JSON.stringify(p.arrows) === JSON.stringify(o.arrows);
  if (!same) bad('level ' + (i + 1) + ' differs from the original');
  if ((lv.levels[i].n || undefined) !== (o.name && i < 35 ? o.name : undefined) && lv.levels[i].n !== o.name) bad('level ' + (i + 1) + ' name changed');
});

// 3. Every level, with the game's real rules.
function checkPack(name, recs) {
  const out = [];
  recs.forEach((rec, i) => {
    const tag = name + ' ' + (rec.id || i);
    const p = decode(rec);
    const errs = Rules.validatePuzzle(p);
    if (errs.length) { bad(tag + ': ' + errs[0]); return; }
    if (p.cols > 25 || p.rows > 25) bad(tag + ': board larger than 25');
    if (name === 'campaign' && rec.id > 5 && (p.cols < 6 || p.rows < 6)) bad(tag + ': board smaller than 6x6');
    const s = Rules.solve(p);
    if (!s.solvable) { bad(tag + ': NOT solvable, stuck ' + s.stuck.join(',')); return; }
    const v = Rules.verifySequence(p, s.order);
    if (!v.ok || !v.cleared) { bad(tag + ': solving order does not clear the board'); return; }
    const a = analyze(p);
    if (!a.solvable || a.metrics.depth !== s.rounds) bad(tag + ': analyzer rounds ' + (a.metrics && a.metrics.depth) + ' != rules rounds ' + s.rounds);
    if (a.metrics.tier !== rec.t) bad(tag + ': stored tier ' + rec.t + ' != recomputed ' + a.metrics.tier);
    if (rec.id > 5 || name !== 'campaign') { // generated levels must not be trivial; 15..300 arrows (10/12 only on boards under 49/64 cells)
      const area = p.cols * p.rows, minN = name !== 'campaign' ? 8 : area < 49 ? 10 : area < 64 ? 12 : 15;
      if (a.metrics.n < minN || a.metrics.n > 300 || a.metrics.depth < 3) bad(tag + ': arrow count/depth out of range (n=' + a.metrics.n + ', depth=' + a.metrics.depth + ')');
    }
    out.push({ rec: rec, p: p, m: a.metrics });
  });
  return out;
}
const C = checkPack('campaign', lv.levels), Dl = checkPack('daily', dl.levels);

// 4. Duplicates: exact under shift/rotate/mirror, and near-duplicates sharing >= 50% of arrows under any symmetry.
const all = C.map((x) => ({ x: x, label: 'level ' + x.rec.id })).concat(Dl.map((x, i) => ({ x: x, label: 'daily ' + i })));
const seen = new Map(), idx = new Map();
let dupExact = 0, dupNear = 0;
all.forEach((e, li) => {
  const k = canonicalKey(e.x.p);
  if (seen.has(k)) { dupExact++; bad(e.label + ' is identical (up to shift/rotation/mirror) to ' + seen.get(k)); } else seen.set(k, e.label);
  e.x.p.arrows.forEach((a) => {
    const key = e.x.p.cols + ',' + e.x.p.rows + '|' + signatures({ arrows: [a] }, transforms(e.x.p.cols, e.x.p.rows)[0])[0];
    if (!idx.has(key)) idx.set(key, new Set()); idx.get(key).add(li);
  });
});
let maxOverlap = 0;
all.forEach((e, li) => {
  const n = e.x.p.arrows.length;
  transforms(e.x.p.cols, e.x.p.rows).forEach((t) => {
    const cnt = new Map();
    signatures(e.x.p, t).forEach((s) => { const set = idx.get(t.c + ',' + t.r + '|' + s); if (set) set.forEach((o) => { if (o !== li) cnt.set(o, (cnt.get(o) || 0) + 1); }); });
    cnt.forEach((c, o) => {
      const m = Math.min(n, all[o].x.p.arrows.length), f = c / m;
      if (m >= 6 && f > maxOverlap) maxOverlap = f;
      if (o > li && m >= 6 && f >= 0.5) {
        // The original hand-made/seeded levels 1-50 are fixed by the brief; report them but do not count as a build failure.
        const legacyPair = e.label.startsWith('level ') && all[o].label.startsWith('level ') && +e.label.slice(6) <= 5 && +all[o].label.slice(6) <= 5;
        dupNear++; if (!legacyPair) bad(e.label + ' shares ' + Math.round(f * 100) + '% of its arrows with ' + all[o].label);
      }
    });
  });
});

// 5. Difficulty mix and variety.
const tiers = C.map((x) => x.rec.t), count = (arr) => arr.reduce((a, t) => (a[t] = (a[t] || 0) + 1, a), {});
function runs(arr, same) { let best = 1, cur = 1; for (let i = 1; i < arr.length; i++) { cur = same(arr[i], arr[i - 1]) ? cur + 1 : 1; best = Math.max(best, cur); } return best; }
const gen = C.slice(5);
const low = (t) => t === 'easy' || t === 'medium';
const maxSameTier = runs(tiers.slice(5), (a, b) => a === b), maxLow = runs(tiers.slice(5), (a, b) => low(a) && low(b)), maxHigh = runs(tiers.slice(5), (a, b) => !low(a) && !low(b));
if (maxSameTier > 3) bad('same tier appears ' + maxSameTier + ' times in a row among levels 6-1000');
if (maxLow > 5) bad('easy/medium block of ' + maxLow + ' among levels 6-1000');
if (maxHigh > 4) bad('hard/expert block of ' + maxHigh + ' among levels 6-1000');
let archRepeat = 0, sameSize = 0;
for (let i = 6; i < 1000; i++) {
  const a = C[i], b = C[i - 1];
  if (a.rec.k === b.rec.k) archRepeat++;
  if (a.p.cols === b.p.cols && a.p.rows === b.p.rows && Math.abs(a.m.n - b.m.n) < 4) sameSize++;
}
if (archRepeat) bad(archRepeat + ' consecutive generated levels share the same pattern family');
if (sameSize) bad(sameSize + ' consecutive generated levels share board size and similar arrow count');
// no fixed repeating difficulty sequence: look for any period p <= 60 where tiers repeat for most of 51-1000
let bestPeriod = { p: 0, match: 0 };
for (let p = 2; p <= 60; p++) { let m = 0; for (let i = 5 + p; i < 1000; i++) if (tiers[i] === tiers[i - p]) m++; const f = m / (995 - p); if (f > bestPeriod.match) bestPeriod = { p: p, match: f }; }
if (bestPeriod.match > 0.6) bad('difficulty sequence looks periodic (period ' + bestPeriod.p + ')');
const band = (a, b) => count(tiers.slice(a - 1, b));
const bands = {}; for (let s = 1; s <= 1000; s += 100) bands[s + '-' + (s + 99)] = band(s, s + 99);
const sizes = count(C.map((x) => x.p.cols + 'x' + x.p.rows));
const avg = (arr, f) => arr.reduce((a, x) => a + f(x), 0) / arr.length;
const byTier = {}; ['easy', 'medium', 'hard', 'expert'].forEach((t) => { const g = C.filter((x) => x.rec.t === t); byTier[t] = g.length ? { levels: g.length, avgArrows: +avg(g, (x) => x.m.n).toFixed(1), avgDepth: +avg(g, (x) => x.m.depth).toFixed(1), avgScore: +avg(g, (x) => x.m.score).toFixed(1), minScore: +Math.min.apply(null, g.map((x) => x.m.score)).toFixed(1), maxScore: +Math.max.apply(null, g.map((x) => x.m.score)).toFixed(1) } : null; });

// 5b. Level-design standards for generated campaign levels (51+): packed, varied shapes, interlocking, readable colours.
const design = { levels: 0, coverage: 0, straightFrac: 0, multiFrac: 0, free0Frac: 0, avgDeps: 0, maxPocket: 0, toneClashLevels: 0 };
const designAll = (list) => list.reduce((o, x) => { const e = extra(x.p); o.levels++; o.coverage += e.coverage; o.straightFrac += e.straightFrac; o.multiFrac += e.multiFrac; o.free0Frac += x.m.free0Frac; o.avgDeps += x.m.avgDeps; o.maxPocket = Math.max(o.maxPocket, e.pocket); if (e.toneClash) o.toneClashLevels++; return o; }, { levels: 0, coverage: 0, straightFrac: 0, multiFrac: 0, free0Frac: 0, avgDeps: 0, maxPocket: 0, toneClashLevels: 0 });
const avgOf = (o) => ({ levels: o.levels, coverage: +(o.coverage / o.levels).toFixed(3), emptyPct: +(100 * (1 - o.coverage / o.levels)).toFixed(1), straightArrowPct: +(100 * o.straightFrac / o.levels).toFixed(1), multiSegmentArrowPct: +(100 * o.multiFrac / o.levels).toFixed(1), freeAtStartPct: +(100 * o.free0Frac / o.levels).toFixed(1), avgBlockersPerArrow: +(o.avgDeps / o.levels).toFixed(2), largestEmptyPocket: o.maxPocket, levelsWithTouchingSameColour: o.toneClashLevels });
C.slice(5).forEach((x) => { const g = gate(x.rec.t, x.m, extra(x.p)); if (g) bad('campaign ' + x.rec.id + ': design standard failed (' + g + ')'); });
const designReport = { levels1to5_unchanged: avgOf(designAll(C.slice(0, 5))), levels6to1000: avgOf(designAll(C.slice(5))) };

// 6. Daily pool: weekday tiers follow the same rule js/daily.js uses.
const startDow = new Date(Date.UTC(2026, 9, 10)).getUTCDay();
Dl.forEach((x, i) => { const want = dl.tierByWeekday[(startDow + i) % 7]; if (x.rec.t !== want) bad('daily slot ' + i + ' is ' + x.rec.t + ', expected ' + want); });

const nAll = C.map((x) => x.m.n), cov = C.slice(5).map((x) => extra(x.p).coverage);
const sizeStats = { minBoard: Math.min.apply(null, C.slice(5).map((x) => Math.min(x.p.cols, x.p.rows))), maxBoard: Math.max.apply(null, C.map((x) => Math.max(x.p.cols, x.p.rows))),
  minArrows6to1000: Math.min.apply(null, nAll.slice(5)), maxArrows: Math.max.apply(null, nAll), levelsUnder15Arrows6to1000: nAll.slice(5).filter((n) => n < 15).length,
  minCoverage6to1000: +Math.min.apply(null, cov).toFixed(3), levelsBelow85PctCoverage: cov.filter((c) => c < 0.85).length };
const report = {
  arrowsAndBoards: sizeStats,
  campaign: { levels: C.length, validated: C.length - problems.filter((p) => p.startsWith('campaign')).length, tierCounts: count(tiers), tierCountsGenerated6to1000: count(tiers.slice(5)), tiers100: bands, byTier: byTier, boardSizes: sizes,
    longestRun: { sameTier: maxSameTier, easyMediumOnly: maxLow, hardExpertOnly: maxHigh }, consecutivePatternRepeats: archRepeat, consecutiveSameSizeAndCount: sameSize, bestPeriodMatch: bestPeriod,
    patternFamilies: count(gen.map((x) => x.rec.k)) },
  daily: { puzzles: Dl.length, tierCounts: count(Dl.map((x) => x.rec.t)) },
  design: designReport,
  duplicates: { exact: dupExact, nearDuplicatePairsIncludingFixedLegacy: dupNear, maxArrowOverlap: +maxOverlap.toFixed(2) },
  problems: problems.length
};
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out/validation-report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
console.log(problems.length ? 'VALIDATION FAILED: ' + problems.length + ' problem(s)' : 'VALIDATION PASSED');
process.exit(problems.length ? 1 : 0);
