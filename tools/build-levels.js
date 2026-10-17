#!/usr/bin/env node
/* Builds the permanent level packs. Run once; the output is committed and shipped, never regenerated at play time.
     node tools/build-levels.js          -> data/levels.v1.json, data/daily.v1.json, their .js wrappers, tools/out/build-report.json
   Levels 1-5 are copied unchanged from the original game (tools/fixtures/legacy-levels-1-50.json). Levels 6-1000 and the
   daily pool are generated with fixed seeds, analysed (tools/lib/analyze.js) and accepted only if they pass every filter below.
   tools/validate-levels.js then re-checks the saved files independently with the game's own js/rules.js. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const { analyze, transforms, signatures, canonicalKey, TIERS } = require('./lib/analyze.js');
const { generate, rngOf } = require('./lib/gen.js');
const { planTiers, paramsForV2, sizeFor } = require('./lib/plan.js');
const { densify } = require('./lib/densify.js');
const { extra, gate, retone } = require('./lib/quality.js');
const { encodeArrow, idFor } = require('./lib/codec.js');

const ONLY = process.env.ONLY_LEVELS ? process.env.ONLY_LEVELS.split(',').map(Number) : null;   // sample mode: build just these levels, write nothing to data/
const TOTAL = 1000, LEGACY = 5, DAILY_POOL = 392;   // levels 1-5 stay as they are: dates before the Daily cutover still use them as templates
const DAILY_TIER_BY_WEEKDAY = ['expert', 'easy', 'medium', 'medium', 'hard', 'medium', 'hard'];   // 0 = Sunday ... 6 = Saturday
const DAILY_CUTOVER = '2026-10-10';
const NAMES_LEGACY = ['First Steps', 'Crossing Paths', 'Little Knots', 'Tangle', 'Wide Water'];
const MIN = { easy: { depth: 3 }, medium: { depth: 4 }, hard: { depth: 5 }, expert: { depth: 7 } };
// At least 15 arrows wherever the board can hold them; a 6x6 (36 cells) or 7x6 board cannot, so it needs 10 / 12.
const minArrows = (area) => (area < 49 ? 10 : area < 64 ? 12 : 15);

const frozenDaily = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/daily-pack-v1.json'), 'utf8'));   // Daily Challenge pool: not part of this redesign, kept byte-identical
const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-levels-1-50.json'), 'utf8'));
if (legacy.length < LEGACY) throw new Error('legacy fixture must hold the original levels');

/* ---- Duplicate index: exact (any shift/rotation/mirror) and near-duplicate (shared arrows under any symmetry) ---- */
const canon = new Map();            // canonical key -> label
const sigIndex = new Map();         // "cols,rows|sig" -> Set(label index)
const labels = [];
function register(p, label) {
  const li = labels.push(label) - 1;
  canon.set(canonicalKey(p), label);
  p.arrows.forEach((a) => {
    const k = p.cols + ',' + p.rows + '|' + signatures({ arrows: [a] }, transforms(p.cols, p.rows)[0])[0];
    if (!sigIndex.has(k)) sigIndex.set(k, new Set());
    sigIndex.get(k).add(li);
  });
  p._li = li; p._n = p.arrows.length;
}
const sizeOf = [];
function duplicateOf(p) {
  const ck = canonicalKey(p);
  if (canon.has(ck)) return 'identical to ' + canon.get(ck);
  const n = p.arrows.length;
  for (const t of transforms(p.cols, p.rows)) {
    const cnt = new Map();
    signatures(p, t).forEach((s) => {
      const set = sigIndex.get(t.c + ',' + t.r + '|' + s);
      if (set) set.forEach((li) => cnt.set(li, (cnt.get(li) || 0) + 1));
    });
    for (const [li, c] of cnt) { const m = Math.min(n, sizeOf[li]); if (m >= 6 && c / m >= 0.5) return 'near-duplicate of ' + labels[li]; }
  }
  return null;
}
function registerP(p, label) { register(p, label); sizeOf[p._li] = p.arrows.length; }

function quality(m, tier, L) {
  if (m.n < minArrows(m.area) || m.n > 300 || m.depth < MIN[tier].depth) return 'too small/shallow';
  if (m.depth > 0.75 * m.n) return 'single chain';
  if (m.free0Frac > (tier === 'easy' ? 0.65 : 0.55)) return 'too many free arrows';
  if (m.usedDirs < 3 || m.maxDirShare > 0.6) return 'direction mix';
  if (m.emptySquare > (Math.max(m.area) >= 81 ? 3 : 4)) return 'empty hole';
  const lo = tier === 'easy' ? 8 + 0.014 * L : TIERS[tier][0];
  if (m.score < lo || m.score >= TIERS[tier][1]) return 'score outside tier band';
  return null;
}

function toRecord(id, p, m, extra) {
  return Object.assign({ id: id, c: p.cols, r: p.rows, t: m.tier, a: p.arrows.map(encodeArrow) }, extra || {});
}

/* ---- Search for one level -------------------------------------------------------------------------------------- */
function makeLevel(L, tier, prev, salt, stats, floorL) {
  const maxAttempts = 4000;
  for (let at = 0; at < maxAttempts; at++) {
    const rnd = rngOf(salt + L * 1000003 + at * 31 + 7);
    // Variety: avoid the pattern of the previous two levels; relax only if the search is struggling.
    const size = sizeFor(at < 3000 ? L : LEGACY + 1 + Math.floor((L - LEGACY - 1) / 2), tier, rnd, LEGACY + 1, TOTAL);   // last resort only: a smaller board for this tier   // 6x6 .. 25x25, growing over the campaign
    const cfg = paramsForV2(tier, rnd, at < 3800 ? prev.archs : [], size);
    let p = generate(cfg, salt + L * 7919 + at * 104729 + 17);
    stats.attempts++;
    if (p.arrows.length < 4) continue;
    p = densify(p, rngOf(salt + L * 15485863 + at * 49979687 + 3), cfg.dens);
    p = retone(p, rngOf(salt + L * 32452843 + at * 67867979 + 11));
    const a = analyze(p);
    if (!a.solvable) { stats.rejected.unsolvable++; continue; }
    let q = quality(a.metrics, tier, floorL === undefined ? L : floorL);
    if (!q) q = gate(tier, a.metrics, extra(p));
    if (q) { stats.rejected[q] = (stats.rejected[q] || 0) + 1; continue; }
    if (at < 2500 && prev.size && prev.size.c === p.cols && prev.size.r === p.rows && Math.abs(prev.size.n - p.arrows.length) < 4) { stats.rejected['same size as previous'] = (stats.rejected['same size as previous'] || 0) + 1; continue; }
    const dup = duplicateOf(p);
    if (dup) { stats.rejected['duplicate'] = (stats.rejected['duplicate'] || 0) + 1; continue; }
    return { p: p, a: a, cfg: cfg, attempt: at };
  }
  return null;
}

function main() {
  const report = { generatedWith: 'tools/build-levels.js', levelsBuilt: 0, dailyBuilt: 0, failures: [], rejected: { unsolvable: 0 }, attempts: 0 };
  const stats = { attempts: 0, rejected: { unsolvable: 0 } };
  const levels = [];
  // 1-5: unchanged.
  legacy.slice(0, LEGACY).forEach((p, i) => {
    const m = analyze(p).metrics;
    levels.push(toRecord(i + 1, p, m, Object.assign(i < NAMES_LEGACY.length || p.name ? { n: p.name } : {}, { k: i < 35 ? 'hand' : 'seeded' })));
    registerP(p, 'level ' + (i + 1));
  });
  const decodeRec = (rec) => ({ cols: rec.c, rows: rec.r, arrows: rec.a.map((x, i) => require('./lib/codec.js').decodeArrow(x, idFor(i))) });
  frozenDaily.levels.forEach((rec, s) => registerP(decodeRec(rec), 'daily ' + s));   // so no campaign level duplicates a daily puzzle
  const legacyTiers = levels.map((l) => l.t);
  const plan = planTiers(LEGACY + 1, TOTAL, legacyTiers, 20261009);
  let prev = { archs: ['legacy'], size: { c: 5, r: 5, n: levels[LEGACY - 1].a.length } };
  for (let L = LEGACY + 1; L <= TOTAL; L++) {
    const tier = plan[L - LEGACY - 1];
    if (ONLY && ONLY.indexOf(L) < 0) { levels.push(null); continue; }
    const got = makeLevel(L, tier, prev, 0, stats, undefined);
    if (!got) { report.failures.push({ level: L, tier: tier }); levels.push(null); continue; }
    const p = got.p; p.arrows.forEach((a, i) => { a.id = idFor(i); });
    levels.push(toRecord(L, p, got.a.metrics, { k: got.cfg.arch }));
    registerP(p, 'level ' + L);
    prev = { archs: [got.cfg.arch].concat(prev.archs).slice(0, 2), size: { c: p.cols, r: p.rows, n: p.arrows.length } };
    if (L % 100 === 0) process.stderr.write('level ' + L + '\n');
  }
  if (ONLY) {
    const t0 = Date.now();
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'out/sample-levels.json'), JSON.stringify(levels.filter((l, i) => l && i >= LEGACY)));
    console.log('SAMPLE built', levels.filter((l, i) => l && i >= LEGACY).length, 'of', ONLY.length, 'requested; failures', report.failures.length, 'attempts', stats.attempts);
    return;
  }
  const daily = frozenDaily.levels;   // unchanged
  report.attempts = stats.attempts; report.rejected = stats.rejected;
  if (report.failures.length) { console.error('FAILURES', report.failures); }

  const sum = (arr) => crypto.createHash('sha256').update(JSON.stringify(arr)).digest('hex');
  const pack = (name, arr, extraProps) => Object.assign({
    format: 'arrowflow-levels', pack: name, version: 1, count: arr.length, maxBoard: 25,
    encoding: 'Each arrow is a string: tail x and y (one base-36 character each, so up to 25x25) then one letter per step toward the head (u d l r). Arrow ids are a, b, c ... by position. See tools/lib/codec.js.',
    sha256: sum(arr)
  }, extraProps, { levels: arr });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  const lv = pack('campaign', levels, { note: 'Permanent campaign pack. Levels 1-5 are the original levels; 6-1000 were generated once (boards 6x6 to 25x25, packed, bent and interlocking arrows) with fixed seeds and validated. Never regenerated at play time.' });
  const dl = frozenDaily;   // Daily Challenge pool is untouched by the campaign redesign
  fs.writeFileSync(path.join(root, 'data/levels.v1.json'), JSON.stringify(lv));
  fs.writeFileSync(path.join(root, 'data/daily.v1.json'), JSON.stringify(dl));
  fs.writeFileSync(path.join(root, 'data/levels.v1.js'), '/* Generated from data/levels.v1.json by tools/build-levels.js. Do not edit. */\n(window.AF = window.AF || {}).LEVEL_DATA = ' + JSON.stringify(lv) + ';\n');
  fs.writeFileSync(path.join(root, 'data/daily.v1.js'), '/* Generated from data/daily.v1.json by tools/build-levels.js. Do not edit. */\n(window.AF = window.AF || {}).DAILY_DATA = ' + JSON.stringify(dl) + ';\n');
  report.levelsBuilt = levels.filter(Boolean).length; report.dailyBuilt = daily.filter(Boolean).length;   // counts (the packs themselves are data/*.json)
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out/build-report.json'), JSON.stringify(report, null, 1));
  console.log('built', levels.filter(Boolean).length, 'levels,', daily.filter(Boolean).length, 'daily; attempts', stats.attempts, 'failures', report.failures.length);
  console.log('rejection reasons', stats.rejected);
}
main();
