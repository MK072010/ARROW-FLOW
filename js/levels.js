/* Level catalogue.
   All 1000 campaign puzzles live in ONE permanent, versioned data file (data/levels.v1.json, shipped to the page as
   data/levels.v1.js so it also works offline and from file://). The pack was generated and validated once with
   tools/build-levels.js and is never regenerated at play time, so every player, device and session sees exactly the
   same layout for each level. Levels 1-50 are the original levels, unchanged.
   Puzzles are stored compactly (see tools/lib/codec.js) and decoded the first time a level is needed.
   Puzzle data here is data only: no rendering and no game rules. */
(function (AF) {
  'use strict';

  const DATA = AF.LEVEL_DATA;
  if (!DATA || DATA.format !== 'arrowflow-levels' || !Array.isArray(DATA.levels) || !DATA.levels.length) {
    throw new Error('Level data is missing: data/levels.v1.js must load before js/levels.js');
  }

  const TOTAL = DATA.levels.length;

  // Chapters 1-5 are the original ten-level chapters; later chapters hold fifty levels each.
  const CHAPTERS = [
    { name: 'Drift',   from: 1,  to: 10 },
    { name: 'Current', from: 11, to: 20 },
    { name: 'Eddy',    from: 21, to: 30 },
    { name: 'Rapids',  from: 31, to: 40 },
    { name: 'Delta',   from: 41, to: 50 }
  ];
  ['Tide', 'Lagoon', 'Cascade', 'Estuary', 'Torrent', 'Whirlpool', 'Fjord', 'Strait', 'Monsoon', 'Reef',
   'Glacier', 'Tributary', 'Aqueduct', 'Maelstrom', 'Confluence', 'Horizon', 'Harbor', 'Deluge', 'Source'
  ].forEach(function (name, i) {
    const from = 51 + i * 50;
    if (from <= TOTAL) CHAPTERS.push({ name: name, from: from, to: Math.min(TOTAL, from + 49) });
  });

  const DIR = { u: 'up', d: 'down', l: 'left', r: 'right' };
  const STEP = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  const IDS = 'abcdefghijklmnopqrstuvwxyz';
  // Same id scheme as ever: a..z, then aa, ab, ... (saved progress keeps ids under 8 characters).
  function idFor(i) { return i < 26 ? IDS[i] : IDS[Math.floor(i / 26) - 1] + IDS[i % 26]; }

  // "03uu" = tail at x0,y3 (coordinates are base 36: "a" = 10) then two steps up. The head direction is the last step.
  function decodeArrow(s, i) {
    let x = parseInt(s[0], 36), y = parseInt(s[1], 36);   // one base-36 character per coordinate (boards up to 25x25)
    const cells = [[x, y]];
    for (let k = 2; k < s.length; k++) { const d = STEP[s[k]]; x += d[0]; y += d[1]; cells.push([x, y]); }
    return { id: idFor(i), dir: DIR[s[s.length - 1]], cells: cells };
  }

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }

  function buildPuzzle(rec) {
    const puzzle = {
      id: rec.id,
      name: rec.n || 'Level ' + rec.id,
      cols: rec.c, rows: rec.r,
      arrows: rec.a.map(decodeArrow)
    };
    const sol = AF.Rules.solve(puzzle);                     // a known clearing order, kept as `solution` like before
    puzzle.solution = sol.solvable ? sol.order : [];
    return deepFreeze(puzzle);
  }

  function lazyLevel(rec) {
    let built;
    return Object.freeze({
      id: rec.id,
      size: Math.max(rec.c, rec.r),
      tier: rec.t,
      playable: true,
      get puzzle() {
        if (built === undefined) built = buildPuzzle(rec);
        return built;
      }
    });
  }

  function chapterOf(id) {
    return CHAPTERS.find(function (c) { return id >= c.from && id <= c.to; }) || CHAPTERS[CHAPTERS.length - 1];
  }

  const all = DATA.levels.map(lazyLevel);

  AF.Levels = {
    TOTAL: TOTAL,
    PLAYABLE: TOTAL,
    LIVES_PER_LEVEL: 3,
    // Used only for Daily Challenge dates before the new daily pool started (see daily.js): those dates keep their puzzles.
    DAILY_POOL: 5,
    DATA_VERSION: DATA.version,
    CHAPTERS: CHAPTERS,
    all: all,
    get: function (id) { return all[Math.max(1, Math.min(TOTAL, id)) - 1]; },
    isPlayable: function (id) { return Number.isInteger(id) && id >= 1 && id <= TOTAL && all[id - 1].playable; },
    chapterOf: chapterOf,
    // Decodes one stored record ({c, r, a: [...]}) into a puzzle. The Daily Challenge uses this for its own pool.
    fromRecord: function (rec, id) { return buildPuzzle(Object.assign({}, rec, { id: id })); }
  };
})(window.AF = window.AF || {});
