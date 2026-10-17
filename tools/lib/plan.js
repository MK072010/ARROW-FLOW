/* Deterministic planning helpers for the level builder: which difficulty each level aims for, and what its board looks like. */
'use strict';
const { rngOf, pickW } = require('./gen.js');
const TIER_ORDER = ['easy', 'medium', 'hard', 'expert'];

/* Target tier for each level from `first` to `last`. Probabilities drift from gentle (more easy/medium) toward demanding
   (more hard/expert) as the campaign goes on, modulated by two slow waves of different lengths (37 and 89 levels), so there
   is no fixed repeating pattern. Hard rules on top: no tier more than 3 times in a row, never more than 5 easy/medium levels
   or 4 hard/expert levels in a row, and an expert is never followed by another expert after two in a row. */
function planTiers(first, last, history, seed) {
  const r = rngOf(seed), ph1 = r() * 6.283, ph2 = r() * 6.283, out = [];
  const hist = history.slice();
  for (let L = first; L <= last; L++) {
    const p = (L - first) / (last - first);
    const wave = 1 + 0.45 * Math.sin(L * 6.283 / 37 + ph1) + 0.25 * Math.sin(L * 6.283 / 89 + ph2);
    const soft = Math.max(0.35, 2 - wave);
    const w = {
      easy: (0.34 - 0.22 * p) * soft, medium: (0.38 - 0.06 * p) * soft,
      hard: (0.22 + 0.12 * p) * wave, expert: (0.06 + 0.16 * p) * wave
    };
    const allowed = (t) => {
      const h = hist.concat([t]);
      const n = h.length;
      if (n >= 4 && h[n - 1] === h[n - 2] && h[n - 2] === h[n - 3] && h[n - 3] === h[n - 4]) return false;
      const low = (x) => x === 'easy' || x === 'medium';
      let run = 0; for (let i = n - 1; i >= 0 && low(h[i]) === low(t); i--) run++;
      if (low(t) ? run > 5 : run > 4) return false;
      return true;
    };
    let pick = null;
    for (let k = 0; k < 60 && !pick; k++) { const t = pickW(r, TIER_ORDER.map((x) => [x, w[x]])); if (allowed(t)) pick = t; }
    if (!pick) pick = TIER_ORDER.filter(allowed).sort((a, b) => w[b] - w[a])[0] || 'medium';
    out.push(pick); hist.push(pick);
  }
  return out;
}

const SIZES = {
  easy:   [[6, 6], [6, 7], [7, 6], [7, 7], [7, 8], [8, 7], [6, 8], [8, 6], [8, 8]],
  medium: [[7, 7], [7, 8], [8, 7], [8, 8], [8, 9], [9, 8], [9, 9], [7, 9], [9, 7]],
  hard:   [[8, 8], [8, 9], [9, 8], [9, 9], [9, 10], [10, 9], [10, 10], [8, 10], [10, 8]],
  expert: [[9, 9], [9, 10], [10, 9], [10, 10], [10, 10]]
};
const ARCHS = {
  easy:   ['scatter', 'lanes', 'mirror', 'halfturn', 'pinwheel', 'radial', 'ring', 'snakes', 'ladder', 'braid'],
  medium: ['scatter', 'lanes', 'mirror', 'halfturn', 'pinwheel', 'radial', 'ring', 'snakes', 'ladder', 'braid', 'inward'],
  hard:   ['scatter', 'lanes', 'halfturn', 'pinwheel', 'radial', 'ring', 'snakes', 'ladder', 'braid', 'inward'],
  expert: ['scatter', 'lanes', 'halfturn', 'pinwheel', 'ring', 'snakes', 'ladder', 'braid', 'inward', 'radial']
};
const FILL = { easy: [0.20, 0.30], medium: [0.25, 0.33], hard: [0.28, 0.37], expert: [0.30, 0.40] };

// Generator settings for one attempt at a level of the given tier.
function paramsFor(tier, rnd, avoidArchs) {
  let arch, size, guard = 0;
  do {
    arch = ARCHS[tier][Math.floor(rnd() * ARCHS[tier].length)];
    size = SIZES[tier][Math.floor(rnd() * SIZES[tier].length)];
    guard++;
  } while (guard < 50 && ((arch === 'pinwheel' && size[0] !== size[1]) || avoidArchs.indexOf(arch) !== -1));
  if (arch === 'pinwheel' && size[0] !== size[1]) size = [size[0], size[0]];
  const f = FILL[tier], area = size[0] * size[1];
  const dw = { easy: [0, 3], medium: [2, 7], hard: [5, 10], expert: [8, 13] }[tier];
  return {
    arch: arch, cols: size[0], rows: size[1],
    target: Math.round(area * (f[0] + rnd() * (f[1] - f[0]))),
    pool: tier === 'easy' ? 8 : tier === 'medium' ? 12 : 24,
    blockW: 0.6 + rnd() * 1.6, depthW: dw[0] + rnd() * (dw[1] - dw[0]), sumW: tier === 'expert' ? 1 + rnd() * 2 : rnd(),
    tgt: tier === 'easy' ? 0.1 + rnd() * 0.2 : 0.35 + rnd() * 0.4, noise: 0.5 + rnd() * 1.5,
    longBias: 0.7 + rnd() * 1.0
  };
}

/* Redesign settings (level design pass 2): packed boards. Easy boards are kept small enough that a packed board is still an
   easy puzzle; the other tiers keep their original size ranges. Same tier per level number as before. */
const SIZES_V2 = Object.assign({}, SIZES, { easy: [[6, 6], [6, 7], [7, 6], [7, 7], [6, 8], [8, 6], [7, 8], [8, 7]] });
const FREE0 = { easy: 0.45, medium: 0.32, hard: 0.26, expert: 0.22 };
/* Board size ladder (pass 3): sides grow from 6 to 25 over the campaign. Each tier has a [low, high] side range at the first
   and at the last level; a level draws a side in the range for its position, and the other side differs by at most 2. */
const SIDE = { easy: [[6, 7], [8, 10]], medium: [[6, 9], [10, 16]], hard: [[7, 11], [13, 21]], expert: [[8, 13], [16, 25]] };
function sizeFor(L, tier, rnd, first, last) {
  const p = (L - first) / (last - first), s = SIDE[tier];
  const lo = s[0][0] + (s[1][0] - s[0][0]) * p, hi = s[0][1] + (s[1][1] - s[0][1]) * p;
  const clamp = (v) => Math.max(p < 0.12 ? 6 : 8, Math.min(25, v));   // boards under 64 cells cannot hold 15 arrows, so they only open the campaign
  const c = clamp(Math.round(lo + rnd() * (hi - lo)));
  const r = clamp(c + Math.floor(rnd() * 5) - 2);
  return fitTier(rnd() < 0.5 ? [c, r] : [r, c], tier, p);
}
// Easy/medium boards of 8..10 per side never rate below "hard" (see analyze.score), so they would only waste attempts:
// early levels stay at 6-7, later ones use 11x10 or more, where difficulty is rated per board size.
function fitTier(size, tier, p) {
  if (tier !== 'easy' && tier !== 'medium') return size;
  let c = size[0], r = size[1];
  if ((c >= 8 && c <= 10) || (r >= 8 && r <= 10)) {
    if (p < 0.12) return [Math.min(c, 7), Math.min(r, 7)];
    return [Math.max(c, 11), Math.max(r, 10)];
  }
  return size;
}
// `keepSize` ([cols, rows], optional) keeps the board size the level had before the redesign, so the campaign's size pacing is unchanged.
function paramsForV2(tier, rnd, avoidArchs, keepSize) {
  let cfg, guard = 0;
  do { cfg = paramsFor(tier, rnd, avoidArchs); guard++; } while (guard < 60 && SIZES_V2[tier].findIndex((s) => s[0] === cfg.cols && s[1] === cfg.rows) < 0);
  if (keepSize) {
    cfg.cols = keepSize[0]; cfg.rows = keepSize[1];
    if (cfg.arch === 'pinwheel' && cfg.cols !== cfg.rows) {   // the pinwheel pattern needs a square board: use another pattern that the previous levels did not use
      const alt = ['scatter', 'lanes', 'halfturn', 'radial', 'ring', 'snakes', 'ladder', 'braid'].filter((a) => avoidArchs.indexOf(a) === -1);
      cfg.arch = alt[Math.floor(rnd() * alt.length)];
    }
    const f = { easy: [0.2, 0.3], medium: [0.25, 0.33], hard: [0.28, 0.37], expert: [0.3, 0.4] }[tier];
    cfg.target = Math.round(cfg.cols * cfg.rows * (f[0] + rnd() * (f[1] - f[0])));
  }
  cfg.turnAdd = 0.5 + rnd() * 0.15;
  cfg.lens = tier === 'easy' || tier === 'medium' ? [[3, 3], [4, 4], [5, 3], [6, 2]] : [[3, 4], [4, 4], [5, 2]];
  cfg.dens = {
    lens: [[2, 0.6], [3, 3], [4, 4], [5, 3], [6, 2]], turn: 0.75 + rnd() * 0.15, bendW: 1.0 + rnd() * 0.5, noise: 1.5,
    tries: 10, minScore: 0, growMax: 3, maxLen: 7, minLen: 3, freePenalty: 4, depW: 3, absorb: 1, free0Target: FREE0[tier] * (0.85 + rnd() * 0.3)
  };
  if (cfg.cols * cfg.rows < 80) {   // small boards need shorter arrows to hold enough of them
    cfg.lens = [[2, 2], [3, 4], [4, 2]];
    Object.assign(cfg.dens, { lens: [[2, 1.5], [3, 4], [4, 2.5], [5, 1]], maxLen: 5, minLen: 2, absorb: 0.25 });
  }
  return cfg;
}
module.exports = { planTiers, paramsFor, paramsForV2, sizeFor, TIER_ORDER, SIZES, SIZES_V2 };
