/* Fast, exact analysis of a puzzle under the game's rules (see js/rules.js).
   An arrow is free once every arrow that occupies a cell of its exit line has left, so a puzzle's whole solving
   structure is a dependency graph: deps[i] = arrows that sit in arrow i's exit line.
   Rounds are exactly rules.solve()'s rounds (all currently free arrows leave together). The validator re-checks every
   final level with the game's own rules.js and requires these numbers to agree. */
'use strict';
const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function analyze(p) {
  const cols = p.cols, rows = p.rows, n = p.arrows.length;
  const owner = new Int16Array(cols * rows).fill(-1);
  p.arrows.forEach((a, i) => a.cells.forEach((c) => { owner[c[1] * cols + c[0]] = i; }));
  const deps = [], lineLen = new Int16Array(n), nearest = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const a = p.arrows[i], d = D[a.dir], h = a.cells[a.cells.length - 1];
    const set = new Set();
    let x = h[0] + d[0], y = h[1] + d[1], k = 1, first = 0;
    while (x >= 0 && y >= 0 && x < cols && y < rows) {
      const o = owner[y * cols + x];
      if (o >= 0 && o !== i) { set.add(o); if (!first) first = k; }
      x += d[0]; y += d[1]; k++;
    }
    deps.push(set); lineLen[i] = k - 1; nearest[i] = first;
  }
  // rounds
  const round = new Int16Array(n);
  let left = n, r = 0;
  const widths = [];
  while (left > 0) {
    r++;
    const free = [];
    for (let i = 0; i < n; i++) {
      if (round[i]) continue;
      let ok = true;
      for (const j of deps[i]) if (!round[j] || round[j] >= r) { ok = false; break; }
      if (ok) free.push(i);
    }
    if (!free.length) return { solvable: false, stuck: n - (n - left), n: n };
    free.forEach((i) => { round[i] = r; });
    widths.push(free.length); left -= free.length;
  }
  // Search effort: while playing, each move means finding a free arrow among r arrows left. With f of them free,
  // that costs about r/f looks. Averaged over a few fixed pseudo-random solving orders (a player may pick any free arrow).
  let rho = 0;
  const RUNS = 4;
  for (let run = 0; run < RUNS; run++) {
    let seed = 0x9E3779B1 ^ (n * 7919 + run * 104729);
    const rnd = () => { seed = (Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6D2B79F5) | 0; return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296; };
    const need = deps.map((s) => s.size), users = deps.map(() => []);
    deps.forEach((s, i) => s.forEach((j) => users[j].push(i)));
    const free = []; for (let i = 0; i < n; i++) if (!need[i]) free.push(i);
    let rem = n, acc = 0;
    while (rem > 0) {
      acc += rem / free.length;
      const k = Math.floor(rnd() * free.length), i = free[k];
      free[k] = free[free.length - 1]; free.pop(); rem--;
      users[i].forEach((u) => { if (--need[u] === 0) free.push(u); });
    }
    rho += acc / n;
  }
  rho /= RUNS;
  // metrics
  let cells = 0, bends = 0, depSum = 0, far = 0, blocked = 0, lineSum = 0, dirN = { up: 0, down: 0, left: 0, right: 0 };
  p.arrows.forEach((a, i) => {
    cells += a.cells.length; dirN[a.dir]++;
    for (let k = 2; k < a.cells.length; k++) {
      const ax = a.cells[k - 1][0] - a.cells[k - 2][0], ay = a.cells[k - 1][1] - a.cells[k - 2][1];
      const bx = a.cells[k][0] - a.cells[k - 1][0], by = a.cells[k][1] - a.cells[k - 1][1];
      if (ax !== bx || ay !== by) bends++;
    }
    depSum += deps[i].size; lineSum += lineLen[i];
    if (deps[i].size) { blocked++; if (nearest[i] >= 3) far++; }
  });
  const area = cols * rows, depth = widths.length, free0 = widths[0];
  const counts = Object.values(dirN), maxShare = Math.max.apply(null, counts) / n;
  const usedDirs = counts.filter((c) => c > 0).length;
  // largest empty square (so boards never have a big dead hole)
  let best = 0; const dp = new Int16Array((cols + 1) * (rows + 1));
  for (let y = 1; y <= rows; y++) for (let x = 1; x <= cols; x++) {
    if (owner[(y - 1) * cols + (x - 1)] >= 0) { dp[y * (cols + 1) + x] = 0; continue; }
    const v = 1 + Math.min(dp[(y - 1) * (cols + 1) + x], dp[y * (cols + 1) + x - 1], dp[(y - 1) * (cols + 1) + x - 1]);
    dp[y * (cols + 1) + x] = v; if (v > best) best = v;
  }
  const m = {
    n: n, area: area, density: cells / area, avgLen: cells / n, avgBends: bends / n, depth: depth, rho: rho,
    free0: free0, free0Frac: free0 / n, widths: widths, avgDeps: depSum / n, avgLine: lineSum / n,
    farFrac: far / n, blockedFrac: blocked / n, maxDirShare: maxShare, usedDirs: usedDirs, emptySquare: best, dirN: dirN
  };
  m.score = score(m);
  m.tier = tierOf(m.score);
  return { solvable: true, round: Array.from(round), deps: deps, metrics: m };
}

/* Difficulty score 0-100. Every term is something a player actually feels: more arrows (n), how scarce free arrows are
   while solving (rho = average looks per move), dependency depth, blockers far down a line (arrows that look free but
   are not), winding bodies, arrows with several blockers, and a crowded board. */
function score(m) {
  // Boards above 10x10 are judged per 100 cells (sc = 1 up to 10x10, so every older level keeps its score).
  const sc = Math.sqrt(Math.max(100, m.area) / 100);
  const a = clamp01((m.n / (sc * sc) - 6) / 30);
  const r = clamp01((m.rho / sc - 1.3) / 3.7);
  const b = clamp01((m.depth / sc - 3) / 10);
  const d = clamp01(m.farFrac / 0.30);
  const e = clamp01(m.avgBends / 1.2);
  const f = clamp01((m.avgDeps - 0.8) / 1.7);
  const g = clamp01((m.density - 0.25) / 0.40);
  let s = 100 * (0.26 * a + 0.24 * r + 0.10 * b + 0.12 * d + 0.08 * e + 0.08 * f + 0.12 * g);
  // Packed boards above 10x10 all score high, so no tier but the top one was reachable (the cause of the slow builds: ~95% of
  // candidates missed their tier band). From 11x11 up a level is rated against boards of its own size: 46 = typical for that size.
  if (m.area > 100) { const center = Math.min(67, 46 + 3.7 * (Math.sqrt(m.area) - 7)); s = Math.max(0, Math.min(100, 46 + 2 * (s - center))); }
  return s;
}
const TIERS = { easy: [0, 30], medium: [30, 46], hard: [46, 62], expert: [62, 101] };
function tierOf(s) { return s < TIERS.easy[1] ? 'easy' : s < TIERS.medium[1] ? 'medium' : s < TIERS.hard[1] ? 'hard' : 'expert'; }

/* ---- Canonical forms (duplicate detection) ---- */
// 8 board symmetries. Each maps a cell and swaps dimensions for the 4 transposing ones.
function transforms(cols, rows) {
  return [
    { c: cols, r: rows, f: (x, y) => [x, y] },
    { c: cols, r: rows, f: (x, y) => [cols - 1 - x, y] },
    { c: cols, r: rows, f: (x, y) => [x, rows - 1 - y] },
    { c: cols, r: rows, f: (x, y) => [cols - 1 - x, rows - 1 - y] },
    { c: rows, r: cols, f: (x, y) => [y, x] },
    { c: rows, r: cols, f: (x, y) => [rows - 1 - y, x] },
    { c: rows, r: cols, f: (x, y) => [y, cols - 1 - x] },
    { c: rows, r: cols, f: (x, y) => [rows - 1 - y, cols - 1 - x] }
  ];
}
const LET = { up: 'u', down: 'd', left: 'l', right: 'r' };
function arrowKeyCells(cells) {
  let s = '' + cells[0][0] + ',' + cells[0][1] + ':';
  for (let i = 1; i < cells.length; i++) {
    const dx = cells[i][0] - cells[i - 1][0], dy = cells[i][1] - cells[i - 1][1];
    s += dx === 1 ? 'r' : dx === -1 ? 'l' : dy === 1 ? 'd' : 'u';
  }
  return s;
}
// Arrow-signature list of the puzzle under transform t (positions kept).
function signatures(p, t) {
  return p.arrows.map((a) => arrowKeyCells(a.cells.map((c) => t.f(c[0], c[1])))).sort();
}
// Canonical key: smallest over the 8 symmetries, with the arrow group translated to its bounding-box corner,
// so shifted, rotated and mirrored copies of one layout share the same key.
function canonicalKey(p) {
  let best = null;
  transforms(p.cols, p.rows).forEach((t) => {
    const pts = p.arrows.map((a) => a.cells.map((c) => t.f(c[0], c[1])));
    let mx = 99, my = 99;
    pts.forEach((cs) => cs.forEach((c) => { if (c[0] < mx) mx = c[0]; if (c[1] < my) my = c[1]; }));
    const s = pts.map((cs) => arrowKeyCells(cs.map((c) => [c[0] - mx, c[1] - my]))).sort().join('|');
    if (best === null || s < best) best = s;
  });
  return best;
}
module.exports = { analyze, score, tierOf, TIERS, transforms, signatures, canonicalKey, D };
