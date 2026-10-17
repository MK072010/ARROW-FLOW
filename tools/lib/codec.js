/* Compact level encoding shared by the build and validation tools (the game has its own tiny decoder in js/levels.js).
   An arrow is one string: tail x, tail y (one digit each), then one letter per step toward the head: u d l r.
   Example: [[0,3],[0,2],[0,1]] -> "03uu". The head direction is the last letter, so it can never disagree with the path.
   Each coordinate is ONE base-36 character (0-9, a-o...), so boards up to 25x25 fit; boards up to 10x10 look exactly as before.
   The two coordinate characters are always read first, so they can never be mistaken for the step letters. */
'use strict';
const STEP = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const NAME = { u: 'up', d: 'down', l: 'left', r: 'right' };
const LETTER = { up: 'u', down: 'd', left: 'l', right: 'r' };
const L26 = 'abcdefghijklmnopqrstuvwxyz';
// Same id scheme the game always used: a..z, then aa, ab, ...
function idFor(i) { return i < 26 ? L26[i] : L26[Math.floor(i / 26) - 1] + L26[i % 26]; }

function encodeArrow(a) {
  const c = a.cells;
  if (c[0][0] > 35 || c[0][1] > 35) throw new Error('coordinate above 35');
  let s = c[0][0].toString(36) + c[0][1].toString(36);
  for (let i = 1; i < c.length; i++) {
    const dx = c[i][0] - c[i - 1][0], dy = c[i][1] - c[i - 1][1];
    s += dx === 1 ? 'r' : dx === -1 ? 'l' : dy === 1 ? 'd' : 'u';
  }
  return s;
}
function decodeArrow(s, id) {
  let x = parseInt(s[0], 36), y = parseInt(s[1], 36);
  const cells = [[x, y]];
  for (let i = 2; i < s.length; i++) { const d = STEP[s[i]]; x += d[0]; y += d[1]; cells.push([x, y]); }
  return { id: id, dir: NAME[s[s.length - 1]], cells: cells };
}
module.exports = { encodeArrow, decodeArrow, idFor, LETTER, NAME, STEP };
