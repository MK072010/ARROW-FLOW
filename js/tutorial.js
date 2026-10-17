/* Interactive tutorial: a fixed 4x4 teaching puzzle with its own tiny exit rule.
   An arrow can leave when no other arrow sits in the straight line in front of its head.
   This module only runs the tutorial. It never touches saved progress; app.js decides what
   happens when it completes, is skipped, or continues (see the callbacks passed to start()). */
(function (AF) {
  'use strict';

  const U = 40;                 // must match game.js board units
  const COLS = 4, ROWS = 4;

  // cells run tail to head; dir points out of the head.
  //   a: free from the start            (step 1: the guided tap)
  //   b: blocked by c                   (step 2: the guided "blocked" demo)
  //   c: free                           d: blocked by b   (step 3: clear the rest)
  // The blocking chain is acyclic, so there is always at least one free arrow.
  const LAYOUT = [
    { cells: [[0, 3], [1, 3]], dir: [1, 0], tone: 'ink' },   // 0 a
    { cells: [[1, 2], [2, 2]], dir: [1, 0], tone: 'ink' },   // 1 b
    { cells: [[3, 1], [3, 2]], dir: [0, 1], tone: 'tide' },  // 2 c
    { cells: [[2, 0], [2, 1]], dir: [0, 1], tone: 'tide' }   // 3 d
  ];
  const A = 0, B = 1;

  const COPY = {
    tap:     { t: 'Tap the glowing arrow', b: 'Its path to the edge is clear, so it can slide out.' },
    nudge:   { t: 'Tap the glowing arrow', b: 'Tap the glowing one to carry on.' },
    blocked: { t: 'Now try this one', b: 'Does it look clear? Tap it and see.' },
    bumped:  { t: 'Blocked', b: 'Another arrow is in its way. Clear that one first.' },
    stillBlocked: { t: 'Still blocked', b: 'Clear the flashing arrow in front of it first.' },
    hint:    { t: 'Try the glowing arrow', b: 'Its path is clear.' }
  };

  let boardEl, coachTitle, coachBody, coachBox, stepsEl, skipBtn, doneEl, doneTitle, doneSub, doneBtn;
  let opts = {};
  let active = false, finished = false, proceeded = false;
  let phase = 'tap', step = 0;
  let remaining = new Set();
  let idleTimer = null, doneTimer = null, showDoneTimer = null;

  function isReduced() { return document.documentElement.dataset.motion === 'reduced'; }
  function arrowEl(i) { return boardEl.querySelector('.arrow[data-i="' + i + '"]'); }

  /* ---- Rules --------------------------------------------------------------- */

  // Index of the arrow blocking `i`, or -1 when its way out is clear.
  function blockerOf(i) {
    const a = LAYOUT[i];
    const head = a.cells[a.cells.length - 1];
    let x = head[0] + a.dir[0], y = head[1] + a.dir[1];
    while (x >= 0 && y >= 0 && x < COLS && y < ROWS) {
      for (const j of remaining) {
        if (j !== i && LAYOUT[j].cells.some(function (c) { return c[0] === x && c[1] === y; })) return j;
      }
      x += a.dir[0]; y += a.dir[1];
    }
    return -1;
  }

  function firstFree() {
    for (const i of remaining) if (blockerOf(i) === -1) return i;
    return -1;
  }

  /* ---- Presentation -------------------------------------------------------- */

  function setCoach(copy, bodyOverride) {
    coachTitle.textContent = copy.t;
    coachBody.textContent = bodyOverride || copy.b;
    if (!isReduced() && coachBox.animate) {
      coachBox.animate(
        [{ opacity: 0.35, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(.22, .8, .24, 1)' }
      );
    }
  }

  function setStep(n) {
    step = n;
    Array.from(stepsEl.children).forEach(function (pip, i) {
      pip.classList.toggle('is-done', i < n);
      pip.classList.toggle('is-current', i === n);
    });
  }

  function clearMarks() {
    boardEl.querySelectorAll('.is-target, .is-blocker').forEach(function (el) {
      el.classList.remove('is-target', 'is-blocker');
    });
  }
  function setTarget(i) {
    boardEl.querySelectorAll('.is-target').forEach(function (el) { el.classList.remove('is-target'); });
    const el = arrowEl(i);
    if (el) el.classList.add('is-target');
  }
  function setBlocker(i) {
    boardEl.querySelectorAll('.is-blocker').forEach(function (el) { el.classList.remove('is-blocker'); });
    const el = arrowEl(i);
    if (el) el.classList.add('is-blocker');
  }

  function bump(el) {
    if (isReduced() || !el.animate) return;
    const dx = Number(el.dataset.dx) * 12, dy = Number(el.dataset.dy) * 12;
    el.animate(
      [
        { transform: 'translate(0px, 0px)' },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px)', offset: 0.35 },
        { transform: 'translate(' + (-dx * 0.15) + 'px, ' + (-dy * 0.15) + 'px)', offset: 0.6 },
        { transform: 'translate(0px, 0px)' }
      ],
      { duration: 380, easing: 'ease-out' }
    );
  }

  function slideOut(i) {
    const el = arrowEl(i);
    if (!el) return;
    el.classList.remove('is-target', 'is-blocker');
    el.style.pointerEvents = 'none';
    el.removeAttribute('tabindex');
    if (isReduced() || !el.animate) { el.remove(); return; }
    const a = LAYOUT[i];
    const head = a.cells[a.cells.length - 1];
    const toEdge = a.dir[0] !== 0
      ? (a.dir[0] > 0 ? COLS - 1 - head[0] : head[0])
      : (a.dir[1] > 0 ? ROWS - 1 - head[1] : head[1]);
    const dist = (toEdge + a.cells.length + 1) * U;
    const anim = el.animate(
      [
        { transform: 'translate(0px, 0px)', opacity: 1 },
        { transform: 'translate(' + a.dir[0] * dist + 'px, ' + a.dir[1] * dist + 'px)', opacity: 0 }
      ],
      { duration: 520, easing: 'cubic-bezier(.5, 0, .9, .6)', fill: 'forwards' }
    );
    anim.onfinish = function () { el.remove(); };
  }

  /* ---- Timers -------------------------------------------------------------- */

  function clearTimers() {
    clearTimeout(idleTimer); clearTimeout(doneTimer); clearTimeout(showDoneTimer);
    idleTimer = doneTimer = showDoneTimer = null;
  }

  // If the player pauses in the free-play step, point at an arrow that can leave.
  function armIdle() {
    clearTimeout(idleTimer);
    if (!active || finished || phase !== 'clear') return;
    idleTimer = setTimeout(function () {
      if (!active || finished) return;
      const i = firstFree();
      if (i !== -1) { setTarget(i); setCoach(COPY.hint); }
    }, 6000);
  }

  /* ---- Input --------------------------------------------------------------- */

  function onPick(arrow) {
    if (!active || finished) return;
    const i = Number(arrow.dataset.i);
    if (!remaining.has(i)) return;
    AF.UI.vibrate(8);

    // Guided steps only accept the highlighted arrow.
    if ((phase === 'tap' && i !== A) || (phase === 'blocked' && i !== B)) {
      bump(arrow);
      setCoach(phase === 'tap' ? COPY.nudge : COPY.blocked);
      return;
    }

    const blocker = blockerOf(i);
    if (blocker === -1) leave(i);
    else blockedTap(i, blocker, arrow);
  }

  function leave(i) {
    remaining.delete(i);
    slideOut(i);

    if (phase === 'tap') {
      phase = 'blocked';
      setStep(1);
      setTarget(B);
      setCoach(COPY.blocked);
      return;
    }

    // Free play: drop old markers, a blocker may just have left.
    boardEl.querySelectorAll('.is-blocker, .is-target').forEach(function (el) {
      el.classList.remove('is-blocker', 'is-target');
    });
    if (remaining.size === 0) { finish(); return; }
    setStep(2);
    const n = remaining.size;
    setCoach({ t: 'Clear the board', b: n + (n === 1 ? ' arrow left.' : ' arrows left.') + ' Start with one that has a free path.' });
    armIdle();
  }

  function blockedTap(i, blocker, arrow) {
    bump(arrow);
    AF.UI.vibrate(18);
    setBlocker(blocker);
    if (phase === 'blocked') {
      phase = 'clear';                 // the explanation is shown; the player may now clear the rest in any valid order
      clearTarget();
      setCoach(COPY.bumped);
    } else {
      setCoach(COPY.stillBlocked);
    }
    armIdle();
  }
  function clearTarget() {
    boardEl.querySelectorAll('.is-target').forEach(function (el) { el.classList.remove('is-target'); });
  }

  /* ---- Finish / skip / continue ------------------------------------------- */

  function finish() {
    finished = true;
    clearTimeout(idleTimer);
    skipBtn.hidden = true;
    stepsEl.children[2].classList.add('is-done');
    stepsEl.children[2].classList.remove('is-current');
    if (opts.onComplete) opts.onComplete();   // the tutorial counts as completed from here on

    doneTitle.textContent = 'You\u2019ve got it';
    doneSub.textContent = opts.replay ? 'That\u2019s the whole idea.' : 'Starting Level 1\u2026';
    doneBtn.textContent = opts.replay ? 'Back to settings' : 'Start Level 1';

    showDoneTimer = setTimeout(function () {
      doneEl.classList.add('is-on');
      doneEl.setAttribute('aria-hidden', 'false');
      doneBtn.focus({ preventScroll: true });
    }, isReduced() ? 0 : 560);

    // Always moves on by itself; the button just does it sooner.
    doneTimer = setTimeout(proceed, isReduced() ? 1000 : 2900);
  }

  function proceed() {
    if (!active || proceeded) return;
    proceeded = true;
    clearTimers();
    if (opts.onContinue) opts.onContinue();
  }

  function skip() {
    if (!active || proceeded) return;
    proceeded = true;
    clearTimers();
    if (opts.onSkip) opts.onSkip();
  }

  /* ---- Lifecycle ------------------------------------------------------------ */

  function start(options) {
    clearTimers();
    opts = options || {};
    active = true; finished = false; proceeded = false;
    phase = 'tap';
    remaining = new Set(LAYOUT.map(function (_, i) { return i; }));

    AF.Game.drawArrows(boardEl, COLS, ROWS, LAYOUT);
    boardEl.querySelectorAll('.arrow').forEach(function (g) {
      const label = g.dataset.dx === '1' ? 'right' : g.dataset.dx === '-1' ? 'left' : g.dataset.dy === '1' ? 'down' : 'up';
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', 'Arrow pointing ' + label);
    });

    doneEl.classList.remove('is-on');
    doneEl.setAttribute('aria-hidden', 'true');
    skipBtn.hidden = false;
    Array.from(stepsEl.children).forEach(function (p) { p.classList.remove('is-done', 'is-current'); });
    setStep(0);
    setTarget(A);
    setCoach(COPY.tap);
  }

  function stop() {
    active = false;
    clearTimers();
  }

  function init() {
    boardEl = document.getElementById('tut-board');
    coachTitle = document.getElementById('tut-coach-title');
    coachBody = document.getElementById('tut-coach-body');
    coachBox = document.getElementById('tut-coach');
    stepsEl = document.getElementById('tut-steps');
    skipBtn = document.getElementById('tut-skip');
    doneEl = document.getElementById('tut-done');
    doneTitle = document.getElementById('tut-done-title');
    doneSub = document.getElementById('tut-done-sub');
    doneBtn = document.getElementById('tut-done-btn');

    boardEl.addEventListener('click', function (e) {
      const arrow = e.target.closest('.arrow');
      if (arrow && boardEl.contains(arrow)) onPick(arrow);
    });
    boardEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const arrow = e.target.closest && e.target.closest('.arrow');
      if (arrow) { e.preventDefault(); onPick(arrow); }
    });
  }

  AF.Tutorial = {
    init: init,
    start: start,
    stop: stop,
    skip: skip,
    proceed: proceed,
    isActive: function () { return active; },
    isReplay: function () { return !!opts.replay; }
  };
})(window.AF = window.AF || {});
