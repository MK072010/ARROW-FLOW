/* Rendering: turns arrow data into crisp SVG and computes animation frames.
   It owns NO game state and NO rules. It is told what to draw and (for the exit animation)
   how far along the animation is. Markup and classes are shared by the home hero, the tutorial
   and the playable board, so every arrow looks identical everywhere. */
(function (AF) {
  'use strict';

  const U = 40;                       // board units per cell (the tutorial uses the same value)
  const HEAD_LEN = 12;                // arrowhead tip, past the head cell's centre
  const HEAD_BACK = 2, HEAD_HALF = 10;
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const r1 = function (n) { return Math.round(n * 10) / 10; };
  const center = function (c) { return [c[0] * U + U / 2, c[1] * U + U / 2]; };
  const NAMES = { '1,0': 'right', '-1,0': 'left', '0,1': 'down', '0,-1': 'up' };

  /* ---- Geometry helpers ---------------------------------------------------- */

  function lineD(pts) {
    return 'M' + pts.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join('L');
  }

  function headD(end, dx, dy) {
    const px = -dy, py = dx;
    const tip = [end[0] + dx * HEAD_LEN, end[1] + dy * HEAD_LEN];
    const b1 = [end[0] - dx * HEAD_BACK + px * HEAD_HALF, end[1] - dy * HEAD_BACK + py * HEAD_HALF];
    const b2 = [end[0] - dx * HEAD_BACK - px * HEAD_HALF, end[1] - dy * HEAD_BACK - py * HEAD_HALF];
    return 'M' + r1(tip[0]) + ' ' + r1(tip[1]) + 'L' + r1(b1[0]) + ' ' + r1(b1[1]) + 'L' + r1(b2[0]) + ' ' + r1(b2[1]) + 'Z';
  }

  function polyLength(pts) {
    let n = 0;
    for (let i = 1; i < pts.length; i++) n += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    return n;                          // all segments are axis-aligned
  }

  // Part of an axis-aligned polyline between arc lengths `from` and `to`, plus the unit direction at `to`.
  function slice(pts, from, to) {
    const out = [];
    let acc = 0, dir = [1, 0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
      const ux = len ? Math.sign(b[0] - a[0]) : 0, uy = len ? Math.sign(b[1] - a[1]) : 0;
      const s0 = acc, s1 = acc + len;
      if (s1 > from && s0 < to) {
        const lo = Math.max(from, s0), hi = Math.min(to, s1);
        if (!out.length) out.push([a[0] + ux * (lo - s0), a[1] + uy * (lo - s0)]);
        out.push([a[0] + ux * (hi - s0), a[1] + uy * (hi - s0)]);
        dir = [ux, uy];
      }
      acc = s1;
    }
    return { pts: out, dir: dir };
  }

  /* ---- Markup ---------------------------------------------------------------- */

  // arrow: { cells: [[x, y], ...] tail to head, dir: [dx, dy], tone, id? (game arrows), index? (tutorial) }
  function arrowMarkup(a, index, tone) {
    const pts = a.cells.map(center);
    const end = pts[pts.length - 1];
    const dx = a.dir[0], dy = a.dir[1];
    const d = lineD(pts);
    const ident = a.id !== undefined ? ' data-id="' + a.id + '"' : '';
    return '<g class="arrow arrow--' + tone + '" data-dx="' + dx + '" data-dy="' + dy + '" data-i="' + index + '"' + ident + '>' +
      '<path class="arrow__hit" d="' + d + '"/>' +
      '<path class="arrow__line" d="' + d + '"/>' +
      '<path class="arrow__head" d="' + headD(end, dx, dy) + '"/></g>';
  }

  // crop (optional): { x0, y0, x1, y1 } in cells, inclusive. Used by the game board to drop empty margins.
  function boardMarkup(cols, rows, arrows, accentIndex, crop) {
    const c = crop || { x0: 0, y0: 0, x1: cols - 1, y1: rows - 1 };
    let s = '<svg class="board__svg" viewBox="' + c.x0 * U + ' ' + c.y0 * U + ' ' + (c.x1 - c.x0 + 1) * U + ' ' + (c.y1 - c.y0 + 1) * U + '" focusable="false">';
    for (let y = c.y0; y <= c.y1; y++) {
      for (let x = c.x0; x <= c.x1; x++) {
        s += '<circle class="dot" cx="' + (x * U + U / 2) + '" cy="' + (y * U + U / 2) + '" r="1.8"/>';
      }
    }
    arrows.forEach(function (a, i) { s += arrowMarkup(a, i, i === accentIndex ? 'accent' : a.tone); });
    return s + '</svg>';
  }

  // Draws a caller-supplied arrow set (tutorial). Same shape as arrowMarkup.
  function drawArrows(container, cols, rows, arrows) {
    container.innerHTML = boardMarkup(cols, rows, arrows, -1);
  }

  /* ---- Playable board --------------------------------------------------------- */

  function toneFor(i) { return 'c' + (i % 8); }

  /* Draws the puzzle's arrows. `activeArrows` are puzzle arrows (named directions) still on the board;
     `order` maps arrow id -> its position in the puzzle so tones stay stable as arrows leave. */
  function drawPuzzle(container, puzzle, activeArrows) {
    const index = {};
    puzzle.arrows.forEach(function (a, i) { index[a.id] = i; });
    const shaped = activeArrows.map(function (a) {
      const v = AF.Rules.DIRS[a.dir];
      return { id: a.id, cells: a.cells, dir: v, tone: toneFor(index[a.id]) };
    });
    // Crop to the area the puzzle's arrows actually use (from the full puzzle, so the view never shifts mid-game).
    const crop = { x0: puzzle.cols, y0: puzzle.rows, x1: 0, y1: 0 };
    puzzle.arrows.forEach(function (a) {
      a.cells.forEach(function (c) {
        crop.x0 = Math.min(crop.x0, c[0]); crop.x1 = Math.max(crop.x1, c[0]);
        crop.y0 = Math.min(crop.y0, c[1]); crop.y1 = Math.max(crop.y1, c[1]);
      });
    });
    container.style.setProperty('--bw', crop.x1 - crop.x0 + 1);
    container.style.setProperty('--bh', crop.y1 - crop.y0 + 1);
    container.innerHTML = boardMarkup(puzzle.cols, puzzle.rows, shaped, -1, crop);
    // Re-number data-i to the puzzle index, and make every arrow a real, labelled button.
    Array.from(container.querySelectorAll('.arrow')).forEach(function (g, k) {
      const a = activeArrows[k];
      g.setAttribute('data-i', String(index[a.id]));
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', 'Arrow ' + (index[a.id] + 1) + ', pointing ' + a.dir);
    });
  }

  function arrowEl(container, id) {
    return container.querySelector('.arrow[data-id="' + id + '"]');
  }

  /* ---- Exit animation ----------------------------------------------------------- */

  /* Creates a controller that moves one arrow out along its travel line. It is driven by
     step(ms) so the game can pause it; it never touches game state.
     The arrow slides like a snake: a window of the arrow's own length moves along
     (its path + the straight exit line). Returns { step(ms) -> done, finish() }. */
  function createExit(el, arrow, cols, rows) {
    const poly = AF.Rules.travelPolyline(arrow, cols, rows, U);
    const bodyLen = (arrow.cells.length - 1) * U;
    const travel = polyLength(poly) - bodyLen;           // head has gone so far that the tail is off the board
    const duration = Math.max(300, Math.min(620, travel * 1.7));
    const line = el.querySelector('.arrow__line');
    const hit = el.querySelector('.arrow__hit');
    const head = el.querySelector('.arrow__head');
    let t = 0;

    el.classList.add('is-leaving');
    el.style.pointerEvents = 'none';
    el.removeAttribute('tabindex');

    function frame(p) {
      const s = travel * p;
      const part = slice(poly, s, s + bodyLen);
      if (part.pts.length < 2) return;
      const d = lineD(part.pts);
      line.setAttribute('d', d);
      hit.setAttribute('d', d);
      head.setAttribute('d', headD(part.pts[part.pts.length - 1], part.dir[0], part.dir[1]));
      // Fade only over the last stretch, after the arrow has crossed the board edge.
      const fadeFrom = 0.78;
      el.style.opacity = p > fadeFrom ? String(Math.max(0, 1 - (p - fadeFrom) / (1 - fadeFrom))) : '1';
    }

    return {
      duration: duration,
      step: function (ms) {
        t += ms;
        const x = Math.min(1, t / duration);
        frame(Math.pow(x, 1.6));                        // gentle acceleration, like being pulled out
        return x >= 1;
      },
      finish: function () { frame(1); }
    };
  }

  /* ---- Feedback ------------------------------------------------------------------ */

  function isReduced() { return document.documentElement.dataset.motion === 'reduced'; }

  // Blocked: a short push toward the obstacle that springs back. Never changes the arrow's data.
  function bump(el) {
    if (isReduced() || !el.animate) return;
    const dx = Number(el.dataset.dx) * 7, dy = Number(el.dataset.dy) * 7;
    el.animate(
      [
        { transform: 'translate(0px, 0px)' },
        { transform: 'translate(' + dx + 'px, ' + dy + 'px)', offset: 0.35 },
        { transform: 'translate(' + (-dx * 0.2) + 'px, ' + (-dy * 0.2) + 'px)', offset: 0.65 },
        { transform: 'translate(0px, 0px)' }
      ],
      { duration: 340, easing: 'ease-out' }
    );
  }

  // Colour cue (works with motion off): the tapped arrow and the one in its way tint briefly.
  function markBlocked(container, arrowId, blockerId) {
    const a = arrowEl(container, arrowId), b = arrowEl(container, blockerId);
    [a, b].forEach(function (el) { if (el) { el.classList.remove('is-blocked-tap', 'is-blocked-by'); void el.getBoundingClientRect(); } });
    if (a) a.classList.add('is-blocked-tap');
    if (b) b.classList.add('is-blocked-by');
    setTimeout(function () {
      if (a) a.classList.remove('is-blocked-tap');
      if (b) b.classList.remove('is-blocked-by');
    }, 650);
  }

  // Hint: a pulsing saffron highlight on an arrow that can leave. Purely visual.
  function markHint(el) { if (el) el.classList.add('is-hint'); }
  function clearHint(container) {
    Array.from(container.querySelectorAll('.arrow.is-hint')).forEach(function (el) { el.classList.remove('is-hint'); });
  }

  // Undo: the restored arrow eases back in (the stylesheet drops this when motion is reduced).
  function markRestored(el) {
    if (!el) return;
    el.classList.add('is-restored');
    setTimeout(function () { el.classList.remove('is-restored'); }, 450);
  }

  /* ---- Decorative boards (home hero) --------------------------------------------- */

  function mulberry32(s) {
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rand) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    return list;
  }

  // Decoration only: a seeded scatter of arrows. It is never used as puzzle data.
  function generateDecor(cols, rows, seed, target) {
    const rand = mulberry32(seed);
    const taken = new Uint8Array(cols * rows);
    const at = function (x, y) { return y * cols + x; };
    const isFree = function (x, y) { return x >= 0 && y >= 0 && x < cols && y < rows && !taken[at(x, y)]; };
    const arrows = [];
    for (let tries = 0; tries < target * 40 && arrows.length < target; tries++) {
      const sx = Math.floor(rand() * cols), sy = Math.floor(rand() * rows);
      if (!isFree(sx, sy)) continue;
      const want = 2 + Math.floor(rand() * 4);
      const cells = [[sx, sy]];
      const used = new Set([at(sx, sy)]);
      let dir = DIRS4[Math.floor(rand() * 4)];
      while (cells.length < want) {
        const last = cells[cells.length - 1];
        const options = rand() < 0.6
          ? [dir].concat(shuffle(DIRS4.filter(function (d) { return d !== dir; }), rand))
          : shuffle(DIRS4.slice(), rand);
        let moved = false;
        for (const d of options) {
          const nx = last[0] + d[0], ny = last[1] + d[1];
          if (isFree(nx, ny) && !used.has(at(nx, ny))) { cells.push([nx, ny]); used.add(at(nx, ny)); dir = d; moved = true; break; }
        }
        if (!moved) break;
      }
      if (cells.length < 2) continue;
      cells.forEach(function (c) { taken[at(c[0], c[1])] = 1; });
      const end = cells[cells.length - 1], before = cells[cells.length - 2];
      arrows.push({ cells: cells, dir: [end[0] - before[0], end[1] - before[1]], tone: rand() < 0.3 ? 'tide' : 'ink' });
    }
    return arrows;
  }

  function buildDecor(container, opts) {
    const arrows = generateDecor(opts.cols, opts.rows, opts.seed, opts.count);
    let accentIndex = -1;
    if (opts.accent) {
      let longest = 0;
      arrows.forEach(function (a, i) { if (a.cells.length > longest) { longest = a.cells.length; accentIndex = i; } });
    }
    container.innerHTML = boardMarkup(opts.cols, opts.rows, arrows, accentIndex);
    return arrows.length;
  }

  AF.Render = {
    U: U,
    NAMES: NAMES,
    drawArrows: drawArrows,
    drawPuzzle: drawPuzzle,
    arrowEl: arrowEl,
    createExit: createExit,
    bump: bump,
    markBlocked: markBlocked,
    markHint: markHint,
    clearHint: clearHint,
    markRestored: markRestored,
    buildDecor: buildDecor
  };
})(window.AF = window.AF || {});
