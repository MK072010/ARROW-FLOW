/* Level catalogue.
   - Levels 1-5 are hand-made puzzles (see `puzzles` below), plain data in the shape described in rules.js.
   - Levels 6-35 are also hand-authored fixed puzzles in `puzzles`.
   - Levels 36-50 are still built from fixed per-level seeds (see "Levels 6-50" below), in the same data shape.
   Puzzle data here is data only: no rendering and no game rules. */
(function (AF) {
  'use strict';

  const TOTAL = 50;

  const CHAPTERS = [
    { name: 'Drift',   from: 1,  to: 10 },
    { name: 'Current', from: 11, to: 20 },
    { name: 'Eddy',    from: 21, to: 30 },
    { name: 'Rapids',  from: 31, to: 40 },
    { name: 'Delta',   from: 41, to: 50 }
  ];

  // Grid coordinates: [x, y], x to the right, y downward, (0, 0) top-left. `cells` run tail to head.
  const puzzles = [
    {
      name: 'First Steps',
      cols: 5, rows: 5,
      // Known solving order (verified by tools/test-engine.js):
      solution: ['a', 'c', 'd', 'b'],
      arrows: [
      { id: 'a', dir: 'up', cells: [[0,3],[0,2],[0,1]] },
      { id: 'b', dir: 'left', cells: [[3,2],[2,2],[1,2]] },
      { id: 'c', dir: 'right', cells: [[1,3],[2,3]] },
      { id: 'd', dir: 'left', cells: [[3,0],[2,0],[1,0]] }
      ]
    },
    {
      name: 'Crossing Paths',
      cols: 5, rows: 5,
      // Known solving order (verified by tools/test-engine.js):
      solution: ['e', 'f', 'd', 'b', 'c', 'a'],
      arrows: [
      { id: 'a', dir: 'left', cells: [[4,4],[3,4]] },
      { id: 'b', dir: 'up', cells: [[1,4],[0,4],[0,3]] },
      { id: 'c', dir: 'left', cells: [[2,4],[2,3],[1,3]] },
      { id: 'd', dir: 'right', cells: [[0,2],[1,2]] },
      { id: 'e', dir: 'left', cells: [[4,1],[3,1]] },
      { id: 'f', dir: 'up', cells: [[3,3],[4,3],[4,2]] }
      ]
    },
    {
      name: 'Little Knots',
      cols: 6, rows: 6,
      // Known solving order (verified by tools/test-engine.js):
      solution: ['f', 'e', 'a', 'b', 'g', 'h', 'i', 'd', 'c'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[2,4],[3,4],[4,4]] },
      { id: 'b', dir: 'down', cells: [[4,0],[4,1],[4,2],[4,3]] },
      { id: 'c', dir: 'down', cells: [[1,2],[1,3]] },
      { id: 'd', dir: 'up', cells: [[1,5],[0,5],[0,4]] },
      { id: 'e', dir: 'up', cells: [[4,5],[5,5],[5,4]] },
      { id: 'f', dir: 'up', cells: [[5,2],[5,1],[5,0]] },
      { id: 'g', dir: 'right', cells: [[2,2],[2,1],[2,0],[3,0]] },
      { id: 'h', dir: 'right', cells: [[2,3],[3,3]] },
      { id: 'i', dir: 'right', cells: [[0,2],[0,1],[0,0],[1,0]] }
      ]
    },
    {
      name: 'Tangle',
      cols: 6, rows: 6,
      // Known solving order (verified by tools/test-engine.js):
      solution: ['c', 'j', 'b', 'e', 'a', 'd', 'i', 'g', 'l', 'f', 'k', 'h'],
      arrows: [
      { id: 'a', dir: 'up', cells: [[4,2],[4,1]] },
      { id: 'b', dir: 'left', cells: [[3,0],[2,0],[1,0]] },
      { id: 'c', dir: 'down', cells: [[0,4],[0,5]] },
      { id: 'd', dir: 'right', cells: [[2,1],[3,1]] },
      { id: 'e', dir: 'left', cells: [[5,2],[5,1],[5,0],[4,0]] },
      { id: 'f', dir: 'up', cells: [[5,5],[4,5],[3,5],[3,4]] },
      { id: 'g', dir: 'up', cells: [[3,3],[3,2]] },
      { id: 'h', dir: 'down', cells: [[1,1],[1,2]] },
      { id: 'i', dir: 'up', cells: [[4,4],[4,3]] },
      { id: 'j', dir: 'down', cells: [[0,0],[0,1],[0,2],[0,3]] },
      { id: 'k', dir: 'right', cells: [[1,3],[1,4],[1,5],[2,5]] },
      { id: 'l', dir: 'up', cells: [[2,3],[2,2]] }
      ]
    },
    {
      name: 'Wide Water',
      cols: 7, rows: 7,
      // Known solving order (verified by tools/test-engine.js):
      solution: ['a', 'b', 'n', 'd', 'o', 'i', 'h', 'c', 'f', 'j', 'p', 'k', 'm', 'g', 'l', 'e'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[5,6],[6,6]] },
      { id: 'b', dir: 'right', cells: [[5,0],[6,0]] },
      { id: 'c', dir: 'left', cells: [[6,3],[6,4],[6,5],[5,5]] },
      { id: 'd', dir: 'up', cells: [[0,3],[0,2]] },
      { id: 'e', dir: 'down', cells: [[2,0],[1,0],[1,1]] },
      { id: 'f', dir: 'right', cells: [[2,6],[3,6]] },
      { id: 'g', dir: 'down', cells: [[2,1],[3,1],[3,2]] },
      { id: 'h', dir: 'left', cells: [[4,6],[4,5],[3,5],[2,5]] },
      { id: 'i', dir: 'down', cells: [[1,4],[1,5]] },
      { id: 'j', dir: 'down', cells: [[6,1],[6,2],[5,2],[5,3]] },
      { id: 'k', dir: 'right', cells: [[3,0],[4,0],[4,1],[5,1]] },
      { id: 'l', dir: 'right', cells: [[1,2],[2,2]] },
      { id: 'm', dir: 'right', cells: [[1,3],[2,3],[3,3],[4,3]] },
      { id: 'n', dir: 'up', cells: [[0,1],[0,0]] },
      { id: 'o', dir: 'up', cells: [[1,6],[0,6],[0,5]] },
      { id: 'p', dir: 'right', cells: [[2,4],[3,4],[4,4]] }
      ]
    },
    /* ---- Levels 6-15: hand-authored, fixed puzzles (no generation, no seeds) ---- */
    {
      name: 'Gentle Current',
      cols: 5, rows: 5,
      solution: ['b', 'a', 'c', 'd', 'e'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[0,0],[1,0],[2,0]] },
      { id: 'b', dir: 'down', cells: [[4,0],[4,1]] },
      { id: 'c', dir: 'left', cells: [[3,2],[2,2]] },
      { id: 'd', dir: 'down', cells: [[1,3],[1,4]] },
      { id: 'e', dir: 'right', cells: [[2,4],[3,4]] }
      ]
    },
    {
      name: 'Four Ways',
      cols: 6, rows: 6,
      solution: ['b', 'a', 'd', 'g', 'e', 'h', 'c', 'f'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[0,0],[1,0],[2,0]] },
      { id: 'b', dir: 'down', cells: [[5,0],[5,1],[5,2]] },
      { id: 'c', dir: 'left', cells: [[4,2],[3,2]] },
      { id: 'd', dir: 'up', cells: [[1,5],[1,4],[1,3]] },
      { id: 'e', dir: 'down', cells: [[3,3],[3,4]] },
      { id: 'f', dir: 'up', cells: [[4,5],[4,4]] },
      { id: 'g', dir: 'up', cells: [[2,4],[2,3]] },
      { id: 'h', dir: 'down', cells: [[0,1],[0,2]] }
      ]
    },
    {
      name: 'Keystone',
      cols: 6, rows: 6,
      solution: ['a', 'e', 'b', 'c', 'd', 'f', 'g', 'h'],
      arrows: [
      { id: 'a', dir: 'left', cells: [[3,2],[2,2]] },
      { id: 'b', dir: 'down', cells: [[2,0],[2,1]] },
      { id: 'c', dir: 'up', cells: [[3,5],[3,4],[3,3]] },
      { id: 'd', dir: 'right', cells: [[0,0],[1,0]] },
      { id: 'e', dir: 'up', cells: [[5,1],[5,0]] },
      { id: 'f', dir: 'left', cells: [[5,4],[4,4]] },
      { id: 'g', dir: 'right', cells: [[0,5],[1,5]] },
      { id: 'h', dir: 'left', cells: [[5,3],[4,3]] }
      ]
    },
    {
      name: 'Crosscurrent',
      cols: 6, rows: 6,
      solution: ['g', 'h', 'c', 'e', 'd', 'f', 'b', 'a'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[1,1],[2,1],[3,1]] },
      { id: 'b', dir: 'down', cells: [[4,0],[4,1]] },
      { id: 'c', dir: 'left', cells: [[5,3],[4,3]] },
      { id: 'd', dir: 'right', cells: [[3,4],[4,4]] },
      { id: 'e', dir: 'right', cells: [[3,2],[4,2]] },
      { id: 'f', dir: 'right', cells: [[0,4],[1,4]] },
      { id: 'g', dir: 'left', cells: [[1,0],[0,0]] },
      { id: 'h', dir: 'right', cells: [[0,5],[1,5]] }
      ]
    },
    {
      name: 'Milestone',
      cols: 7, rows: 7,
      solution: ['c', 'd', 'f', 'j', 'b', 'a', 'e', 'i', 'g', 'h'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[0,0],[1,0],[2,0],[3,0]] },
      { id: 'b', dir: 'down', cells: [[6,0],[6,1],[6,2]] },
      { id: 'c', dir: 'left', cells: [[6,4],[5,4],[4,4]] },
      { id: 'd', dir: 'down', cells: [[0,2],[0,3]] },
      { id: 'e', dir: 'left', cells: [[5,6],[4,6],[3,6]] },
      { id: 'f', dir: 'down', cells: [[1,5],[1,6]] },
      { id: 'g', dir: 'down', cells: [[3,1],[3,2]] },
      { id: 'h', dir: 'left', cells: [[5,2],[4,2]] },
      { id: 'i', dir: 'down', cells: [[1,1],[1,2]] },
      { id: 'j', dir: 'right', cells: [[5,5],[6,5]] }
      ]
    },
    {
      name: 'Staircase',
      cols: 7, rows: 7,
      solution: ['e', 'j', 'g', 'k', 'i', 'd', 'c', 'h', 'b', 'f', 'a'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[0,0],[1,0]] },
      { id: 'b', dir: 'down', cells: [[3,0],[3,1]] },
      { id: 'c', dir: 'left', cells: [[4,3],[3,3]] },
      { id: 'd', dir: 'down', cells: [[1,2],[1,3]] },
      { id: 'e', dir: 'right', cells: [[0,5],[1,5]] },
      { id: 'f', dir: 'down', cells: [[5,0],[5,1]] },
      { id: 'g', dir: 'right', cells: [[5,3],[6,3]] },
      { id: 'h', dir: 'left', cells: [[6,2],[5,2]] },
      { id: 'i', dir: 'left', cells: [[6,6],[5,6]] },
      { id: 'j', dir: 'left', cells: [[2,6],[1,6]] },
      { id: 'k', dir: 'up', cells: [[6,1],[6,0]] }
      ]
    },
    {
      name: 'Long Way Round',
      cols: 7, rows: 7,
      solution: ['a', 'k', 'e', 'd', 'c', 'b', 'h', 'g', 'f', 'i', 'j'],
      arrows: [
      { id: 'a', dir: 'up', cells: [[0,2],[1,2],[1,1]] },
      { id: 'b', dir: 'right', cells: [[2,0],[3,0]] },
      { id: 'c', dir: 'down', cells: [[6,0],[6,1]] },
      { id: 'd', dir: 'left', cells: [[6,3],[5,3],[4,3]] },
      { id: 'e', dir: 'up', cells: [[0,5],[0,4],[0,3]] },
      { id: 'f', dir: 'down', cells: [[3,1],[3,2]] },
      { id: 'g', dir: 'right', cells: [[2,5],[3,5]] },
      { id: 'h', dir: 'up', cells: [[5,6],[4,6],[4,5]] },
      { id: 'i', dir: 'down', cells: [[5,1],[5,2]] },
      { id: 'j', dir: 'right', cells: [[0,6],[1,6],[2,6]] },
      { id: 'k', dir: 'down', cells: [[6,4],[6,5]] }
      ]
    },
    {
      name: 'Double Lock',
      cols: 7, rows: 7,
      solution: ['d', 'g', 'k', 'c', 'e', 'b', 'i', 'a', 'h', 'f', 'j'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[0,0],[1,0],[2,0]] },
      { id: 'b', dir: 'down', cells: [[4,0],[4,1]] },
      { id: 'c', dir: 'down', cells: [[6,0],[6,1]] },
      { id: 'd', dir: 'left', cells: [[6,3],[5,3]] },
      { id: 'e', dir: 'right', cells: [[3,5],[4,5]] },
      { id: 'f', dir: 'up', cells: [[2,6],[2,5]] },
      { id: 'g', dir: 'down', cells: [[5,5],[5,6]] },
      { id: 'h', dir: 'right', cells: [[1,2],[2,2]] },
      { id: 'i', dir: 'down', cells: [[3,1],[3,2]] },
      { id: 'j', dir: 'up', cells: [[0,6],[0,5]] },
      { id: 'k', dir: 'up', cells: [[5,2],[5,1]] }
      ]
    },
    {
      name: 'Packed Tide',
      cols: 7, rows: 7,
      solution: ['c', 'd', 'e', 'f', 'h', 'k', 'n', 'o', 'q', 'p', 'b', 'a', 'g', 'i', 'm', 'j', 'l'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[0,0],[1,0],[2,0]] },
      { id: 'b', dir: 'down', cells: [[4,0],[4,1],[4,2]] },
      { id: 'c', dir: 'right', cells: [[5,0],[6,0]] },
      { id: 'd', dir: 'left', cells: [[1,1],[0,1]] },
      { id: 'e', dir: 'up', cells: [[3,2],[3,1]] },
      { id: 'f', dir: 'right', cells: [[5,1],[6,1]] },
      { id: 'g', dir: 'right', cells: [[0,2],[1,2]] },
      { id: 'h', dir: 'right', cells: [[5,2],[6,2]] },
      { id: 'i', dir: 'down', cells: [[1,3],[1,4]] },
      { id: 'j', dir: 'up', cells: [[2,4],[2,3]] },
      { id: 'k', dir: 'down', cells: [[3,3],[3,4]] },
      { id: 'l', dir: 'left', cells: [[6,3],[5,3]] },
      { id: 'm', dir: 'down', cells: [[0,3],[0,4]] },
      { id: 'n', dir: 'right', cells: [[4,4],[5,4]] },
      { id: 'o', dir: 'right', cells: [[0,5],[1,5]] },
      { id: 'p', dir: 'left', cells: [[5,6],[4,6]] },
      { id: 'q', dir: 'left', cells: [[2,6],[1,6]] }
      ]
    },
    {
      name: 'Grand Delta',
      cols: 8, rows: 8,
      solution: ['i', 'j', 'o', 'r', 'a', 'l', 's', 'q', 'm', 'n', 'b', 'c', 'd', 'e', 'f', 'p', 'g', 'h', 'k'],
      arrows: [
      { id: 'a', dir: 'left', cells: [[7,7],[6,7]] },
      { id: 'b', dir: 'down', cells: [[6,5],[6,6]] },
      { id: 'c', dir: 'right', cells: [[3,6],[4,6],[5,6]] },
      { id: 'd', dir: 'down', cells: [[4,3],[4,4],[4,5]] },
      { id: 'e', dir: 'left', cells: [[6,3],[5,3]] },
      { id: 'f', dir: 'down', cells: [[6,0],[6,1]] },
      { id: 'g', dir: 'right', cells: [[2,0],[3,0],[4,0]] },
      { id: 'h', dir: 'up', cells: [[3,2],[3,1]] },
      { id: 'i', dir: 'down', cells: [[1,6],[1,7]] },
      { id: 'j', dir: 'down', cells: [[0,4],[0,5]] },
      { id: 'k', dir: 'right', cells: [[0,1],[1,1]] },
      { id: 'l', dir: 'down', cells: [[1,2],[1,3]] },
      { id: 'm', dir: 'up', cells: [[7,5],[7,4]] },
      { id: 'n', dir: 'right', cells: [[5,2],[6,2]] },
      { id: 'o', dir: 'down', cells: [[2,3],[2,4]] },
      { id: 'p', dir: 'up', cells: [[5,5],[5,4]] },
      { id: 'q', dir: 'down', cells: [[2,1],[2,2]] },
      { id: 'r', dir: 'up', cells: [[7,2],[7,1]] },
      { id: 's', dir: 'down', cells: [[0,2],[0,3]] }
      ]
    },
    /* ---- Levels 16-25: hand-authored, fixed puzzles (no generation, no seeds) ---- */
    {
      name: 'Rising Tide',
      cols: 8, rows: 8,
      solution: ['a', 'f', 'g', 'b', 'h', 'c', 'j', 'd', 'i', 'e'],
      arrows: [
      { id: 'a', dir: 'left', cells: [[7,7],[6,7]] },
      { id: 'b', dir: 'down', cells: [[6,5],[6,6]] },
      { id: 'c', dir: 'right', cells: [[3,6],[4,6],[5,6]] },
      { id: 'd', dir: 'down', cells: [[4,3],[4,4],[4,5]] },
      { id: 'e', dir: 'left', cells: [[6,3],[5,3]] },
      { id: 'f', dir: 'up', cells: [[0,6],[0,5]] },
      { id: 'g', dir: 'left', cells: [[2,3],[1,3]] },
      { id: 'h', dir: 'down', cells: [[2,0],[2,1]] },
      { id: 'i', dir: 'up', cells: [[7,5],[7,4]] },
      { id: 'j', dir: 'left', cells: [[7,1],[6,1]] }
      ]
    },
    {
      name: 'Twin Chains',
      cols: 8, rows: 8,
      solution: ['a', 'e', 'k', 'l', 'b', 'f', 'c', 'g', 'd', 'j', 'h', 'i'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[1,6],[1,7]] },
      { id: 'b', dir: 'down', cells: [[1,3],[1,4]] },
      { id: 'c', dir: 'left', cells: [[4,3],[3,3]] },
      { id: 'd', dir: 'down', cells: [[3,0],[3,1]] },
      { id: 'e', dir: 'down', cells: [[7,6],[7,7]] },
      { id: 'f', dir: 'right', cells: [[5,6],[6,6]] },
      { id: 'g', dir: 'down', cells: [[5,3],[5,4]] },
      { id: 'h', dir: 'down', cells: [[5,0],[5,1]] },
      { id: 'i', dir: 'left', cells: [[7,0],[6,0]] },
      { id: 'j', dir: 'left', cells: [[7,4],[6,4]] },
      { id: 'k', dir: 'up', cells: [[0,7],[0,6]] },
      { id: 'l', dir: 'left', cells: [[2,2],[1,2]] }
      ]
    },
    {
      name: 'Compass',
      cols: 8, rows: 8,
      solution: ['a', 'f', 'k', 'l', 'b', 'h', 'i', 'c', 'm', 'd', 'e', 'g', 'j'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[1,6],[1,7]] },
      { id: 'b', dir: 'down', cells: [[1,3],[1,4]] },
      { id: 'c', dir: 'left', cells: [[4,4],[3,4],[2,4]] },
      { id: 'd', dir: 'up', cells: [[2,7],[2,6],[2,5]] },
      { id: 'e', dir: 'down', cells: [[3,2],[3,3]] },
      { id: 'f', dir: 'up', cells: [[6,1],[6,0]] },
      { id: 'g', dir: 'left', cells: [[7,3],[6,3]] },
      { id: 'h', dir: 'right', cells: [[4,2],[4,1],[5,1]] },
      { id: 'i', dir: 'right', cells: [[2,0],[3,0]] },
      { id: 'j', dir: 'left', cells: [[7,6],[6,6]] },
      { id: 'k', dir: 'down', cells: [[4,5],[4,6]] },
      { id: 'l', dir: 'right', cells: [[5,4],[6,4]] },
      { id: 'm', dir: 'up', cells: [[5,6],[5,5]] }
      ]
    },
    {
      name: 'Two Locks',
      cols: 8, rows: 8,
      solution: ['d', 'e', 'j', 'k', 'b', 'c', 'a', 'h', 'i', 'l', 'g', 'f', 'm'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[1,0],[2,0]] },
      { id: 'b', dir: 'down', cells: [[3,0],[3,1]] },
      { id: 'c', dir: 'down', cells: [[7,0],[7,1]] },
      { id: 'd', dir: 'left', cells: [[3,3],[2,3]] },
      { id: 'e', dir: 'down', cells: [[7,3],[7,4]] },
      { id: 'f', dir: 'left', cells: [[6,7],[5,7]] },
      { id: 'g', dir: 'up', cells: [[4,7],[4,6]] },
      { id: 'h', dir: 'up', cells: [[0,7],[0,6]] },
      { id: 'i', dir: 'left', cells: [[5,4],[4,4]] },
      { id: 'j', dir: 'up', cells: [[0,5],[0,4]] },
      { id: 'k', dir: 'up', cells: [[6,2],[6,1]] },
      { id: 'l', dir: 'right', cells: [[4,2],[5,2]] },
      { id: 'm', dir: 'down', cells: [[5,5],[5,6]] }
      ]
    },
    {
      name: 'Whirlpool',
      cols: 8, rows: 8,
      solution: ['i', 'o', 'd', 'j', 'm', 'c', 'k', 'f', 'g', 'l', 'e', 'h', 'a', 'b', 'n'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[1,0],[0,0],[0,1]] },
      { id: 'b', dir: 'left', cells: [[6,1],[7,1],[7,0],[6,0]] },
      { id: 'c', dir: 'right', cells: [[1,2],[2,2]] },
      { id: 'd', dir: 'left', cells: [[4,7],[3,7],[2,7]] },
      { id: 'e', dir: 'right', cells: [[0,6],[0,5],[1,5]] },
      { id: 'f', dir: 'up', cells: [[5,7],[5,6],[5,5],[5,4]] },
      { id: 'g', dir: 'right', cells: [[2,5],[3,5],[4,5]] },
      { id: 'h', dir: 'down', cells: [[1,3],[0,3],[0,4]] },
      { id: 'i', dir: 'left', cells: [[1,7],[0,7]] },
      { id: 'j', dir: 'down', cells: [[7,4],[7,5]] },
      { id: 'k', dir: 'right', cells: [[3,3],[4,3],[5,3],[6,3]] },
      { id: 'l', dir: 'right', cells: [[1,6],[2,6]] },
      { id: 'm', dir: 'down', cells: [[5,2],[6,2],[7,2],[7,3]] },
      { id: 'n', dir: 'right', cells: [[1,1],[2,1],[3,1],[4,1]] },
      { id: 'o', dir: 'down', cells: [[6,5],[6,6],[7,6],[7,7]] }
      ]
    },
    {
      name: 'Ladder',
      cols: 8, rows: 8,
      solution: ['a', 'g', 'l', 'b', 'n', 'h', 'm', 'c', 'i', 'd', 'e', 'f', 'j', 'k'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[0,7],[1,7]] },
      { id: 'b', dir: 'down', cells: [[1,5],[1,6]] },
      { id: 'c', dir: 'left', cells: [[4,5],[3,5],[2,5]] },
      { id: 'd', dir: 'down', cells: [[3,2],[3,3],[3,4]] },
      { id: 'e', dir: 'right', cells: [[0,3],[1,3],[2,3]] },
      { id: 'f', dir: 'down', cells: [[1,0],[1,1],[1,2]] },
      { id: 'g', dir: 'down', cells: [[7,5],[7,6]] },
      { id: 'h', dir: 'right', cells: [[5,5],[6,5]] },
      { id: 'i', dir: 'down', cells: [[5,1],[5,2],[5,3],[5,4]] },
      { id: 'j', dir: 'left', cells: [[7,1],[6,1]] },
      { id: 'k', dir: 'left', cells: [[7,0],[6,0]] },
      { id: 'l', dir: 'up', cells: [[3,1],[3,0]] },
      { id: 'm', dir: 'right', cells: [[2,6],[3,6]] },
      { id: 'n', dir: 'down', cells: [[0,4],[0,5]] }
      ]
    },
    {
      name: 'Crossed Currents',
      cols: 8, rows: 8,
      solution: ['a', 'g', 'l', 'b', 'h', 'c', 'i', 'd', 'n', 'j', 'e', 'm', 'f', 'k'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[0,6],[0,7]] },
      { id: 'b', dir: 'left', cells: [[3,6],[2,6],[1,6]] },
      { id: 'c', dir: 'down', cells: [[2,3],[2,4],[2,5]] },
      { id: 'd', dir: 'left', cells: [[5,4],[4,4],[3,4]] },
      { id: 'e', dir: 'down', cells: [[4,1],[4,2],[4,3]] },
      { id: 'f', dir: 'left', cells: [[7,2],[6,2],[5,2]] },
      { id: 'g', dir: 'down', cells: [[7,5],[7,6]] },
      { id: 'h', dir: 'right', cells: [[4,6],[5,6],[6,6]] },
      { id: 'i', dir: 'down', cells: [[6,3],[6,4],[6,5]] },
      { id: 'j', dir: 'right', cells: [[0,5],[1,5]] },
      { id: 'k', dir: 'up', cells: [[7,4],[7,3]] },
      { id: 'l', dir: 'up', cells: [[1,3],[1,2]] },
      { id: 'm', dir: 'left', cells: [[7,0],[6,0]] },
      { id: 'n', dir: 'down', cells: [[2,0],[2,1]] }
      ]
    },
    {
      name: 'One Safe Move',
      cols: 8, rows: 8,
      solution: ['a', 'g', 'h', 'b', 'i', 'l', 'c', 'd', 'j', 'e', 'k', 'm', 'f', 'n'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[3,6],[3,7]] },
      { id: 'b', dir: 'left', cells: [[6,6],[5,6],[4,6]] },
      { id: 'c', dir: 'down', cells: [[5,3],[5,4],[5,5]] },
      { id: 'd', dir: 'down', cells: [[6,4],[6,5]] },
      { id: 'e', dir: 'left', cells: [[7,3],[6,3]] },
      { id: 'f', dir: 'down', cells: [[6,0],[6,1]] },
      { id: 'g', dir: 'right', cells: [[0,7],[1,7]] },
      { id: 'h', dir: 'down', cells: [[1,5],[1,6]] },
      { id: 'i', dir: 'left', cells: [[3,5],[2,5]] },
      { id: 'j', dir: 'down', cells: [[2,2],[2,3],[2,4]] },
      { id: 'k', dir: 'left', cells: [[5,2],[4,2],[3,2]] },
      { id: 'l', dir: 'down', cells: [[1,1],[1,2]] },
      { id: 'm', dir: 'right', cells: [[3,4],[4,4]] },
      { id: 'n', dir: 'right', cells: [[4,0],[5,0]] }
      ]
    },
    {
      name: 'Dense Logic',
      cols: 8, rows: 8,
      solution: ['c', 'e', 'f', 'k', 'm', 'q', 'd', 'n', 'b', 'i', 'a', 'j', 'o', 'g', 'l', 'h', 'p'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[0,0],[1,0],[2,0]] },
      { id: 'b', dir: 'down', cells: [[5,0],[5,1],[5,2]] },
      { id: 'c', dir: 'up', cells: [[7,2],[7,1]] },
      { id: 'd', dir: 'right', cells: [[4,4],[5,4]] },
      { id: 'e', dir: 'down', cells: [[0,6],[0,7]] },
      { id: 'f', dir: 'left', cells: [[1,3],[0,3]] },
      { id: 'g', dir: 'up', cells: [[3,7],[3,6]] },
      { id: 'h', dir: 'left', cells: [[7,6],[6,6]] },
      { id: 'i', dir: 'down', cells: [[2,2],[2,3],[2,4]] },
      { id: 'j', dir: 'right', cells: [[3,1],[4,1]] },
      { id: 'k', dir: 'down', cells: [[1,4],[1,5]] },
      { id: 'l', dir: 'up', cells: [[4,7],[4,6]] },
      { id: 'm', dir: 'up', cells: [[6,5],[6,4]] },
      { id: 'n', dir: 'left', cells: [[3,5],[2,5]] },
      { id: 'o', dir: 'right', cells: [[0,1],[1,1]] },
      { id: 'p', dir: 'left', cells: [[7,7],[6,7]] },
      { id: 'q', dir: 'right', cells: [[3,3],[4,3]] }
      ]
    },
    {
      name: 'Grand Finale',
      cols: 9, rows: 9,
      solution: ['a', 'k', 'm', 't', 'b', 'l', 'n', 'c', 'q', 'd', 'e', 'f', 'g', 'r', 'h', 's', 'i', 'j', 'o', 'p'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[8,6],[8,7]] },
      { id: 'b', dir: 'right', cells: [[5,6],[6,6],[7,6]] },
      { id: 'c', dir: 'down', cells: [[6,3],[6,4],[6,5]] },
      { id: 'd', dir: 'right', cells: [[3,4],[4,4],[5,4]] },
      { id: 'e', dir: 'down', cells: [[4,1],[4,2],[4,3]] },
      { id: 'f', dir: 'left', cells: [[7,2],[6,2],[5,2]] },
      { id: 'g', dir: 'down', cells: [[6,0],[6,1]] },
      { id: 'h', dir: 'right', cells: [[2,0],[3,0],[4,0]] },
      { id: 'i', dir: 'right', cells: [[0,0],[1,0]] },
      { id: 'j', dir: 'up', cells: [[0,4],[0,3]] },
      { id: 'k', dir: 'up', cells: [[8,3],[8,2]] },
      { id: 'l', dir: 'down', cells: [[8,4],[8,5]] },
      { id: 'm', dir: 'left', cells: [[3,8],[2,8]] },
      { id: 'n', dir: 'left', cells: [[5,8],[4,8]] },
      { id: 'o', dir: 'left', cells: [[2,3],[1,3]] },
      { id: 'p', dir: 'left', cells: [[2,4],[1,4]] },
      { id: 'q', dir: 'right', cells: [[0,6],[1,6],[2,6]] },
      { id: 'r', dir: 'up', cells: [[7,8],[7,7]] },
      { id: 's', dir: 'right', cells: [[0,7],[1,7]] },
      { id: 't', dir: 'up', cells: [[7,1],[7,0]] }
      ]
    },
    /* ---- Levels 26-35: hand-authored, fixed puzzles (no generation, no seeds) ---- */
    {
      name: 'Open Water',
      cols: 9, rows: 9,
      solution: ['a', 'b', 'f', 'k', 'n', 'c', 'd', 'j', 'o', 'g', 'm', 'h', 'e', 'l', 'i'],
      arrows: [
      { id: 'a', dir: 'left', cells: [[8,8],[7,8]] },
      { id: 'b', dir: 'up', cells: [[0,5],[0,4]] },
      { id: 'c', dir: 'right', cells: [[1,0],[2,0]] },
      { id: 'd', dir: 'down', cells: [[7,5],[7,6],[7,7]] },
      { id: 'e', dir: 'right', cells: [[1,4],[2,4]] },
      { id: 'f', dir: 'down', cells: [[4,3],[4,4]] },
      { id: 'g', dir: 'right', cells: [[5,6],[6,6]] },
      { id: 'h', dir: 'down', cells: [[6,3],[6,4],[6,5]] },
      { id: 'i', dir: 'up', cells: [[2,6],[2,5]] },
      { id: 'j', dir: 'left', cells: [[8,1],[7,1]] },
      { id: 'k', dir: 'down', cells: [[3,1],[3,2]] },
      { id: 'l', dir: 'left', cells: [[8,3],[7,3]] },
      { id: 'm', dir: 'right', cells: [[0,7],[1,7]] },
      { id: 'n', dir: 'up', cells: [[5,1],[5,0]] },
      { id: 'o', dir: 'down', cells: [[8,6],[8,7]] }
      ]
    },
    {
      name: 'Tangled Chains',
      cols: 9, rows: 9,
      solution: ['a', 'f', 'l', 'n', 'b', 'g', 'c', 'm', 'h', 'o', 'd', 'e', 'j', 'i', 'k'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[0,7],[0,8]] },
      { id: 'b', dir: 'left', cells: [[3,7],[2,7],[1,7]] },
      { id: 'c', dir: 'down', cells: [[2,2],[2,3],[2,4],[2,5]] },
      { id: 'd', dir: 'right', cells: [[3,4],[4,4],[5,4]] },
      { id: 'e', dir: 'left', cells: [[5,5],[4,5],[3,5]] },
      { id: 'f', dir: 'down', cells: [[8,6],[8,7]] },
      { id: 'g', dir: 'right', cells: [[5,7],[6,7],[7,7]] },
      { id: 'h', dir: 'down', cells: [[6,3],[6,4],[6,5]] },
      { id: 'i', dir: 'left', cells: [[8,2],[7,2],[6,2]] },
      { id: 'j', dir: 'down', cells: [[4,0],[4,1],[4,2]] },
      { id: 'k', dir: 'left', cells: [[8,0],[7,0]] },
      { id: 'l', dir: 'up', cells: [[0,3],[0,2]] },
      { id: 'm', dir: 'down', cells: [[1,5],[1,6]] },
      { id: 'n', dir: 'left', cells: [[3,1],[2,1]] },
      { id: 'o', dir: 'down', cells: [[7,5],[7,6]] }
      ]
    },
    {
      name: 'The Hub',
      cols: 9, rows: 9,
      solution: ['n', 'o', 'b', 'l', 'c', 'k', 'm', 'g', 'e', 'f', 'd', 'i', 'j', 'h', 'a'],
      arrows: [
      { id: 'a', dir: 'left', cells: [[4,1],[3,1]] },
      { id: 'b', dir: 'up', cells: [[8,6],[8,5],[8,4]] },
      { id: 'c', dir: 'right', cells: [[2,5],[3,5],[4,5]] },
      { id: 'd', dir: 'down', cells: [[0,4],[0,5]] },
      { id: 'e', dir: 'right', cells: [[0,6],[1,6],[2,6]] },
      { id: 'f', dir: 'right', cells: [[1,8],[1,7],[2,7]] },
      { id: 'g', dir: 'up', cells: [[5,8],[5,7],[5,6]] },
      { id: 'h', dir: 'down', cells: [[0,0],[0,1]] },
      { id: 'i', dir: 'down', cells: [[2,4],[1,4],[1,5]] },
      { id: 'j', dir: 'down', cells: [[1,2],[0,2],[0,3]] },
      { id: 'k', dir: 'down', cells: [[6,0],[7,0],[7,1],[7,2]] },
      { id: 'l', dir: 'right', cells: [[6,5],[7,5]] },
      { id: 'm', dir: 'down', cells: [[5,1],[6,1],[6,2],[6,3]] },
      { id: 'n', dir: 'up', cells: [[8,1],[8,0]] },
      { id: 'o', dir: 'up', cells: [[3,3],[2,3],[2,2]] }
      ]
    },
    {
      name: 'Pinwheel',
      cols: 9, rows: 9,
      solution: ['b', 'd', 'f', 'h', 'a', 'c', 'e', 'g', 'k', 'l', 'm', 'j', 'n', 'i', 'o', 'p'],
      arrows: [
      { id: 'a', dir: 'up', cells: [[3,3],[3,2]] },
      { id: 'b', dir: 'up', cells: [[3,1],[3,0]] },
      { id: 'c', dir: 'down', cells: [[5,5],[5,6]] },
      { id: 'd', dir: 'down', cells: [[5,7],[5,8]] },
      { id: 'e', dir: 'right', cells: [[2,5],[3,5]] },
      { id: 'f', dir: 'right', cells: [[7,5],[8,5]] },
      { id: 'g', dir: 'left', cells: [[6,3],[5,3]] },
      { id: 'h', dir: 'left', cells: [[1,3],[0,3]] },
      { id: 'i', dir: 'down', cells: [[1,0],[1,1]] },
      { id: 'j', dir: 'up', cells: [[7,8],[7,7]] },
      { id: 'k', dir: 'right', cells: [[0,6],[1,6]] },
      { id: 'l', dir: 'left', cells: [[8,2],[7,2]] },
      { id: 'm', dir: 'down', cells: [[1,4],[1,5]] },
      { id: 'n', dir: 'down', cells: [[8,0],[8,1]] },
      { id: 'o', dir: 'right', cells: [[3,7],[4,7]] },
      { id: 'p', dir: 'left', cells: [[5,0],[4,0]] }
      ]
    },
    {
      name: 'Spiral Gate',
      cols: 9, rows: 9,
      solution: ['d', 'j', 'k', 'c', 'g', 'b', 'f', 'l', 'a', 'e', 'i', 'm', 'h', 'n'],
      arrows: [
      { id: 'a', dir: 'right', cells: [[1,0],[2,0],[3,0],[4,0],[5,0]] },
      { id: 'b', dir: 'down', cells: [[8,0],[8,1],[8,2],[8,3],[8,4]] },
      { id: 'c', dir: 'left', cells: [[8,8],[7,8],[6,8],[5,8],[4,8]] },
      { id: 'd', dir: 'up', cells: [[0,8],[0,7],[0,6],[0,5],[0,4]] },
      { id: 'e', dir: 'right', cells: [[2,2],[3,2],[4,2]] },
      { id: 'f', dir: 'down', cells: [[6,3],[6,4],[6,5]] },
      { id: 'g', dir: 'left', cells: [[6,6],[5,6],[4,6]] },
      { id: 'h', dir: 'up', cells: [[2,5],[2,4],[2,3]] },
      { id: 'i', dir: 'right', cells: [[3,4],[4,4]] },
      { id: 'j', dir: 'right', cells: [[1,7],[2,7]] },
      { id: 'k', dir: 'left', cells: [[7,1],[6,1]] },
      { id: 'l', dir: 'down', cells: [[7,5],[7,6]] },
      { id: 'm', dir: 'up', cells: [[1,5],[1,4]] },
      { id: 'n', dir: 'left', cells: [[5,3],[4,3]] }
      ]
    },
    {
      name: 'Lattice',
      cols: 9, rows: 9,
      solution: ['a', 'b', 'c', 'e', 'd', 'f', 'j', 'g', 'h', 'k', 'i', 'l', 'm'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[2,6],[2,7]] },
      { id: 'b', dir: 'down', cells: [[5,6],[5,7]] },
      { id: 'c', dir: 'up', cells: [[7,3],[7,2]] },
      { id: 'd', dir: 'left', cells: [[6,5],[5,5]] },
      { id: 'e', dir: 'left', cells: [[3,5],[2,5]] },
      { id: 'f', dir: 'left', cells: [[8,6],[7,6],[6,6]] },
      { id: 'g', dir: 'down', cells: [[5,3],[5,4]] },
      { id: 'h', dir: 'down', cells: [[6,3],[6,4]] },
      { id: 'i', dir: 'right', cells: [[3,3],[4,3]] },
      { id: 'j', dir: 'down', cells: [[2,3],[2,4]] },
      { id: 'k', dir: 'left', cells: [[4,4],[3,4]] },
      { id: 'l', dir: 'down', cells: [[4,1],[4,2]] },
      { id: 'm', dir: 'right', cells: [[1,1],[2,1]] }
      ]
    },
    {
      name: 'Interlock',
      cols: 9, rows: 9,
      solution: ['a', 'f', 'k', 'n', 'o', 'b', 'g', 'l', 'c', 'h', 'j', 'd', 'i', 'e', 'p', 'm'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[0,7],[0,8]] },
      { id: 'b', dir: 'left', cells: [[3,7],[2,7],[1,7]] },
      { id: 'c', dir: 'down', cells: [[2,3],[2,4],[2,5]] },
      { id: 'd', dir: 'left', cells: [[5,4],[4,4],[3,4]] },
      { id: 'e', dir: 'down', cells: [[4,1],[4,2]] },
      { id: 'f', dir: 'down', cells: [[8,5],[8,6]] },
      { id: 'g', dir: 'right', cells: [[5,6],[6,6],[7,6]] },
      { id: 'h', dir: 'down', cells: [[6,2],[6,3],[6,4]] },
      { id: 'i', dir: 'left', cells: [[8,3],[7,3]] },
      { id: 'j', dir: 'right', cells: [[3,6],[4,6]] },
      { id: 'k', dir: 'left', cells: [[8,0],[7,0]] },
      { id: 'l', dir: 'up', cells: [[7,2],[7,1]] },
      { id: 'm', dir: 'right', cells: [[1,2],[2,2]] },
      { id: 'n', dir: 'up', cells: [[0,5],[0,4]] },
      { id: 'o', dir: 'right', cells: [[5,8],[6,8]] },
      { id: 'p', dir: 'left', cells: [[8,4],[7,4]] }
      ]
    },
    {
      name: 'First Light',
      cols: 9, rows: 9,
      solution: ['d', 'e', 'c', 'b', 'h', 'a', 'g', 'j', 'f', 'i', 'l', 'k', 'm', 'n'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[4,0],[4,1],[4,2]] },
      { id: 'b', dir: 'down', cells: [[4,3],[4,4]] },
      { id: 'c', dir: 'down', cells: [[4,5],[4,6]] },
      { id: 'd', dir: 'left', cells: [[5,8],[4,8]] },
      { id: 'e', dir: 'left', cells: [[3,0],[2,0]] },
      { id: 'f', dir: 'right', cells: [[0,1],[1,1]] },
      { id: 'g', dir: 'right', cells: [[1,3],[2,3]] },
      { id: 'h', dir: 'right', cells: [[0,5],[1,5]] },
      { id: 'i', dir: 'left', cells: [[8,2],[7,2]] },
      { id: 'j', dir: 'left', cells: [[8,4],[7,4]] },
      { id: 'k', dir: 'left', cells: [[8,6],[7,6]] },
      { id: 'l', dir: 'up', cells: [[1,7],[1,6]] },
      { id: 'm', dir: 'up', cells: [[7,8],[7,7]] },
      { id: 'n', dir: 'right', cells: [[2,7],[3,7]] }
      ]
    },
    {
      name: 'Crowded Reef',
      cols: 9, rows: 9,
      solution: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'r', 'l', 'm', 'k', 'o', 'p', 'n', 'q'],
      arrows: [
      { id: 'a', dir: 'left', cells: [[2,1],[1,1]] },
      { id: 'b', dir: 'right', cells: [[7,1],[8,1]] },
      { id: 'c', dir: 'down', cells: [[8,6],[8,7]] },
      { id: 'd', dir: 'down', cells: [[0,7],[0,8]] },
      { id: 'e', dir: 'up', cells: [[5,1],[5,0]] },
      { id: 'f', dir: 'up', cells: [[2,4],[2,3]] },
      { id: 'g', dir: 'up', cells: [[8,4],[8,3]] },
      { id: 'h', dir: 'right', cells: [[5,7],[6,7],[7,7]] },
      { id: 'i', dir: 'left', cells: [[3,7],[2,7],[1,7]] },
      { id: 'j', dir: 'up', cells: [[5,4],[5,3]] },
      { id: 'k', dir: 'right', cells: [[0,3],[1,3]] },
      { id: 'l', dir: 'down', cells: [[6,4],[6,5]] },
      { id: 'm', dir: 'down', cells: [[2,5],[2,6]] },
      { id: 'n', dir: 'left', cells: [[5,5],[4,5]] },
      { id: 'o', dir: 'right', cells: [[3,4],[4,4]] },
      { id: 'p', dir: 'up', cells: [[1,6],[1,5]] },
      { id: 'q', dir: 'down', cells: [[4,1],[4,2]] },
      { id: 'r', dir: 'down', cells: [[7,3],[7,4]] }
      ]
    },
    {
      name: 'Grand Tour',
      cols: 9, rows: 9,
      solution: ['a', 'm', 'n', 'p', 'r', 'b', 's', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'o', 'j', 'k', 'q', 'l'],
      arrows: [
      { id: 'a', dir: 'down', cells: [[0,6],[0,7]] },
      { id: 'b', dir: 'left', cells: [[3,7],[2,7],[1,7]] },
      { id: 'c', dir: 'down', cells: [[2,3],[2,4],[2,5]] },
      { id: 'd', dir: 'right', cells: [[0,4],[1,4]] },
      { id: 'e', dir: 'up', cells: [[1,6],[1,5]] },
      { id: 'f', dir: 'left', cells: [[4,5],[3,5]] },
      { id: 'g', dir: 'down', cells: [[3,2],[3,3]] },
      { id: 'h', dir: 'left', cells: [[7,3],[6,3],[5,3],[4,3]] },
      { id: 'i', dir: 'down', cells: [[5,0],[5,1],[5,2]] },
      { id: 'j', dir: 'left', cells: [[8,1],[7,1],[6,1]] },
      { id: 'k', dir: 'up', cells: [[7,6],[7,5]] },
      { id: 'l', dir: 'up', cells: [[7,8],[7,7]] },
      { id: 'm', dir: 'left', cells: [[2,0],[1,0]] },
      { id: 'n', dir: 'down', cells: [[8,6],[8,7]] },
      { id: 'o', dir: 'up', cells: [[4,8],[4,7]] },
      { id: 'p', dir: 'right', cells: [[6,4],[7,4]] },
      { id: 'q', dir: 'up', cells: [[6,8],[6,7]] },
      { id: 'r', dir: 'left', cells: [[3,1],[2,1]] },
      { id: 's', dir: 'down', cells: [[8,2],[8,3]] }
      ]
    }

  ];

  /* ---- Levels 6-50: generated from fixed seeds ----------------------------------------------------------
     Each level is built the first time it is needed, from a seed that depends only on its number, so every
     device gets the same layout every time. Method (same as tools/gen-puzzles.js): arrows are placed in REVERSE
     solving order, and each new arrow's exit line must avoid every arrow already placed (those leave after it).
     That gives a legal order that removes every arrow. The result is still checked with the real rules
     (validatePuzzle + solve) here, and again by Game.loadLevel before play. */

  // Board size, arrow count, longest arrow and the dependency depth aimed for, per difficulty band.
  function specFor(id) {
    if (id <= 15) return { cols: 7,  count: 12 + Math.floor((id - 6) * 0.45),  maxLen: 3, rounds: id <= 10 ? 3 : 4 };
    if (id <= 25) return { cols: 8,  count: 14 + Math.floor((id - 16) * 0.45), maxLen: 4, rounds: id <= 20 ? 4 : 5 };
    if (id <= 35) return { cols: 9,  count: 18 + Math.floor((id - 26) * 0.6),  maxLen: 4, rounds: id <= 30 ? 5 : 6 };
    if (id <= 45) return { cols: 10, count: 24 + Math.floor((id - 36) * 0.6),  maxLen: 4, rounds: id <= 40 ? 6 : 7 };
    return { cols: 10, count: 30 + (id - 46), maxLen: 5, rounds: 8 };
  }

  function rngOf(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(list, r) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  // a..z, then aa, ab, ... (ids stay short: saved progress keeps them under 8 characters).
  function idFor(i) {
    const L = 'abcdefghijklmnopqrstuvwxyz';
    return i < 26 ? L[i] : L[Math.floor(i / 26) - 1] + L[i % 26];
  }

  // Places up to `count` arrows. Returns them in PLACEMENT order (the first one placed leaves last).
  function placeArrows(cols, count, maxLen, seed) {
    const Rules = AF.Rules, NAMES = ['right', 'left', 'down', 'up'];
    const r = rngOf(seed), taken = new Set(), placed = [];
    const free = function (x, y) { return x >= 0 && y >= 0 && x < cols && y < cols && !taken.has(x + ',' + y); };
    for (let tries = 0; tries < 1800 && placed.length < count; tries++) {
      const sx = Math.floor(r() * cols), sy = Math.floor(r() * cols);
      if (!free(sx, sy)) continue;
      const want = 2 + Math.floor(r() * (maxLen - 1));
      const cells = [[sx, sy]], used = new Set([sx + ',' + sy]);
      let dir = NAMES[Math.floor(r() * 4)];
      while (cells.length < want) {
        const last = cells[cells.length - 1];
        const opts = shuffled(NAMES.slice(), r);
        if (r() < 0.55) opts.unshift(dir);
        let moved = false;
        for (let k = 0; k < opts.length; k++) {
          const d = Rules.DIRS[opts[k]], nx = last[0] + d[0], ny = last[1] + d[1];
          if (free(nx, ny) && !used.has(nx + ',' + ny)) {
            cells.push([nx, ny]); used.add(nx + ',' + ny); dir = opts[k]; moved = true; break;
          }
        }
        if (!moved) break;
      }
      if (cells.length < 2) continue;
      const head = Rules.headDirection({ cells: cells });
      // Unique ids matter: analyzeExit ignores any arrow that shares the id of the one being tested.
      const cand = { id: '_new', dir: head, cells: cells };
      if (!Rules.analyzeExit(cand, placed, cols, cols).clear) continue;   // its exit line must avoid every arrow placed so far
      cells.forEach(function (c) { taken.add(c[0] + ',' + c[1]); });
      placed.push({ id: 'p' + placed.length, dir: head, cells: cells });
    }
    return placed;
  }

  // Turns a placement into a checked puzzle, or null if the real rules reject it.
  function assemble(cols, placed) {
    const arrows = placed.slice().reverse().map(function (a, i) { return { id: idFor(i), dir: a.dir, cells: a.cells }; });
    const p = { cols: cols, rows: cols, arrows: arrows };
    if (arrows.length < 2 || AF.Rules.validatePuzzle(p).length) return null;
    const sol = AF.Rules.solve(p);
    return sol.solvable ? { p: p, sol: sol } : null;
  }

  function build(id, spec) {
    let best = null;
    for (let s = 0; s < 60; s++) {
      const got = assemble(spec.cols, placeArrows(spec.cols, spec.count, spec.maxLen, id * 7919 + s * 104729 + 17));
      if (!got) continue;
      const score = got.sol.rounds * 4 + got.p.arrows.length;
      if (!best || score > best.score) best = { score: score, got: got };
      if (got.sol.rounds >= spec.rounds && got.p.arrows.length >= spec.count - 2) break;
    }
    for (let s = 0; !best && s < 400; s++) {            // last resort: a small puzzle, still fully checked
      const got = assemble(spec.cols, placeArrows(spec.cols, 6, 3, 99991 + id * 31 + s));
      if (got) best = { score: 0, got: got };
    }
    if (!best) return null;
    return Object.assign({ id: id, name: 'Level ' + id, solution: best.got.sol.order }, best.got.p);
  }

  function lazyLevel(id) {
    const spec = specFor(id);
    let built;
    return Object.freeze({
      id: id,
      size: spec.cols,
      playable: true,
      get puzzle() {
        if (built === undefined) built = deepFreeze(build(id, spec));
        return built;
      }
    });
  }

  function chapterOf(id) {
    return CHAPTERS.find(function (c) { return id >= c.from && id <= c.to; }) || CHAPTERS[0];
  }

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }

  const all = Array.from({ length: TOTAL }, function (_, i) {
    const id = i + 1;
    if (!puzzles[i]) return lazyLevel(id);               // levels 36-50 only
    const puzzle = deepFreeze(Object.assign({ id: id }, puzzles[i]));
    return Object.freeze({ id: id, size: puzzle.cols, playable: true, puzzle: puzzle });
  });

  AF.Levels = {
    TOTAL: TOTAL,
    PLAYABLE: TOTAL,
    LIVES_PER_LEVEL: 3,
    // The Daily Challenge keeps choosing from the original hand-made levels, so existing dates keep their puzzles.
    DAILY_POOL: 5,
    CHAPTERS: CHAPTERS,
    all: all,
    get: function (id) { return all[Math.max(1, Math.min(TOTAL, id)) - 1]; },
    isPlayable: function (id) { return Number.isInteger(id) && id >= 1 && id <= TOTAL && all[id - 1].playable; },
    chapterOf: chapterOf
  };
})(window.AF = window.AF || {});
