/* Mockup skin: player profile, stars, hints, sound, and the screen renderers for the redesigned UI.
   Loaded after ui.js and before app.js. Extra data lives under its own key (arrowflow.extra.v1). */
(function (AF) {
  'use strict';
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const UI = AF.UI, S = AF.Storage, A = AF.Achievements, D = AF.Daily, L = AF.Levels;
  const KEY = 'arrowflow.extra.v1', HINTS = 3;

  /* ---- Extra data: stars, name, best streak, stats ---- */
  let X = { stars: {}, name: 'Player', best: 0, hints: HINTS, stats: { played: 0, time: 0, moves: 0 } };
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (r && typeof r === 'object') {
      Object.keys(r.stars || {}).forEach(function (k) { const n = r.stars[k]; if (/^\d+$/.test(k) && n >= 1 && n <= 3) X.stars[k] = n | 0; });
      if (typeof r.name === 'string' && r.name.trim()) X.name = r.name.trim().slice(0, 14);
      if (Number.isInteger(r.hints) && r.hints >= 0 && r.hints <= 100000) X.hints = r.hints;
      if (Number.isInteger(r.best) && r.best > 0) X.best = Math.min(r.best, 9999);
      if (r.stats) ['played', 'time', 'moves'].forEach(function (k) { if (Number.isFinite(r.stats[k]) && r.stats[k] > 0) X.stats[k] = r.stats[k]; });
    }
  } catch (e) { /* ignore */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(X)); } catch (e) { /* ignore */ } }

  let run = { t0: 0, acc: 0, running: false, moves: 0, last: { stars: 3, time: 0, moves: 0 } };
  const elapsed = function () { return run.acc + (run.running ? Date.now() - run.t0 : 0); };
  function setHintBadge() { const b = $('#hint-count'); if (b) b.textContent = X.hints; }

  AF.Extra = {
    begin: function () { run = { t0: Date.now(), acc: 0, running: true, moves: 0, last: run.last }; setHintBadge(); },
    pause: function () { if (run.running) { run.acc += Date.now() - run.t0; run.running = false; } },
    resume: function () { if (!run.running) { run.t0 = Date.now(); run.running = true; } },
    move: function () { run.moves++; },
    hints: function () { return X.hints; },
    useHint: function () { X.hints = Math.max(0, X.hints - 1); save(); setHintBadge(); },
    // Rewarded hints join the persistent global balance and survive level changes/restarts.
    grantHint: function () { X.hints = Math.min(100000, X.hints + 1); save(); setHintBadge(); },
    stars: function (id) { return X.stars[id] || (S.isCompleted(id) ? 1 : 0); },
    totalStars: function () { let n = 0; for (let i = 1; i <= L.TOTAL; i++) n += AF.Extra.stars(i); return n; },
    // levelId null = a Daily Challenge (no star record is kept for campaign).
    finish: function (levelId, lives) {
      AF.Extra.pause();
      const stars = lives >= 3 ? 3 : lives === 2 ? 2 : 1;
      run.last = { stars: stars, time: elapsed(), moves: run.moves };
      X.stats.played++; X.stats.time += run.last.time; X.stats.moves += run.moves;
      if (levelId && stars > (X.stars[levelId] || 0)) X.stars[levelId] = stars;
      save();
    },
    name: function () { return X.name; },
    setName: function (n) { n = String(n || '').trim().slice(0, 14); if (n) { X.name = n; save(); } },
    noteStreak: function (n) { if (n > X.best) { X.best = n; save(); } return X.best; },
    stats: function () { return Object.assign({}, X.stats); }
  };

  const fmt = function (ms) { const s = Math.round(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const star = function (on, cls) { return '<svg class="st ' + (cls || '') + (on ? ' on' : '') + '" viewBox="0 0 24 24"><use href="#i-star"/></svg>'; };
  const avatar = '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#BFD9FF"/><path d="M10 44c2-9 8-12 14-12s12 3 14 12z" fill="#3B82F6"/><circle cx="24" cy="21" r="9" fill="#F4C7A1"/><path d="M14.5 19c0-7 5-10 10-10s9 3 9 9c-3-2-6-4-9-4s-7 1-10 5z" fill="#2B2B3A"/></svg>';
  const playerLevel = function () { return Math.floor(S.completedCount() / 10) + 1; };
  const streakNow = function () { const n = A.summary().streak || 0; AF.Extra.noteStreak(n); return n; };

  /* ---- Screen renderers ---- */
  const o = {};
  ['renderHome', 'renderMe', 'renderDaily', 'renderGame', 'renderSettings'].forEach(function (k) { o[k] = UI[k]; });

  UI.renderHome = function () {
    o.renderHome();
    streakNow();
    $('#home-avatar').innerHTML = avatar;
    $('#home-name').textContent = X.name;
    $('#home-plevel').textContent = 'Level ' + playerLevel();
    $('#home-stars').textContent = AF.Extra.totalStars();
    $('#home-best').textContent = X.best;
    $('#home-camp').textContent = L.TOTAL + ' Levels';
    $('#home-daily-sub').textContent = D.isCompleted(D.todayKey()) ? 'Completed today' : 'Play & Earn Rewards';
  };

  UI.renderMe = function () {
    o.renderMe();
    streakNow();
    $('#me-avatar').innerHTML = avatar;
    $('#me-name').textContent = X.name;
    $('#me-plevel').textContent = 'Level ' + playerLevel();
    $('#me-stars').textContent = AF.Extra.totalStars();
    $('#me-best').textContent = X.best;
    $('#me-badges').innerHTML = A.list().slice(0, 4).map(function (a) {
      return '<span class="badge' + (a.unlocked ? ' on' : '') + '"><svg class="icon"><use href="#' + a.icon + '"/></svg></span>';
    }).join('');
  };

  let tab = 0;     // 0-based tab: levels tab*10+1 .. tab*10+10
  UI.renderLevels = function () {
    const hi = S.getHighestUnlocked(), tabs = Math.ceil(L.TOTAL / 10);
    if (UI.currentName() !== 'levels') tab = Math.floor((Math.min(hi, L.TOTAL) - 1) / 10);
    let t = '';
    for (let i = 0; i < tabs; i++) t += '<button type="button" role="tab" class="m-tab' + (i === tab ? ' on' : '') + '" data-action="levels-tab" data-tab="' + i + '">' + (i * 10 + 1) + '-' + (i * 10 + 10) + '</button>';
    const bar = $('#levels-tabs'); bar.innerHTML = t;
    const on = $('.m-tab.on', bar); if (on) bar.scrollLeft = on.offsetLeft - 16;
    let g = '';
    for (let id = tab * 10 + 1; id <= Math.min(L.TOTAL, tab * 10 + 10); id++) {
      const done = S.isCompleted(id), cur = id === hi, n = AF.Extra.stars(id);
      const state = done ? 'done' : cur ? 'cur' : 'lock';
      g += '<button type="button" class="lv lv--' + state + '" data-action="open-level" data-level="' + id + '" aria-label="Level ' + id + (state === 'lock' ? ', locked' : '') + '">' +
        '<b>' + id + '</b>' + (state === 'lock' ? '<svg class="icon"><use href="#i-lock"/></svg>' : '<span>' + star(n >= 1) + star(n >= 2) + star(n >= 3) + '</span>') + '</button>';
    }
    $('#levels-list').innerHTML = g;
    $('#levels-count').textContent = S.completedCount() + '/' + L.TOTAL;
    $('#levels-scroll').scrollTop = 0;
  };

  UI.renderGame = function (s) {
    o.renderGame(s);
    const p = AF.Game.getPuzzle();
    if (p) $('#game-size').textContent = p.sizeLabel || (p.cols + '\u00D7' + p.rows);
    if (s.mode === 'daily') $('#game-size').textContent += ' \u00B7 Daily';
    setHintBadge();
  };

  UI.renderComplete = function (id, hasNext) {
    const r = run.last, total = L.TOTAL;
    $('#complete-title').textContent = 'Level Complete!';
    $('#complete-sub').textContent = id >= total ? 'You cleared every level!' : 'Well Done!';
    fill(r);
    $('#complete-next').hidden = id >= total || !hasNext;
    $('#complete-levels').dataset.action = 'go-home';
  };
  UI.renderDailyComplete = function (key, firstTime) {
    $('#complete-title').textContent = 'Daily Complete!';
    $('#complete-sub').textContent = firstTime ? 'Star earned. See you tomorrow!' : 'Already completed today';
    fill(run.last);
    $('#complete-next').hidden = true;
    $('#complete-levels').dataset.action = 'go-home';
  };
  function fill(r) {
    $('#complete-stars').innerHTML = star(r.stars >= 1, 'big') + star(r.stars >= 2, 'big') + star(r.stars >= 3, 'big');
    $('#complete-time').textContent = fmt(r.time);
    $('#complete-moves').textContent = r.moves;
  }

  UI.renderDaily = function (view) {
    o.renderDaily(view);
    const grid = $('#cal-grid'), pads = grid.querySelectorAll('.day--pad'), want = (pads.length + 6) % 7;
    for (let i = 0; i < pads.length - want; i++) pads[i].remove();
    for (let i = pads.length; i < want; i++) grid.insertBefore(Object.assign(document.createElement('span'), { className: 'day day--pad' }), grid.firstChild);
    const n = streakNow();
    $('#daily-streak').textContent = n + (n === 1 ? ' Day' : ' Days');
    $('#cal-title').textContent = $('#cal-title').textContent;
    $('#daily-play-label').textContent = D.isCompleted(D.todayKey()) ? 'Play Again' : 'Play Today';
  };

  UI.renderSettings = function () { o.renderSettings(); Sfx.sync(); };

  /* ---- Sound: tiny WebAudio effects and a soft music loop ---- */
  const Sfx = (function () {
    let ctx = null, musicTimer = 0, step = 0;
    const scale = [261.6, 293.7, 329.6, 392, 440, 523.3];
    function ac() {
      if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(f, dur, vol, type, delay) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + (delay || 0), osc = c.createOscillator(), g = c.createGain();
      osc.type = type || 'sine'; osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(c.destination); osc.start(t); osc.stop(t + dur + 0.05);
    }
    const on = function (k) { return S.getSettings()[k]; };
    function sync() {
      clearInterval(musicTimer); musicTimer = 0;
      if (on('music') && !document.hidden && ctx) musicTimer = setInterval(function () {
        step++; tone(scale[(step * 3 + (step >> 2)) % scale.length] / 2, 1.6, 0.025, 'sine');
        if (step % 4 === 0) tone(scale[(step >> 1) % scale.length], 1.2, 0.015, 'triangle', 0.3);
      }, 700);
    }
    document.addEventListener('pointerdown', function () { if (!ctx && on('music')) { ac(); sync(); } }, { passive: true });
    document.addEventListener('visibilitychange', sync);
    return {
      sync: sync,
      pop: function () { if (on('sound')) { tone(660, .12, .08, 'triangle'); tone(880, .12, .06, 'triangle', .06); } },
      bad: function () { if (on('sound')) tone(160, .22, .1, 'square'); },
      win: function () { if (on('sound')) [523, 659, 784, 1047].forEach(function (f, i) { tone(f, .3, .08, 'triangle', i * .11); }); }
    };
  })();
  const vib = UI.vibrate;
  UI.vibrate = function (ms) {
    if (ms === 10) Sfx.pop(); else if (ms === 18) Sfx.bad(); else if (ms === 25) Sfx.win();
    vib(ms);
  };
  AF.Sfx = Sfx;

  /* ---- Extra actions (merged into app.js's table) ---- */
  const info = function (title, html) { $('#info-title').textContent = title; $('#info-body').innerHTML = html; UI.openSheet('info'); };
  AF.extraActions = {
    'onb-next': function () { $('#welcome-update').hidden = !S.consentSuperseded(); UI.show('welcome', 'forward'); },
    'terms-back': function () { UI.show('onboarding', 'back'); },
    'levels-tab': function (el) { tab = +el.dataset.tab; UI.renderLevels(); },
    'sub-back': function () {
      const f = AF.subFrom || 'me';
      if (f === 'settings') { UI.renderSettings(); UI.show('settings', 'back'); }
      else if (f === 'home') { UI.renderHome(); UI.show('home', 'back'); }
      else { UI.renderMe(); UI.show('me', 'back'); }
    },
    language: function () { UI.toast('More languages are coming soon.'); },
    'edit-name': function () {
      const n = window.prompt('Your name', X.name);
      if (n && n.trim()) { AF.Extra.setName(n); UI.renderMe(); }
    },
    'info-progress': function () {
      const c = S.completedCount();
      info('Game Progress', c + ' of ' + L.TOTAL + ' levels cleared.<br>Highest unlocked: Level ' + S.getHighestUnlocked() + '.<br>' + AF.Extra.totalStars() + ' of ' + (L.TOTAL * 3) + ' stars earned.');
    },
    'info-stats': function () {
      const t = AF.Extra.stats();
      info('Statistics', 'Puzzles finished: ' + t.played + '<br>Total play time: ' + fmt(t.time) + '<br>Total moves: ' + t.moves + '<br>Daily challenges: ' + D.totalCompleted());
    },
    'info-saved': function () { info('Saved Data', 'Your progress, stars, awards and settings are saved on this device only. Use Reset Game Data in Settings to erase everything.'); }
  };
})(window.AF = window.AF || {});
/* Onboarding dots follow the swipe position. */
(function () {
  const track = document.getElementById('onb-track');
  if (!track) return;
  track.addEventListener('scroll', function () {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    Array.prototype.forEach.call(document.querySelectorAll('#onb-dots i'), function (d, k) { d.classList.toggle('on', k === i); });
  }, { passive: true });
})();
