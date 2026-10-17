/* Densify: turns a sparse generated backbone into a tightly packed board without ever breaking solvability.
   Under the game's rules (js/rules.js) a puzzle is solvable exactly when its dependency graph is acyclic
   (arrow A depends on arrow B when a cell of B lies in A's exit line). Every change below is therefore accepted only
   if the whole board is still acyclic, so the result is solvable by construction; build-levels.js and
   validate-levels.js re-check it with the real rules anyway.
   Two moves, both seeded:
     1. place NEW bent / multi-segment arrows into empty pockets (preferring ones that sit in other arrows' paths);
     2. GROW an existing arrow's tail into an adjacent empty cell (head and exit line stay the same). */
'use strict';
const { D } = require('./analyze.js');
const DN = ['up', 'down', 'left', 'right'];
const NAME = { '0,-1': 'up', '0,1': 'down', '-1,0': 'left', '1,0': 'right' };

function dirOf(cells) {
  const n = cells.length, dx = cells[n - 1][0] - cells[n - 2][0], dy = cells[n - 1][1] - cells[n - 2][1];
  return NAME[dx + ',' + dy];
}
// true when no dependency cycle exists (so the puzzle is solvable under the game's rules)
function acyclic(cols, rows, arrows) {
  const n = arrows.length, owner = new Int16Array(cols * rows).fill(-1);
  arrows.forEach((a, i) => a.cells.forEach((c) => { owner[c[1] * cols + c[0]] = i; }));
  const need = new Int16Array(n), users = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const a = arrows[i], d = D[a.dir], h = a.cells[a.cells.length - 1], seen = new Set();
    let x = h[0] + d[0], y = h[1] + d[1];
    while (x >= 0 && y >= 0 && x < cols && y < rows) {
      const o = owner[y * cols + x];
      if (o >= 0 && o !== i && !seen.has(o)) { seen.add(o); need[i]++; users[o].push(i); }
      x += d[0]; y += d[1];
    }
  }
  const q = []; for (let i = 0; i < n; i++) if (!need[i]) q.push(i);
  let done = 0;
  while (q.length) { const v = q.pop(); done++; for (const u of users[v]) if (--need[u] === 0) q.push(u); }
  return done === n;
}
function bendsOf(cells) {
  let b = 0;
  for (let k = 2; k < cells.length; k++) {
    if (cells[k][0] - cells[k - 1][0] !== cells[k - 1][0] - cells[k - 2][0] || cells[k][1] - cells[k - 1][1] !== cells[k - 1][1] - cells[k - 2][1]) b++;
  }
  return b;
}

function densify(p, rnd, o) {
  const cols = p.cols, rows = p.rows;
  const arrows = p.arrows.map((a) => ({ dir: a.dir, cells: a.cells.map((c) => [c[0], c[1]]) }));
  const owner = new Int16Array(cols * rows).fill(-1);
  const rebuild = () => { owner.fill(-1); arrows.forEach((a, i) => a.cells.forEach((c) => { owner[c[1] * cols + c[0]] = i; })); };
  const inb = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const free = (x, y) => inb(x, y) && owner[y * cols + x] < 0;
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
  const lenPick = () => { const t = o.lens; let s = 0; t.forEach((e) => { s += e[1]; }); let x = rnd() * s; for (const e of t) { x -= e[1]; if (x <= 0) return e[0]; } return t[0][0]; };
  rebuild();

  // how interesting is a candidate arrow? Exit line blocked by others (it depends on them) and its body sitting in
  // other arrows' exit lines (they depend on it) are what create move-order puzzles.
  function interest(a) {
    const d = D[a.dir], h = a.cells[a.cells.length - 1], hit = new Set();
    let x = h[0] + d[0], y = h[1] + d[1], far = 0, k = 1;
    while (inb(x, y)) { const ow = owner[y * cols + x]; if (ow >= 0) { if (!hit.size) far = k; hit.add(ow); } x += d[0]; y += d[1]; k++; }
    let blocks = 0;
    for (const t of arrows) {
      const td = D[t.dir], th = t.cells[t.cells.length - 1];
      let tx = th[0] + td[0], ty = th[1] + td[1], found = false;
      while (!found && inb(tx, ty)) { if (a.cells.some((c) => c[0] === tx && c[1] === ty)) found = true; tx += td[0]; ty += td[1]; }
      if (found) blocks++;
    }
    return { deps: hit.size, blocks: blocks, far: far, score: o.depW * Math.min(2, hit.size) + 1.6 * Math.min(2, blocks) + (far >= 3 ? 0.8 : 0) + o.bendW * Math.min(2, bendsOf(a.cells)) + 0.25 * a.cells.length - (hit.size === 0 ? o.freePenalty : 0) - (hit.size === 0 && blocks === 0 ? 2 : 0) + rnd() * o.noise };
  }

  function walk(sx, sy, L) {
    const cells = [[sx, sy]], used = new Set([sy * cols + sx]);
    let px = 0, py = 0;
    while (cells.length < L) {
      const c = cells[cells.length - 1];
      const opts = DN.map((n) => D[n]).filter((v) => free(c[0] + v[0], c[1] + v[1]) && !used.has((c[1] + v[1]) * cols + c[0] + v[0]));
      if (!opts.length) break;
      let pick;
      const straight = opts.find((v) => v[0] === px && v[1] === py), turns = opts.filter((v) => v !== straight);
      if (straight && (!turns.length || rnd() > o.turn)) pick = straight; else pick = turns.length ? turns[Math.floor(rnd() * turns.length)] : straight;
      cells.push([c[0] + pick[0], c[1] + pick[1]]); used.add((c[1] + pick[1]) * cols + c[0] + pick[0]); px = pick[0]; py = pick[1];
    }
    return cells;
  }

  function placeNew() {
    const empties = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (owner[y * cols + x] < 0) empties.push([x, y]);
    shuffle(empties);
    for (const e of empties) {
      if (owner[e[1] * cols + e[0]] >= 0) continue;
      let best = null, bs = -1e9;
      for (let k = 0; k < o.tries; k++) {
        let cells = walk(e[0], e[1], lenPick());
        if (cells.length < (o.minLen || 2)) continue;
        // try the walk with the head at either end: the end whose exit line runs into other arrows is the more interesting one
        for (let flip = 0; flip < 2; flip++) {
          const cs = flip ? cells.slice().reverse() : cells;
          const a = { dir: dirOf(cs), cells: cs };
          const it = interest(a);
          if (it.score <= bs) continue;
          arrows.push(a); const ok = acyclic(cols, rows, arrows); arrows.pop();
          if (ok) { bs = it.score; best = a; }
        }
      }
      if (best && bs > o.minScore) { arrows.push(best); rebuild(); }
    }
  }
  function growTails(light) {
    const order = shuffle(arrows.map((a, i) => i));
    for (const i of order) {
      for (let g = 0; g < o.growMax; g++) {
        const a = arrows[i]; if (a.cells.length >= o.maxLen) break;
        const t = a.cells[0], nx = a.cells[1];
        const px = t[0] - nx[0], py = t[1] - nx[1];   // straight continuation backwards
        const opts = DN.map((n) => D[n]).filter((v) => !(v[0] === -px && v[1] === -py) && free(t[0] + v[0], t[1] + v[1]));
        if (!opts.length) break;
        shuffle(opts);
        opts.sort((u, v) => ((v[0] !== px || v[1] !== py) ? 1 : 0) - ((u[0] !== px || u[1] !== py) ? 1 : 0) + (rnd() - 0.5) * 0.6);   // prefer bends
        let done = false;
        for (const v of opts) {
          const old = a.cells; a.cells = [[t[0] + v[0], t[1] + v[1]]].concat(old);
          if (acyclic(cols, rows, arrows)) { rebuild(); done = true; break; }
          a.cells = old;
        }
        if (!done) break;
      }
    }
  }
  // Reversing an arrow (head <-> tail) keeps its cells, so it changes only what ITS exit line runs into.
  function depsOf(a) {
    const d = D[a.dir], h = a.cells[a.cells.length - 1], hit = new Set();
    let x = h[0] + d[0], y = h[1] + d[1];
    while (inb(x, y)) { const ow = owner[y * cols + x]; if (ow >= 0 && arrows[ow] !== a) hit.add(ow); x += d[0]; y += d[1]; }
    return hit.size;
  }
  function reorient(target) {
    const free0 = () => arrows.filter((a) => depsOf(a) === 0).length;
    const order = shuffle(arrows.map((a, i) => i));
    for (const i of order) {
      if (free0() <= target * arrows.length) break;
      const a = arrows[i]; if (depsOf(a) > 0) continue;
      const old = { dir: a.dir, cells: a.cells };
      const cs = a.cells.slice().reverse(); a.cells = cs; a.dir = dirOf(cs);
      if (!(depsOf(a) > 0 && acyclic(cols, rows, arrows))) { a.dir = old.dir; a.cells = old.cells; }
    }
  }
  // 2-cell arrows are the plainest shape: drop them and let neighbouring arrows grow into their cells instead.
  function absorbShort() {
    for (let i = arrows.length - 1; i >= 0; i--) {
      if (arrows[i].cells.length !== 2 || rnd() > o.absorb) continue;
      const gone = arrows.splice(i, 1)[0]; rebuild();
      const before = arrows.map((a) => a.cells.length);
      growTails(true);
      const grew = arrows.some((a, k) => a.cells.length !== before[k]);
      if (!grew || !acyclic(cols, rows, arrows)) { arrows.forEach((a, k) => { if (a.cells.length !== before[k]) a.cells = a.cells.slice(a.cells.length - before[k]); }); arrows.splice(i, 0, gone); rebuild(); }
    }
  }
  for (let pass = 0; pass < 3; pass++) { placeNew(); growTails(); }
  if (o.absorb) { absorbShort(); placeNew(); growTails(); }
  if (o.free0Target !== undefined) reorient(o.free0Target);
  return { cols: cols, rows: rows, arrows: arrows };
}
module.exports = { densify, acyclic, bendsOf };
