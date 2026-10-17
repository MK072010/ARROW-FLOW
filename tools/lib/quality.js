/* Extra, level-design quality metrics (density, shape variety, interlock) used by the builder and validator.
   They sit beside analyze.js and do not change its difficulty score, so tiers of existing levels stay as they were. */
'use strict';
const { bendsOf } = require('./densify.js');

function extra(p) {
  const cols = p.cols, rows = p.rows, n = p.arrows.length, area = cols * rows;
  const owner = new Int16Array(area).fill(-1);
  p.arrows.forEach((a, i) => a.cells.forEach((c) => { owner[c[1] * cols + c[0]] = i; }));
  let straight = 0, short2 = 0, multi = 0, bent = 0, cells = 0, longest = 0;
  p.arrows.forEach((a) => {
    const b = bendsOf(a.cells); cells += a.cells.length; if (a.cells.length > longest) longest = a.cells.length;
    if (b === 0) straight++; else bent++;
    if (b >= 2) multi++;
    if (a.cells.length === 2) short2++;
  });
  // largest connected pocket of empty cells
  const seen = new Uint8Array(area); let pocket = 0;
  for (let s = 0; s < area; s++) {
    if (owner[s] >= 0 || seen[s]) continue;
    let size = 0; const st = [s]; seen[s] = 1;
    while (st.length) { const v = st.pop(); size++; const x = v % cols, y = (v - x) / cols;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => { const X = x + d[0], Y = y + d[1]; if (X < 0 || Y < 0 || X >= cols || Y >= rows) return; const k = Y * cols + X; if (owner[k] < 0 && !seen[k]) { seen[k] = 1; st.push(k); } }); }
    if (size > pocket) pocket = size;
  }
  // touching arrows that share a colour tone (tone = index % 8 in js/render.js)
  const tone = (i) => i % 8; let clash = 0; const pairs = new Set();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = owner[y * cols + x]; if (a < 0) continue;
    [[1, 0], [0, 1]].forEach((d) => { const X = x + d[0], Y = y + d[1]; if (X >= cols || Y >= rows) return; const b = owner[Y * cols + X];
      if (b >= 0 && b !== a && tone(a) === tone(b)) { const k = Math.min(a, b) + ',' + Math.max(a, b); if (!pairs.has(k)) { pairs.add(k); clash++; } } });
  }
  return { coverage: cells / area, straightFrac: straight / n, short2Frac: short2 / n, bentFrac: bent / n, multiFrac: multi / n, pocket: pocket, longest: longest, toneClash: clash };
}

/* Minimum standards per tier for generated levels (51+). */
const GATE = {
  easy:   { cov: 0.86, straight: 0.45, multi: 0.05, free0: 0.55, pocket: 4 },
  medium: { cov: 0.88, straight: 0.40, multi: 0.10, free0: 0.45, pocket: 4 },
  hard:   { cov: 0.90, straight: 0.36, multi: 0.14, free0: 0.36, pocket: 3 },
  expert: { cov: 0.90, straight: 0.34, multi: 0.16, free0: 0.30, pocket: 3 }
};
function gate(tier, m, x) {
  const g = GATE[tier];
  if (x.coverage < g.cov) return 'too empty';
  if (x.straightFrac > g.straight) return 'too many straight arrows';
  if (x.multiFrac < g.multi) return 'too few multi-segment arrows';
  if (x.short2Frac > (m.area < 80 ? 0.35 : 0.2)) return 'too many 2-cell arrows';
  if (m.free0Frac > g.free0) return 'too many free arrows at start';
  if (x.pocket > g.pocket) return 'empty pocket';
  if (m.avgDeps < (tier === 'easy' ? 0.8 : tier === 'medium' ? 1.0 : 1.15)) return 'weak interlock';
  if (x.toneClash > 0) return 'touching arrows share a colour';
  return null;
}

/* js/render.js colours arrow i with tone (i % 8). In a packed board two touching arrows of one tone read as a single
   arrow, so the arrows are re-ordered (ids are arbitrary labels; the rules never look at order) until no two touching
   arrows share a tone. Seeded, so the saved order is permanent. */
function retone(p, rnd) {
  const cols = p.cols, rows = p.rows, n = p.arrows.length, owner = new Int16Array(cols * rows).fill(-1);
  p.arrows.forEach((a, i) => a.cells.forEach((c) => { owner[c[1] * cols + c[0]] = i; }));
  const edges = new Set();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = owner[y * cols + x]; if (a < 0) continue;
    [[1, 0], [0, 1]].forEach((d) => { const X = x + d[0], Y = y + d[1]; if (X >= cols || Y >= rows) return; const b = owner[Y * cols + X]; if (b >= 0 && b !== a) edges.add(Math.min(a, b) + ',' + Math.max(a, b)); });
  }
  const adj = Array.from({ length: n }, () => []);
  edges.forEach((e) => { const [a, b] = e.split(',').map(Number); adj[a].push(b); adj[b].push(a); });
  const pos = Array.from({ length: n }, (_, i) => i);          // pos[arrow] = its new index
  const cost = () => { let c = 0; for (let a = 0; a < n; a++) for (const b of adj[a]) if (a < b && pos[a] % 8 === pos[b] % 8) c++; return c; };
  const local = (a) => { let c = 0; for (const b of adj[a]) if (pos[a] % 8 === pos[b] % 8) c++; return c; };
  let cur = cost();
  for (let it = 0; it < 4000 + 80 * n && cur > 0; it++) {
    const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n); if (a === b) continue;
    const before = local(a) + local(b);
    let t = pos[a]; pos[a] = pos[b]; pos[b] = t;
    const after = local(a) + local(b);
    if (after <= before || rnd() < 0.02) cur += after - before; else { t = pos[a]; pos[a] = pos[b]; pos[b] = t; }
  }
  const arrows = new Array(n);
  for (let a = 0; a < n; a++) arrows[pos[a]] = p.arrows[a];
  return { cols: cols, rows: rows, arrows: arrows };
}
module.exports = { extra, gate, GATE, retone };
