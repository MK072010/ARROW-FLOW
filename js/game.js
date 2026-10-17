/* Game engine: the single authoritative state for a play session, and the input that drives it.
   Rules live in rules.js (pure), drawing in render.js, level data in levels.js, saving in storage.js.
   This module wires them together and never saves or navigates by itself: it reports through the
   callbacks given to configure(), and app.js decides what to do (save, show the complete screen).

   STATE (all of it lives in `S`):
     levelId, puzzle        which level is loaded and its immutable data
     active / exited        arrow ids still on the board / ids that finished leaving, in order
     lock                   id of the arrow currently animating out (null when idle)
     status                 'idle' | 'playing' | 'paused' | 'complete' | 'failed'
     completionFired        guard so the completion callback runs at most once per load

   An arrow is only removed from `active` when its exit animation FINISHES (removeExitedArrow).
   While it is animating it is still active and locked, so nothing else can move and nothing
   transient is ever saved. */
(function (AF) {
  'use strict';

  const Rules = AF.Rules, Render = AF.Render;
  const MAX_LIVES = AF.Levels.LIVES_PER_LEVEL || 3;

  const S = {
    levelId: null,        // campaign level id (null in a daily session)
    mode: 'campaign',     // 'campaign' | 'daily'
    dateKey: null,        // 'YYYY-MM-DD' of the daily being played
    puzzle: null,
    byId: null,           // id -> arrow data
    active: [],           // arrow ids on the board
    exited: [],           // arrow ids that have left, in order
    lives: MAX_LIVES,     // a blocked tap costs one life
    lock: null,           // id of the arrow animating out
    status: 'idle',
    completionFired: false
  };

  let board = null;                 // the container element, set once by init()
  let bound = new WeakSet();        // containers that already have our listeners
  let cb = {};                      // callbacks: onChange, onExited, onBlocked, onComplete
  let anim = null;                  // { id, ctl } for the running exit animation
  let rafId = 0, lastTs = 0;
  let hintTimer = 0;                // clears the hint highlight after a short while

  function emit(name, arg) { if (cb[name]) cb[name](arg); }

  function boardLabel() {
    return 'Puzzle board, ' + (S.mode === 'daily' ? 'daily challenge' : 'level ' + S.levelId) + ', ' + S.active.length + ' arrows left';
  }

  function snapshot() {
    return {
      mode: S.mode,
      dateKey: S.dateKey,
      levelId: S.levelId,
      total: S.puzzle ? S.puzzle.arrows.length : 0,
      cleared: S.exited.length,
      status: S.status,
      lives: S.lives,
      maxLives: MAX_LIVES,
      exited: S.exited.slice(),
      // Undo steps back through S.exited (the order arrows left in), so it needs no separate history.
      canUndo: S.status === 'playing' && S.exited.length > 0
    };
  }

  function activeArrows() { return S.active.map(function (id) { return S.byId[id]; }); }

  /* ---- Rendering --------------------------------------------------------------- */

  // Redraws the board from state. Only active arrows are drawn.
  function renderBoard() {
    if (!board || !S.puzzle) return;
    Render.drawPuzzle(board, S.puzzle, activeArrows());
    board.setAttribute('aria-label', boardLabel());
  }

  /* ---- Rules bridge --------------------------------------------------------------- */

  function exitInfo(arrowId) {
    const a = S.byId && S.byId[arrowId];
    if (!a || S.active.indexOf(arrowId) === -1) return { clear: false, blockerId: null, pathCells: [], active: false };
    const r = Rules.analyzeExit(a, activeArrows(), S.puzzle.cols, S.puzzle.rows);
    return { clear: r.clear, blockerId: r.blockerId, pathCells: r.pathCells, active: true };
  }

  // True when the arrow is on the board and its whole exit path is free of other active arrows.
  function canArrowExit(arrowId) {
    const info = exitInfo(arrowId);
    return info.active && info.clear;
  }

  /* ---- Moves ---------------------------------------------------------------------- */

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function loop(ts) {
    rafId = 0;
    if (!anim) return;
    const dt = Math.min(50, lastTs ? ts - lastTs : 16);   // clamp: a backgrounded tab must not skip the animation
    lastTs = ts;
    if (S.status === 'playing') {                         // paused: time simply does not advance
      if (anim.ctl.step(dt)) { const id = anim.id; anim = null; removeExitedArrow(id); return; }
    }
    rafId = requestAnimationFrame(loop);
  }

  /* Player tapped an arrow. Returns 'ignored' | 'blocked' | 'moving'.
     A blocked tap costs one life. A clear tap locks input and animates; state changes only in
     removeExitedArrow() once the animation is over. */
  function attemptArrowMove(arrowId) {
    if (S.status !== 'playing') return 'ignored';
    if (S.lock !== null) return 'ignored';                // one exit at a time
    if (S.active.indexOf(arrowId) === -1) return 'ignored';   // unknown or already exited

    clearHint();
    const info = exitInfo(arrowId);
    if (!info.clear) {
      const el = Render.arrowEl(board, arrowId);
      if (el) { Render.bump(el); Render.markBlocked(board, arrowId, info.blockerId); }
      S.lives = Math.max(0, S.lives - 1);
      const outOfLives = S.lives === 0;
      if (outOfLives) S.status = 'failed';
      const blocked = {
        arrowId: arrowId,
        blockerId: info.blockerId,
        lives: S.lives,
        maxLives: MAX_LIVES,
        outOfLives: outOfLives
      };
      emit('onChange', snapshot());
      emit('onBlocked', blocked);
      return 'blocked';
    }

    S.lock = arrowId;
    const el = Render.arrowEl(board, arrowId);
    const reduced = document.documentElement.dataset.motion === 'reduced';
    if (!el || reduced || !window.requestAnimationFrame) {
      removeExitedArrow(arrowId);                         // no animation to wait for
      return 'moving';
    }
    anim = { id: arrowId, ctl: Render.createExit(el, S.byId[arrowId], S.puzzle.cols, S.puzzle.rows) };
    lastTs = 0;
    rafId = requestAnimationFrame(loop);
    return 'moving';
  }

  /* The ONLY place an arrow leaves the active set. Safe to call twice: the second call does nothing,
     so an arrow can never be removed (or counted) twice. */
  function removeExitedArrow(arrowId) {
    const i = S.active.indexOf(arrowId);
    if (i === -1) return false;
    S.active.splice(i, 1);
    S.exited.push(arrowId);
    if (S.lock === arrowId) S.lock = null;
    if (anim && anim.id === arrowId) { anim = null; stopLoop(); }
    const el = Render.arrowEl(board, arrowId);
    if (el) el.remove();
    if (board) board.setAttribute('aria-label', boardLabel());
    emit('onExited', snapshot());       // the move is complete: this is the moment it may be saved
    emit('onChange', snapshot());
    checkLevelCompletion();
    return true;
  }

  /* Complete only when every arrow of the level has exited. Fires onComplete at most once per load. */
  function checkLevelCompletion() {
    if (S.status !== 'playing' || S.completionFired) return false;
    if (!S.puzzle || S.active.length !== 0 || S.exited.length !== S.puzzle.arrows.length) return false;
    S.completionFired = true;
    S.status = 'complete';
    if (board) board.classList.add('is-solved');        // short celebratory glow; removed on the next load
    if (S.mode === 'daily') emit('onDailyComplete', S.dateKey);   // never reaches the campaign onComplete
    else emit('onComplete', S.levelId);
    return true;
  }

  /* ---- Lifecycle -------------------------------------------------------------------- */

  function cancelAnimation() {
    stopLoop();
    anim = null;
    S.lock = null;
    clearHint();
  }

  /* ---- Hint and Undo ----------------------------------------------------------------- */

  function clearHint() {
    clearTimeout(hintTimer);
    hintTimer = 0;
    if (board) Render.clearHint(board);
  }

  /* Picks an arrow that can leave right now, using the same exit check as a real tap (exitInfo).
     Among the free arrows it prefers the one standing in the way of the most other arrows. */
  function pickHint() {
    const free = S.active.filter(canArrowExit);
    if (!free.length) return null;
    const weight = {};
    S.active.forEach(function (id) {
      const info = exitInfo(id);
      if (info.active && !info.clear && info.blockerId) weight[info.blockerId] = (weight[info.blockerId] || 0) + 1;
    });
    let best = free[0];
    free.forEach(function (id) { if ((weight[id] || 0) > (weight[best] || 0)) best = id; });
    return best;
  }

  /* Highlights one legal arrow. Never moves it. Returns { status: 'ok', arrowId } | { status: 'none' } | { status: 'ignored' }. */
  function hint() {
    if (S.status !== 'playing' || S.lock !== null) return { status: 'ignored' };
    clearHint();
    const id = pickHint();
    const el = id ? Render.arrowEl(board, id) : null;
    if (!el) return { status: 'none' };
    Render.markHint(el);
    hintTimer = setTimeout(clearHint, 3200);
    return { status: 'ok', arrowId: id };
  }

  /* Puts the most recently exited arrow back on the board. Only valid moves are ever in S.exited, so a blocked
     tap can never be restored. Not available once the level is complete (so completion and rewards cannot repeat).
     Returns { status: 'ok', arrowId } | { status: 'empty' } | { status: 'busy' } | { status: 'ignored' }. */
  function undo() {
    if (S.status !== 'playing') return { status: 'ignored' };
    if (S.lock !== null) return { status: 'busy' };
    if (!S.exited.length) return { status: 'empty' };
    const id = S.exited[S.exited.length - 1];
    if (!S.byId[id] || S.active.indexOf(id) !== -1) return { status: 'ignored' };

    clearHint();
    S.exited.pop();
    const order = {};
    S.puzzle.arrows.forEach(function (a, i) { order[a.id] = i; });
    S.active.push(id);
    S.active.sort(function (a, b) { return order[a] - order[b]; });
    renderBoard();
    const el = Render.arrowEl(board, id);
    if (el) Render.markRestored(el);
    emit('onUndo', snapshot());
    emit('onChange', snapshot());
    return { status: 'ok', arrowId: id };
  }

  /* Loads a playable level from scratch. `restoreExited` (optional) is an ordered list of arrow ids that had
     already left in an earlier session; it is applied only if replaying it under the rules is legal.
     Returns a snapshot, or null when the level has no valid puzzle. */
  function loadLevel(levelId, restoreProgress) {
    cancelAnimation();
    const level = AF.Levels.get(levelId);
    if (!level || !level.playable || level.id !== levelId) { S.status = 'idle'; return null; }
    const problems = Rules.validatePuzzle(level.puzzle);
    if (problems.length || !Rules.solve(level.puzzle).solvable) {
      if (window.console) console.error('Level ' + levelId + ' is not a valid, solvable puzzle', problems);
      S.status = 'idle';
      return null;
    }

    const restoreExited = Array.isArray(restoreProgress)
      ? restoreProgress
      : restoreProgress && Array.isArray(restoreProgress.exited) ? restoreProgress.exited : null;
    const restoreLives = restoreProgress && !Array.isArray(restoreProgress)
      ? restoreProgress.lives
      : MAX_LIVES;
    return begin(level.puzzle, level.id, 'campaign', null, restoreExited, restoreLives);
  }

  /* Removes board rows and columns that no arrow touches, so sparse puzzles fill the screen.
     Rules are unaffected: an arrow's path only ever meets cells in its own rows/columns, and an
     empty row/column holds no cells. Returns a copy; the stored level data is never changed. */
  function compact(p) {
    const xs = new Set(), ys = new Set();
    p.arrows.forEach(function (a) { a.cells.forEach(function (c) { xs.add(c[0]); ys.add(c[1]); }); });
    const mx = {}, my = {};
    Array.from(xs).sort(function (a, b) { return a - b; }).forEach(function (v, i) { mx[v] = i; });
    Array.from(ys).sort(function (a, b) { return a - b; }).forEach(function (v, i) { my[v] = i; });
    if (xs.size === p.cols && ys.size === p.rows) return p;
    const out = {};
    Object.keys(p).forEach(function (k) { out[k] = p[k]; });
    out.sizeLabel = p.cols + '\u00D7' + p.rows;
    out.cols = xs.size; out.rows = ys.size;
    out.arrows = p.arrows.map(function (a) {
      const n = {};
      Object.keys(a).forEach(function (k) { n[k] = a[k]; });
      n.cells = a.cells.map(function (c) { return [mx[c[0]], my[c[1]]]; });
      return n;
    });
    return out;
  }

  // Shared start routine: the same state, rules and completion guard serve campaign and daily puzzles.
  function begin(puzzle, levelId, mode, dateKey, restoreExited, restoreLives) {
    S.levelId = levelId;
    S.mode = mode;
    S.dateKey = dateKey;
    puzzle = compact(puzzle);
    S.puzzle = puzzle;
    S.byId = {};
    puzzle.arrows.forEach(function (a) { S.byId[a.id] = a; });
    S.active = puzzle.arrows.map(function (a) { return a.id; });
    S.exited = [];
    S.lives = Number.isInteger(restoreLives)
      ? Math.max(1, Math.min(MAX_LIVES, restoreLives))
      : MAX_LIVES;
    S.lock = null;
    S.completionFired = false;
    S.status = 'playing';
    if (board) board.classList.remove('is-solved');

    if (Array.isArray(restoreExited) && restoreExited.length && restoreExited.length < S.active.length) {
      const seen = new Set(restoreExited);
      const check = Rules.verifySequence(puzzle, restoreExited);
      if (seen.size === restoreExited.length && check.ok && !check.cleared) {
        S.exited = restoreExited.slice();
        S.active = S.active.filter(function (id) { return !seen.has(id); });
      }
    }

    renderBoard();
    emit('onChange', snapshot());
    return snapshot();
  }

  /* Loads a daily puzzle (already selected by AF.Daily). It is re-validated here with the real rules.
     It touches no campaign data: levelId is null and completion is reported through onDailyComplete. */
  function loadDaily(dateKey, puzzle) {
    cancelAnimation();
    if (typeof dateKey !== 'string' || !puzzle || Rules.validatePuzzle(puzzle).length || !Rules.solve(puzzle).solvable) {
      S.status = 'idle';
      return null;
    }
    return begin(puzzle, null, 'daily', dateKey, null);
  }

  // Reloads the current level from its original data: every arrow is back on the board.
  function restartLevel() {
    let snap;
    if (S.mode === 'daily') {
      if (!S.dateKey || !S.puzzle) return null;
      snap = loadDaily(S.dateKey, S.puzzle);
    } else {
      if (S.levelId === null) return null;
      snap = loadLevel(S.levelId);
    }
    emit('onRestart', snap);
    return snap;
  }

  function pauseGame() {
    if (S.status !== 'playing') return false;
    S.status = 'paused';
    return true;
  }

  function resumeGame() {
    if (S.status !== 'paused') return false;
    S.status = 'playing';
    lastTs = 0;
    if (anim && !rafId) rafId = requestAnimationFrame(loop);
    return true;
  }

  // Leaving the board (back to menus). Any half-finished exit is abandoned, never counted.
  function leave() {
    cancelAnimation();
    if (S.status !== 'complete') S.status = 'idle';
  }

  /* ---- Input --------------------------------------------------------------------------- */

  function arrowFrom(target) {
    const g = target && target.closest ? target.closest('.arrow[data-id]') : null;
    return g && board && board.contains(g) ? g : null;
  }

  // Binds listeners once per container, however many times init() is called.
  function init(container, callbacks) {
    board = container;
    cb = callbacks || {};
    if (bound.has(container)) return;
    bound.add(container);
    // 'click' is unified: it fires for touch taps, mouse and pen alike, and for keyboard activation.
    container.addEventListener('click', function (e) {
      const g = arrowFrom(e.target);
      if (g) attemptArrowMove(g.dataset.id);
    });
    container.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const g = arrowFrom(e.target);
      if (g) { e.preventDefault(); attemptArrowMove(g.dataset.id); }
    });
  }

  /* ---- Decorative boards (home hero) ----------------------------------------------------- */

  // Not puzzles: taps on these only give feedback. They share no state with the engine.
  function bindDecor(container, onTap) {
    if (bound.has(container)) return;
    bound.add(container);
    container.addEventListener('click', function (e) {
      const arrow = e.target.closest('.arrow');
      if (!arrow || !container.contains(arrow)) return;
      Render.bump(arrow);
      if (onTap) onTap();
    });
  }

  AF.Game = {
    init: init,
    loadLevel: loadLevel,
    loadDaily: loadDaily,
    getPuzzle: function () { return S.puzzle; },
    renderBoard: renderBoard,
    canArrowExit: canArrowExit,
    getExitInfo: exitInfo,
    attemptArrowMove: attemptArrowMove,
    hint: hint,
    undo: undo,
    removeExitedArrow: removeExitedArrow,
    checkLevelCompletion: checkLevelCompletion,
    restartLevel: restartLevel,
    pauseGame: pauseGame,
    resumeGame: resumeGame,
    leave: leave,
    getState: snapshot,
    isBusy: function () { return S.lock !== null; },

    // Shared with the home hero and the tutorial (decoration / teaching only).
    buildBoard: Render.buildDecor,
    drawArrows: Render.drawArrows,
    bindBoard: bindDecor
  };
})(window.AF = window.AF || {});
