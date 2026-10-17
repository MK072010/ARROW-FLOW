/* Daily Challenge: date handling, deterministic puzzle selection, calendar data and its own storage.
   - Dates are LOCAL calendar dates written 'YYYY-MM-DD'. Nothing here goes through UTC.
   - From DAILY_CUTOVER on, the puzzle for a date comes from the permanent daily pool (data/daily.v1.json, 392 validated
     puzzles, difficulty by weekday): slot = days since the cutover modulo the pool size, so every player gets the same
     puzzle on the same date. After a full cycle (56 weeks) the pool repeats, each time rotated/mirrored differently.
   - Dates before the cutover keep the original rule: a validated campaign puzzle (levels 1-5) optionally rotated/mirrored.
   - Every result is re-checked with Rules.validatePuzzle + Rules.solve; if anything fails, the untransformed puzzle is used.
   - Same date + same VERSION always gives the same puzzle. Bump VERSION to change the whole sequence.
   - Daily progress lives under its own key and never touches the campaign save. */
(function (AF) {
  'use strict';

  const VERSION = 1;
  const KEY = 'arrowflow.daily.v1';
  const EPOCH = '2026-01-01';          // first date that has a daily puzzle
  const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  /* ---- Dates ------------------------------------------------------------ */

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(y, m) { return m === 1 && isLeap(y) ? 29 : MONTH_DAYS[m]; }   // m is 0-based
  function keyOf(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function todayKey(now) {
    const d = now || new Date();
    return keyOf(d.getFullYear(), d.getMonth(), d.getDate());     // local getters, no UTC
  }
  function parseKey(k) {
    const r = typeof k === 'string' ? DAY_RE.exec(k) : null;
    if (!r) return null;
    const y = +r[1], m = +r[2] - 1, d = +r[3];
    if (y < 2000 || y > 2200 || m < 0 || m > 11 || d < 1 || d > daysInMonth(y, m)) return null;
    return { y: y, m: m, d: d };
  }
  // Zero-padded keys compare correctly as strings.
  function canPlay(k, now) { return !!parseKey(k) && k >= EPOCH && k <= todayKey(now); }

  function fmt(k, opts) {
    const p = parseKey(k);
    if (!p) return String(k);
    try { return new Date(p.y, p.m, p.d).toLocaleDateString(undefined, opts); } catch (e) { return k; }
  }
  function longLabel(k) { return fmt(k, { weekday: 'long', month: 'long', day: 'numeric' }); }
  function shortLabel(k) { return fmt(k, { month: 'short', day: 'numeric' }); }

  function monthInRange(y, m, now) {
    const t = parseKey(todayKey(now)), e = parseKey(EPOCH), i = y * 12 + m;
    return i >= e.y * 12 + e.m && i <= t.y * 12 + t.m;
  }

  /* ---- Deterministic puzzle selection ---------------------------------------- */

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function pick(k) {
    const n = AF.Levels.DAILY_POOL || AF.Levels.PLAYABLE;
    return {
      template: (hash('arrowflow-daily|v' + VERSION + '|t|' + k) % n) + 1,
      variant: hash('arrowflow-daily|v' + VERSION + '|v|' + k) % 8      // 0-3 rotations, 4-7 mirrored + rotations
    };
  }

  const ROT = { up: 'right', right: 'down', down: 'left', left: 'up' };
  const FLIP = { left: 'right', right: 'left', up: 'up', down: 'down' };

  function copyPuzzle(p) {
    return {
      cols: p.cols, rows: p.rows, name: p.name,
      solution: (p.solution || []).slice(),
      arrows: p.arrows.map(function (a) { return { id: a.id, dir: a.dir, cells: a.cells.map(function (c) { return [c[0], c[1]]; }) }; })
    };
  }

  function transform(p, variant) {
    const out = copyPuzzle(p);
    if (p.cols !== p.rows) return out;
    const n = p.cols;
    if (variant >= 4) out.arrows.forEach(function (a) {
      a.dir = FLIP[a.dir];
      a.cells = a.cells.map(function (c) { return [n - 1 - c[0], c[1]]; });
    });
    for (let r = 0; r < variant % 4; r++) out.arrows.forEach(function (a) {
      a.dir = ROT[a.dir];
      a.cells = a.cells.map(function (c) { return [n - 1 - c[1], c[0]]; });
    });
    return out;
  }

  function dayNumber(k) { const p = parseKey(k); return Math.floor(Date.UTC(p.y, p.m, p.d) / 86400000); }

  // Pool puzzle for dates from the cutover on, or null when the pool is not available.
  function poolPuzzle(k) {
    const pool = AF.DAILY_DATA;
    if (!pool || !Array.isArray(pool.levels) || !pool.levels.length || !pool.cutover || k < pool.cutover) return null;
    const n = dayNumber(k) - dayNumber(pool.cutover);
    const count = pool.levels.length;
    const base = AF.Levels.fromRecord(pool.levels[n % count], 'daily-' + k);
    return { base: base, variant: Math.floor(n / count) % 8 };
  }

  function usable(p) {
    return !!p && AF.Rules.validatePuzzle(p).length === 0 && AF.Rules.solve(p).solvable;
  }

  // Returns a fresh, validated puzzle for the date, or null if the date has none.
  function puzzleFor(k) {
    if (!canPlay(k)) return null;
    const fromPool = poolPuzzle(k);
    if (fromPool) {
      let q = transform(fromPool.base, fromPool.variant);
      if (!usable(q)) { q = copyPuzzle(fromPool.base); if (!usable(q)) return null; }
      q.id = 'daily-' + k;
      return q;
    }
    const sel = pick(k);
    const level = AF.Levels.get(sel.template);
    if (!level || !level.puzzle) return null;
    let p = transform(level.puzzle, sel.variant);
    if (!usable(p)) { p = copyPuzzle(level.puzzle); if (!usable(p)) return null; }
    p.id = 'daily-' + k;                 // never a campaign level id
    return p;
  }

  /* ---- Storage -------------------------------------------------------------- */

  function sanitize(raw) {
    const out = { completed: {}, introSeen: false };
    if (!raw || typeof raw !== 'object') return out;
    if (raw.completed && typeof raw.completed === 'object' && !Array.isArray(raw.completed)) {
      Object.keys(raw.completed).forEach(function (k) {
        if (!parseKey(k)) return;
        const e = raw.completed[k];
        out.completed[k] = { at: e && typeof e.at === 'string' ? e.at : '' };
      });
    }
    out.introSeen = raw.introSeen === true;
    return out;
  }

  function load() {
    try {
      const t = localStorage.getItem(KEY);
      return sanitize(t ? JSON.parse(t) : null);
    } catch (e) { return sanitize(null); }
  }

  let data = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }

  function isCompleted(k) { return Object.prototype.hasOwnProperty.call(data.completed, k); }

  // Records a completion once per date. firstTime is true only on the first record (the only time a reward is given).
  function complete(k) {
    if (!canPlay(k) || isCompleted(k)) return { firstTime: false };
    data.completed[k] = { at: new Date().toISOString() };
    save();
    return { firstTime: true };
  }

  /* ---- Calendar data ---------------------------------------------------------- */

  function month(y, m, now) {
    const tk = todayKey(now), t = parseKey(tk), n = daysInMonth(y, m);
    const days = [];
    let completed = 0;
    for (let d = 1; d <= n; d++) {
      const k = keyOf(y, m, d);
      let state;
      if (k > tk) state = 'future';
      else if (k < EPOCH) state = 'unavailable';
      else if (isCompleted(k)) { state = 'done'; completed++; }
      else state = 'open';
      days.push({ n: d, key: k, state: state, playable: canPlay(k, now), today: k === tk });
    }
    return {
      y: y, m: m, length: n, days: days, completed: completed,
      lead: new Date(y, m, 1).getDay(),                         // Sunday-first weekday of the 1st
      isCurrent: y === t.y && m === t.m,
      label: new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      monthName: new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long' })
    };
  }

  AF.Daily = {
    VERSION: VERSION,
    EPOCH: EPOCH,
    daysInMonth: daysInMonth,
    todayKey: todayKey,
    parseKey: parseKey,
    canPlay: canPlay,
    longLabel: longLabel,
    shortLabel: shortLabel,
    monthInRange: monthInRange,
    month: month,
    puzzleFor: puzzleFor,
    isCompleted: isCompleted,
    complete: complete,
    totalCompleted: function () { return Object.keys(data.completed).length; },
    // { 'YYYY-MM-DD': ISO completion time } (a copy). Used by the awards for the streak.
    completedEntries: function () {
      const out = {};
      Object.keys(data.completed).forEach(function (k) { out[k] = data.completed[k].at; });
      return out;
    },
    introSeen: function () { return data.introSeen; },
    markIntroSeen: function () { if (!data.introSeen) { data.introSeen = true; save(); } }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AF.Daily;
})(typeof window !== 'undefined' ? (window.AF = window.AF || {}) : (globalThis.AF = globalThis.AF || {}));
