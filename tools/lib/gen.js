/* Level generator. Arrows are placed in REVERSE solving order (the first one placed leaves last): every new arrow's exit
   line must avoid every arrow already placed, so a full clearing order always exists. Later arrows may land in the lines
   of earlier ones, and that is exactly what creates dependencies. Candidates are built head-first so the head direction
   (and so the whole feel of a pattern) is controlled directly. Everything is seeded: same seed, same level.
   The output is only a CANDIDATE. build-levels.js re-checks it with analyze.js and the game's own rules.js. */
'use strict';
const { D } = require('./analyze.js');
const DN = ['up', 'down', 'left', 'right'];
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

function rngOf(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickW(r, table) { // table: [[value, weight], ...]
  let sum = 0; table.forEach((t) => { sum += t[1]; });
  let x = r() * sum;
  for (const t of table) { x -= t[1]; if (x <= 0) return t[0]; }
  return table[table.length - 1][0];
}

/* ---- Archetypes: how candidates look and what makes one attractive ---------------------------------------------- */
// dirW(x, y, cols, rows, ctx) -> weights for [up, down, left, right]
const cw = { up: 'right', right: 'down', down: 'left', left: 'up' };
function towards(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
function biased(want, p) { const w = {}; DN.forEach((d) => { w[d] = (1 - p) / 3; }); w[want] += p - (1 - p) / 3 + (1 - p) / 3 - (1 - p) / 3; w[want] = p; return w; }

const ARCH = {
  scatter:  { lens: [[2, 4], [3, 4], [4, 2], [5, 1]], turn: 0.35, block: 1.0, dirW: () => ({ up: 1, down: 1, left: 1, right: 1 }), sym: null },
  snakes:   { lens: [[4, 2], [5, 3], [6, 3], [7, 2], [8, 1]], turn: 0.62, block: 0.8, dirW: () => ({ up: 1, down: 1, left: 1, right: 1 }), sym: null },
  lanes:    { lens: [[3, 3], [4, 3], [5, 2], [6, 1], [2, 2]], turn: 0.08, block: 1.0, sym: null,
              dirW: (x, y, c, r, ctx) => ctx.horiz
                ? (y % 2 ? { left: 8, right: 1, up: 1.4, down: 1.4 } : { right: 8, left: 1, up: 1.4, down: 1.4 })
                : (x % 2 ? { up: 8, down: 1, left: 1.4, right: 1.4 } : { down: 8, up: 1, left: 1.4, right: 1.4 }) },
  pinwheel: { lens: [[2, 4], [3, 4], [4, 2]], turn: 0.3, block: 1.0, dirW: () => ({ up: 1, down: 1, left: 1, right: 1 }), sym: 'rot4', square: true },
  mirror:   { lens: [[2, 3], [3, 4], [4, 3], [5, 1]], turn: 0.35, block: 1.0, dirW: () => ({ up: 1, down: 1, left: 1, right: 1 }), sym: 'mirrorX' },
  halfturn: { lens: [[2, 3], [3, 4], [4, 3], [5, 1]], turn: 0.4, block: 1.0, dirW: () => ({ up: 1, down: 1, left: 1, right: 1 }), sym: 'rot2' },
  ring:     { lens: [[2, 3], [3, 4], [4, 3], [5, 1]], turn: 0.2, block: 1.2, sym: null,
              dirW: (x, y, c, r, ctx) => { const dx = x - (c - 1) / 2, dy = y - (r - 1) / 2; const t = ctx.ccw ? { right: 'up', up: 'left', left: 'down', down: 'right' } : cw;
                const rad = towards(dx, dy); return biased(t[rad], 0.7); } },
  radial:   { lens: [[2, 4], [3, 4], [4, 2]], turn: 0.25, block: 1.0, sym: null,
              dirW: (x, y, c, r) => biased(towards(x - (c - 1) / 2, y - (r - 1) / 2), 0.62) },
  inward:   { lens: [[2, 3], [3, 4], [4, 3], [5, 1]], turn: 0.3, block: 1.3, sym: null,
              dirW: (x, y, c, r) => biased(OPP[towards(x - (c - 1) / 2, y - (r - 1) / 2)], 0.62) },
  ladder:   { lens: [[2, 4], [3, 4], [4, 1]], turn: 0.15, block: 3.2, dirW: () => ({ up: 1, down: 1, left: 1, right: 1 }), sym: null },
  braid:    { lens: [[3, 3], [4, 4], [5, 3], [6, 1]], turn: 0.5, block: 2.0, dirW: () => ({ up: 1, down: 1, left: 1, right: 1 }), sym: null }
};

function symImages(sym, cols, rows) {
  const id = (x, y) => [x, y];
  if (sym === 'mirrorX') return [id, (x, y) => [cols - 1 - x, y]];
  if (sym === 'rot2') return [id, (x, y) => [cols - 1 - x, rows - 1 - y]];
  if (sym === 'rot4') return [id, (x, y) => [cols - 1 - y, x], (x, y) => [cols - 1 - x, rows - 1 - y], (x, y) => [y, rows - 1 - x]];
  return [id];
}

function generate(cfg, seed) {
  const cols = cfg.cols, rows = cfg.rows, r = rngOf(seed);
  // cfg.turnAdd (optional, default 0) makes every pattern bend more; the original builds never set it.
  const A = Object.assign({}, ARCH[cfg.arch]); A.turn = Math.min(0.9, A.turn + (cfg.turnAdd || 0));
  const ctx = { horiz: r() < 0.5, ccw: r() < 0.5 };
  const owner = new Int16Array(cols * rows).fill(-1);
  const cover = Array.from({ length: cols * rows }, () => []);   // placed arrows whose exit line passes through the cell
  const placed = [], dependants = [], round = [];   // dependants[v] = earlier arrows whose exit line v sits in
  let maxRound = 0;
  const inb = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const imgs = symImages(A.sym, cols, rows);
  const lens = (cfg.lens || A.lens).map((l) => [l[0], l[1] * (cfg.longBias && l[0] >= 4 ? cfg.longBias : 1)]);

  function lineOf(head, dir) {
    const d = D[dir], out = []; let x = head[0] + d[0], y = head[1] + d[1];
    while (inb(x, y)) { out.push(y * cols + x); x += d[0]; y += d[1]; }
    return out;
  }
  function headFirst() {
    const x = Math.floor(r() * cols), y = Math.floor(r() * rows);
    if (owner[y * cols + x] >= 0) return null;
    const dir = pickW(r, DN.map((d) => [d, (A.dirW(x, y, cols, rows, ctx)[d] || 0.0001)]));
    const L = pickW(r, lens);
    const back = D[OPP[dir]];
    const cells = [[x, y]];
    let cx = x, cy = y, bx = back[0], by = back[1];
    for (let k = 1; k < L; k++) {
      let nx, ny;
      if (k === 1) { nx = cx + bx; ny = cy + by; }
      else {
        const opts = DN.map((d) => D[d]).filter((v) => !(v[0] === -(cells[k - 1][0] - cells[k - 2][0]) && v[1] === -(cells[k - 1][1] - cells[k - 2][1])));
        // `opts` walks backwards from the head; continue straight with probability 1 - turn.
        const sx = cells[k - 1][0] - cells[k - 2][0], sy = cells[k - 1][1] - cells[k - 2][1];
        const straight = [sx, sy];
        const turns = opts.filter((v) => !(v[0] === sx && v[1] === sy));
        const order = r() < 1 - A.turn ? [straight].concat(turns.sort(() => r() - 0.5)) : turns.sort(() => r() - 0.5).concat([straight]);
        let found = null;
        for (const v of order) { const tx = cx + v[0], ty = cy + v[1]; if (inb(tx, ty) && owner[ty * cols + tx] < 0 && !cells.some((c) => c[0] === tx && c[1] === ty)) { found = [tx, ty]; break; } }
        if (!found) break;
        nx = found[0]; ny = found[1];
      }
      if (!inb(nx, ny) || owner[ny * cols + nx] >= 0 || cells.some((c) => c[0] === nx && c[1] === ny)) break;
      cells.push([nx, ny]); cx = nx; cy = ny;
    }
    if (cells.length < 2) return null;
    return { dir: dir, cells: cells.reverse() };   // tail -> head
  }
  // Candidate that deliberately sits in the exit line of an existing arrow (preferring free ones with long chains above them).
  function height(v, memo) { if (memo[v] !== undefined) return memo[v]; let h = 1; for (const u of dependants[v]) h = Math.max(h, 1 + height(u, memo)); return (memo[v] = h); }
  function targeted() {
    if (!placed.length) return null;
    const memo = {}; let X = -1, bestW = -1;
    for (let k = 0; k < 4; k++) {
      const i = Math.floor(r() * placed.length);
      const w = (round[i] === 1 ? 3 : 1) * height(i, memo) * (0.5 + r());
      if (w > bestW) { bestW = w; X = i; }
    }
    const a = placed[X];
    const free = lineOf(a.cells[a.cells.length - 1], a.dir).filter((k) => owner[k] < 0);
    if (!free.length) return null;
    const c0 = free[Math.floor(r() * Math.min(free.length, 1 + Math.floor(r() * free.length)))];
    const cx = c0 % cols, cy = Math.floor(c0 / cols);
    const L = pickW(r, lens);
    const cells = [[cx, cy]], inPath = new Set([c0]);
    let tries = 0;
    while (cells.length < L && tries++ < 12) {
      const atEnd = r() < 0.5, base = atEnd ? cells[cells.length - 1] : cells[0];
      const v = D[DN[Math.floor(r() * 4)]], nx = base[0] + v[0], ny = base[1] + v[1];
      if (!inb(nx, ny) || owner[ny * cols + nx] >= 0 || inPath.has(ny * cols + nx)) continue;
      if (cells.length >= 2) {   // keep it a gentle path: respect turn probability by rejecting extra bends sometimes
        const e = atEnd ? cells[cells.length - 2] : cells[1];
        const straight = (base[0] - e[0]) === v[0] && (base[1] - e[1]) === v[1];
        if (!straight && r() > A.turn + 0.15) continue;
      }
      if (atEnd) cells.push([nx, ny]); else cells.unshift([nx, ny]);
      inPath.add(ny * cols + nx);
    }
    if (cells.length < 2) return null;
    if (r() < 0.5) cells.reverse();
    const n = cells.length, dx = cells[n - 1][0] - cells[n - 2][0], dy = cells[n - 1][1] - cells[n - 2][1];
    return { dir: dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up', cells: cells };
  }
  const mapArrow = (a, f) => ({ dir: a.dir, cells: a.cells.map((c) => f(c[0], c[1])) });
  function dirAfter(a, f) { const c = a.cells, p = f(c[c.length - 2][0], c[c.length - 2][1]), q = f(c[c.length - 1][0], c[c.length - 1][1]);
    const dx = q[0] - p[0], dy = q[1] - p[1]; return dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up'; }

  function legal(a, extra) {   // cells free (also against `extra` arrows of the same group) and exit line clear of placed + extra
    const seen = new Set();
    for (const c of a.cells) { if (!inb(c[0], c[1]) || owner[c[1] * cols + c[0]] >= 0) return false; seen.add(c[1] * cols + c[0]); }
    for (const e of extra) for (const c of e.cells) if (seen.has(c[1] * cols + c[0])) return false;
    const head = a.cells[a.cells.length - 1];
    for (const k of lineOf(head, a.dir)) { if (owner[k] >= 0) return false; for (const e of extra) if (e.cells.some((c) => c[1] * cols + c[0] === k)) return false; }
    return true;
  }
  function gain(a) {   // how many placed arrows this one will sit in front of (later => they depend on it leaving)
    const hit = new Set();
    a.cells.forEach((c) => cover[c[1] * cols + c[0]].forEach((i) => hit.add(i)));
    return hit.size;
  }
  function hitsOf(a) {
    const hit = new Set();
    a.cells.forEach((c) => cover[c[1] * cols + c[0]].forEach((i) => hit.add(i)));
    return hit;
  }
  // Rounds after adding `group` (each new arrow is free at first, and pushes the arrows it blocks one round later).
  function simulate(group) {
    const rr = round.slice(), q = [];
    group.forEach((a) => hitsOf(a).forEach((y) => { if (rr[y] < 2) { rr[y] = 2; q.push(y); } }));
    while (q.length) {
      const v = q.pop();
      for (const u of dependants[v]) if (rr[u] < rr[v] + 1) { rr[u] = rr[v] + 1; q.push(u); }
    }
    let mx = 1, sum = 0; rr.forEach((v) => { if (v > mx) mx = v; sum += v; });
    return { mx: mx, sum: sum };
  }
  function commit(a) {
    const idx = placed.length;
    dependants.push(Array.from(hitsOf(a))); round.push(1);
    placed.push(a);
    a.cells.forEach((c) => { owner[c[1] * cols + c[0]] = idx; });
    lineOf(a.cells[a.cells.length - 1], a.dir).forEach((k) => cover[k].push(idx));
    // keep rounds current
    const q = [];
    dependants[idx].forEach((y) => { if (round[y] < 2) { round[y] = 2; q.push(y); } });
    while (q.length) { const v = q.pop(); for (const u of dependants[v]) if (round[u] < round[v] + 1) { round[u] = round[v] + 1; q.push(u); } }
    maxRound = 1; round.forEach((v) => { if (v > maxRound) maxRound = v; });
  }

  let fails = 0;
  const cap = cfg.target * 60;
  for (let it = 0; it < cap && placed.length < cfg.target && fails < cfg.target * 25; it++) {
    let best = null, bestS = -1e9;
    for (let k = 0; k < (cfg.pool || 10); k++) {
      const base = (cfg.tgt && r() < cfg.tgt) ? targeted() : headFirst(); if (!base) continue;
      const group = [];
      let ok = true;
      for (const f of imgs) {
        const a = f === imgs[0] ? base : { dir: dirAfter(base, f), cells: base.cells.map((c) => f(c[0], c[1])) };
        if (!legal(a, group)) { ok = false; break; }
        group.push(a);
      }
      if (!ok) continue;
      let s = 0;
      group.forEach((a) => { s += A.block * cfg.blockW * gain(a); });
      if (cfg.depthW || cfg.sumW) {
        const sim = simulate(group);
        let base = 0; round.forEach((v) => { base += v; });
        s += (cfg.depthW || 0) * (sim.mx - maxRound) + (cfg.sumW || 0) * (sim.sum + group.length - base - group.length);
      }
      s += r() * cfg.noise;
      if (s > bestS) { bestS = s; best = group; }
    }
    if (!best) { fails++; continue; }
    best.forEach(commit);
  }
  const arrows = placed.slice().reverse().map((a, i) => ({ id: String(i), dir: a.dir, cells: a.cells }));
  return { cols: cols, rows: rows, arrows: arrows };
}
module.exports = { generate, ARCH, rngOf, pickW };
