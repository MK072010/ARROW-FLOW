/* Achievements: awards earned from real game events, saved on this device only (no server, nothing is verified remotely).
   - Campaign awards count UNIQUE campaign levels that were genuinely cleared. Replays never add to the count.
   - Daily awards use the Daily Challenge record, kept separately from the campaign.
   - The streak counts only days where the puzzle was finished on its own local calendar date
     (a past day replayed later does not count). Missing a day ends the streak.
   - An award unlocks once. Re-clearing a level or day never re-awards it. Earned awards are kept when progress is reset;
     only the campaign tally is cleared so that locked awards restart with the campaign. */
(function (AF) {
  'use strict';

  const KEY = 'arrowflow.achievements.v1';
  const STREAK_TARGET = 7;

  const DEFS = [
    { id: 'first-puzzle',  kind: 'campaign', target: 1,  unit: 'puzzle',    icon: 'aw-first',  title: 'First Puzzle',            desc: 'Clear your first campaign puzzle.' },
    { id: 'campaign-10',   kind: 'campaign', target: 10, unit: 'puzzles',   icon: 'aw-tier1',  title: '10 Campaign Puzzles',     desc: 'Clear 10 different campaign puzzles.' },
    { id: 'campaign-25',   kind: 'campaign', target: 25, unit: 'puzzles',   icon: 'aw-tier2',  title: '25 Campaign Puzzles',     desc: 'Clear 25 different campaign puzzles.' },
    { id: 'campaign-50',   kind: 'campaign', target: 50, unit: 'puzzles',   icon: 'aw-tier3',  title: '50 Campaign Puzzles',     desc: 'Clear 50 different campaign puzzles.' },
    { id: 'campaign-100',  kind: 'campaign', target: 100, unit: 'puzzles',  icon: 'aw-tier3',  title: '100 Campaign Puzzles',    desc: 'Clear 100 different campaign puzzles.' },
    { id: 'campaign-250',  kind: 'campaign', target: 250, unit: 'puzzles',  icon: 'aw-tier3',  title: '250 Campaign Puzzles',    desc: 'Clear 250 different campaign puzzles.' },
    { id: 'campaign-500',  kind: 'campaign', target: 500, unit: 'puzzles',  icon: 'aw-tier3',  title: '500 Campaign Puzzles',    desc: 'Clear 500 different campaign puzzles.' },
    { id: 'campaign-1000', kind: 'campaign', target: 1000, unit: 'puzzles', icon: 'aw-tier3',  title: 'All 1000 Campaign Puzzles', desc: 'Clear every campaign puzzle.' },
    { id: 'first-daily',   kind: 'daily',    target: 1,  unit: 'challenge', icon: 'aw-daily',  title: 'First Daily Challenge',   desc: 'Complete a Daily Challenge.' },
    { id: 'streak-7',      kind: 'streak',   target: STREAK_TARGET, unit: 'days', icon: 'aw-streak', title: 'Seven-Day Streak', desc: 'Complete the Daily Challenge on seven calendar days in a row, each on its own day.' }
  ];

  /* ---- Storage ---------------------------------------------------------------- */

  function sanitize(raw) {
    const out = { seeded: false, levels: [], unlocked: {} };
    if (!raw || typeof raw !== 'object') return out;
    out.seeded = raw.seeded === true;
    const seen = {};
    if (Array.isArray(raw.levels)) {
      raw.levels.forEach(function (n) {
        if (Number.isInteger(n) && n >= 1 && n <= AF.Levels.TOTAL && !seen[n]) { seen[n] = true; out.levels.push(n); }
      });
    }
    if (raw.unlocked && typeof raw.unlocked === 'object') {
      DEFS.forEach(function (d) {
        const v = raw.unlocked[d.id];
        // '' means "unlocked, date unknown" (found from progress saved before awards existed).
        if (typeof v === 'string') out.unlocked[d.id] = (v === '' || !isNaN(Date.parse(v))) ? v : '';
      });
    }
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

  function isUnlocked(id) { return typeof data.unlocked[id] === 'string'; }

  /* ---- Daily streak (derived from the Daily record, local calendar dates) ------- */

  function prevKey(k) {
    const p = AF.Daily.parseKey(k);
    return AF.Daily.todayKey(new Date(p.y, p.m, p.d - 1));        // calendar arithmetic, safe across DST
  }

  // Dates whose puzzle was completed on that same local date.
  function ownDayKeys() {
    const entries = AF.Daily.completedEntries(), set = {};
    Object.keys(entries).forEach(function (k) {
      const at = entries[k];
      if (!at) return;
      const d = new Date(at);
      if (!isNaN(d.getTime()) && AF.Daily.todayKey(d) === k) set[k] = true;
    });
    return set;
  }

  // Run of consecutive days ending today, or ending yesterday (today is still open, so the streak is alive).
  function currentStreak(set) {
    let k = AF.Daily.todayKey();
    if (!set[k]) k = prevKey(k);
    let n = 0;
    while (set[k] && n < 4000) { n++; k = prevKey(k); }
    return n;
  }

  function bestStreak(set) {
    let best = 0;
    Object.keys(set).forEach(function (start) {
      let k = start, n = 0;
      while (set[k] && n < 4000) { n++; k = prevKey(k); }
      if (n > best) best = n;
    });
    return best;
  }

  /* ---- Evaluation ----------------------------------------------------------------- */

  function valueOf(def, set) {
    if (def.kind === 'campaign') return data.levels.length;
    if (def.kind === 'daily') return AF.Daily.totalCompleted();
    return currentStreak(set);
  }

  // Unlocks every award whose condition is genuinely met and that is not unlocked yet.
  // `unknownDate` is for awards discovered from older saved progress, where the real date is not known.
  function evaluate(unknownDate) {
    const set = ownDayKeys(), best = bestStreak(set), fresh = [];
    const stamp = new Date().toISOString();
    DEFS.forEach(function (d) {
      if (isUnlocked(d.id)) return;
      const have = d.kind === 'streak' ? best : valueOf(d, set);
      if (have >= d.target) {
        data.unlocked[d.id] = unknownDate ? '' : stamp;
        fresh.push(d);
      }
    });
    if (fresh.length) save();
    return fresh.map(function (d) { return { id: d.id, title: d.title }; });
  }

  // First run after awards were added: credit levels the player had already cleared, without inventing dates.
  function seed() {
    if (data.seeded) return;
    const cleared = AF.Storage.completedCount();
    for (let id = 1; id <= cleared; id++) data.levels.push(id);
    data.seeded = true;
    save();
    evaluate(true);
  }

  seed();

  /* ---- Public API ---------------------------------------------------------------- */

  // Call only from the game's genuine level-complete event. Repeats are harmless.
  function recordLevel(levelId) {
    if (Number.isInteger(levelId) && levelId >= 1 && levelId <= AF.Levels.TOTAL && data.levels.indexOf(levelId) === -1) {
      data.levels.push(levelId);
      save();
    }
    return evaluate(false);
  }

  // Call after the Daily Challenge record has been written.
  function recordDaily() { return evaluate(false); }

  // Campaign reset: the unique-level tally restarts, earned awards stay.
  function resetCampaignTally() {
    data.levels = [];
    save();
  }

  function list() {
    const set = ownDayKeys();
    return DEFS.map(function (d) {
      const unlocked = isUnlocked(d.id);
      const value = valueOf(d, set);
      let note = '';
      if (!unlocked && d.kind === 'campaign' && d.target > AF.Levels.PLAYABLE) {
        note = 'Only ' + AF.Levels.PLAYABLE + ' levels are built so far, so this cannot be reached yet.';
      }
      return {
        id: d.id, title: d.title, desc: d.desc, icon: d.icon, unit: d.unit, target: d.target,
        current: unlocked ? d.target : Math.min(value, d.target),
        unlocked: unlocked, at: unlocked ? data.unlocked[d.id] : '', note: note
      };
    });
  }

  function summary() {
    const set = ownDayKeys();
    return {
      total: DEFS.length,
      unlocked: DEFS.filter(function (d) { return isUnlocked(d.id); }).length,
      campaign: data.levels.length,
      daily: AF.Daily.totalCompleted(),
      streak: currentStreak(set),
      bestStreak: bestStreak(set)
    };
  }

  AF.Achievements = {
    STREAK_TARGET: STREAK_TARGET,
    list: list,
    summary: summary,
    evaluate: function () { return evaluate(false); },
    recordLevel: recordLevel,
    recordDaily: recordDaily,
    resetCampaignTally: resetCampaignTally
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AF.Achievements;
})(typeof window !== 'undefined' ? (window.AF = window.AF || {}) : (globalThis.AF = globalThis.AF || {}));
