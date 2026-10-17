/* Arrow Flow rules: pure puzzle logic with no DOM and no state.
   Everything here takes plain data in and returns plain data out, so the same code runs
   in the browser and in the Node test routine (tools/test-engine.js).

   PUZZLE SHAPE
     { cols, rows, arrows: [ { id, dir, cells: [[x, y], ...] } ] }
   - x grows to the right, y grows downward; (0, 0) is the top-left cell.
   - `cells` is the arrow's ordered path from tail to head. Each step moves exactly one
     cell up, down, left or right. At least 2 cells.
   - `dir` is one of 'up' | 'down' | 'left' | 'right' and must equal the direction of the
     last step (tail to head), so the arrowhead always points along the path.

   EXIT RULE (the one rule used everywhere in the game)
     An arrow leaves like a snake: its head travels in a straight line in `dir`, and the
     body follows along the arrow's own path. Therefore the only board cells the arrow
     newly enters are the cells in the straight line in front of its head, from the cell
     after the head to the edge of the board. That line is the exit path.
     An arrow is BLOCKED if any cell of its exit path is occupied by ANY cell of another
     arrow that is still on the board. Arrows that have already exited occupy nothing.
     An arrow's own cells are never an obstacle to itself. Blocking is decided on full
     arrow bodies, never on bounding boxes. */
(function (AF) {
  'use strict';

  const DIRS = {
    up:    [0, -1],
    down:  [0, 1],
    left:  [-1, 0],
    right: [1, 0]
  };

  function key(x, y) { return x + ',' + y; }
  function inBounds(x, y, cols, rows) { return x >= 0 && y >= 0 && x < cols && y < rows; }
  function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

  // Direction name implied by the last step of the path, or null.
  function headDirection(arrow) {
    const c = arrow.cells;
    if (!c || c.length < 2) return null;
    const a = c[c.length - 2], b = c[c.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return Object.keys(DIRS).find(function (n) { return DIRS[n][0] === dx && DIRS[n][1] === dy; }) || null;
  }

  /* ---- Validation -------------------------------------------------------- */

  // Returns a list of problems; an empty list means the puzzle is structurally valid.
  function validatePuzzle(p) {
    const errors = [];
    if (!p || typeof p !== 'object') return ['puzzle is not an object'];
    if (!isInt(p.cols) || !isInt(p.rows) || p.cols < 2 || p.rows < 2) return ['invalid board size'];
    if (!Array.isArray(p.arrows) || p.arrows.length === 0) return ['puzzle has no arrows'];

    const ids = new Set();
    const owner = new Map();
    p.arrows.forEach(function (a) {
      const tag = 'arrow ' + (a && a.id);
      if (!a || typeof a.id !== 'string' || !a.id) { errors.push('arrow without a string id'); return; }
      if (ids.has(a.id)) errors.push(tag + ': duplicate id');
      ids.add(a.id);
      if (!DIRS[a.dir]) errors.push(tag + ': invalid direction');
      if (!Array.isArray(a.cells) || a.cells.length < 2) { errors.push(tag + ': needs at least 2 cells'); return; }

      a.cells.forEach(function (c, i) {
        if (!Array.isArray(c) || !isInt(c[0]) || !isInt(c[1])) { errors.push(tag + ': cell ' + i + ' is not a grid coordinate'); return; }
        if (!inBounds(c[0], c[1], p.cols, p.rows)) errors.push(tag + ': cell ' + i + ' is off the board');
        const k = key(c[0], c[1]);
        if (owner.has(k)) errors.push(tag + ': cell ' + k + ' overlaps ' + (owner.get(k) === a.id ? 'itself' : 'arrow ' + owner.get(k)));
        else owner.set(k, a.id);
        if (i > 0) {
          const q = a.cells[i - 1];
          if (Math.abs(c[0] - q[0]) + Math.abs(c[1] - q[1]) !== 1) errors.push(tag + ': cells ' + (i - 1) + ' and ' + i + ' are not adjacent');
        }
      });
      if (DIRS[a.dir] && headDirection(a) !== a.dir) errors.push(tag + ': arrowhead direction does not match the path');
    });
    return errors;
  }

  /* ---- Exit logic --------------------------------------------------------- */

  // In-board cells in front of the head, nearest first. Empty when the head is already on the edge.
  function exitPathCells(arrow, cols, rows) {
    const d = DIRS[arrow.dir];
    const head = arrow.cells[arrow.cells.length - 1];
    const out = [];
    let x = head[0] + d[0], y = head[1] + d[1];
    while (inBounds(x, y, cols, rows)) {
      out.push([x, y]);
      x += d[0]; y += d[1];
    }
    return out;
  }

  /* Decides whether `arrow` can leave, given the arrows currently on the board.
     `activeArrows` may include `arrow` itself; it is ignored. Returns
     { clear, blockerId, pathCells }, where blockerId is the nearest blocking arrow (or null). */
  function analyzeExit(arrow, activeArrows, cols, rows) {
    const occupied = new Map();
    activeArrows.forEach(function (o) {
      if (o.id === arrow.id) return;
      o.cells.forEach(function (c) { occupied.set(key(c[0], c[1]), o.id); });
    });
    const pathCells = exitPathCells(arrow, cols, rows);
    let blockerId = null;
    for (let i = 0; i < pathCells.length; i++) {
      const hit = occupied.get(key(pathCells[i][0], pathCells[i][1]));
      if (hit) { blockerId = hit; break; }
    }
    return { clear: blockerId === null, blockerId: blockerId, pathCells: pathCells };
  }

  /* ---- Solving ------------------------------------------------------------ */

  // Removing an arrow can only free cells, never block anything, so a puzzle is solvable
  // exactly when repeatedly removing any free arrow empties the board. There are no dead ends.
  // Returns { solvable, order, rounds, stuck } where `rounds` is the length of the longest
  // dependency chain (all currently free arrows leave together each round).
  function solve(p) {
    let active = p.arrows.slice();
    const order = [];
    let rounds = 0;
    while (active.length) {
      const free = active.filter(function (a) { return analyzeExit(a, active, p.cols, p.rows).clear; });
      if (!free.length) break;
      free.forEach(function (a) { order.push(a.id); });
      const gone = new Set(free.map(function (a) { return a.id; }));
      active = active.filter(function (a) { return !gone.has(a.id); });
      rounds++;
    }
    return { solvable: active.length === 0, order: order, rounds: rounds, stuck: active.map(function (a) { return a.id; }) };
  }

  // Plays `sequence` move by move. Returns { ok, failedAt, cleared } where failedAt is the index of the
  // first move that was illegal (blocked, unknown or repeated), or -1.
  function verifySequence(p, sequence) {
    let active = p.arrows.slice();
    for (let i = 0; i < sequence.length; i++) {
      const a = active.find(function (x) { return x.id === sequence[i]; });
      if (!a || !analyzeExit(a, active, p.cols, p.rows).clear) return { ok: false, failedAt: i, cleared: false };
      active = active.filter(function (x) { return x !== a; });
    }
    return { ok: true, failedAt: -1, cleared: active.length === 0 };
  }

  /* ---- Animation geometry ------------------------------------------------- */

  // Polyline (in board units) that the arrow travels along when leaving: its own path from the tail,
  // then the straight exit line, continuing far enough past the edge for the whole body to clear it.
  // `unit` is the size of one cell in board units.
  function travelPolyline(arrow, cols, rows, unit) {
    const d = DIRS[arrow.dir];
    const pts = arrow.cells.map(function (c) { return [c[0] * unit + unit / 2, c[1] * unit + unit / 2]; });
    const head = arrow.cells[arrow.cells.length - 1];
    const toEdge = exitPathCells(arrow, cols, rows).length;       // cells in front of the head
    const extra = toEdge + arrow.cells.length + 1;                 // head clears the edge, then the body follows
    const last = pts[pts.length - 1];
    pts.push([last[0] + d[0] * extra * unit, last[1] + d[1] * extra * unit]);
    return pts;
  }

  AF.Rules = {
    DIRS: DIRS,
    headDirection: headDirection,
    validatePuzzle: validatePuzzle,
    exitPathCells: exitPathCells,
    analyzeExit: analyzeExit,
    solve: solve,
    verifySequence: verifySequence,
    travelPolyline: travelPolyline
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AF.Rules;
})(typeof window !== 'undefined' ? (window.AF = window.AF || {}) : (globalThis.AF = globalThis.AF || {}));
