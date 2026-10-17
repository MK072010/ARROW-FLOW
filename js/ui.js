/* UI layer: screen transitions, sheets, toast, and rendering of data into the DOM.
   It never decides what happens; app.js wires actions to behaviour. */
(function (AF) {
  'use strict';

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };

  const screens = {};
  let currentName = null;
  let screensRoot, toastEl, toastTimer, openSheetEl = null, lastFocus = null, sheetClosed = null, liveEl = null, tabbarEl = null;

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  function isReduced() { return document.documentElement.dataset.motion === 'reduced'; }

  function init() {
    screensRoot = $('#screens');
    toastEl = $('#toast');
    liveEl = $('#game-live');
    tabbarEl = $('#tabbar');
    $$('.screen').forEach(function (el) {
      screens[el.dataset.screen] = el;
      if (el.classList.contains('is-active')) currentName = el.dataset.screen;
    });
  }

  /* ---- Screen transitions ---------------------------------------------- */

  // dir: 'forward' slides in from the right, 'back' from the left, 'fade' only fades.
  function show(name, dir) {
    const next = screens[name];
    if (!next || name === currentName) return;
    const prev = screens[currentName];
    const s = dir === 'back' ? -1 : dir === 'fade' ? 0 : 1;

    // Park the incoming screen at its start offset without animating, then release.
    next.style.transition = 'none';
    next.style.setProperty('--shift', (s * 28) + 'px');
    void next.offsetWidth;
    next.style.transition = '';

    next.classList.add('is-active');
    if (prev) {
      prev.style.setProperty('--shift', (-s * 28) + 'px');
      prev.classList.remove('is-active');
    }
    currentName = name;
    updateTabs(name);
    next.focus({ preventScroll: true });
  }

  function updateTabs(name) {
    if (!tabbarEl) return;
    tabbarEl.classList.toggle('is-visible', name === 'home' || name === 'me' || name === 'awards' || name === 'settings');
    $$('.tab', tabbarEl).forEach(function (t) {
      if (t.dataset.tab === name) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
  }

  /* ---- Feedback --------------------------------------------------------- */

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 2400);
  }

  function vibrate(ms) {
    if (AF.Storage.getSettings().vibration && navigator.vibrate) navigator.vibrate(ms);
  }

  function shake(el) {
    if (isReduced() || !el.animate) return;
    el.animate(
      [
        { transform: 'translateX(0)' }, { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' },
        { transform: 'translateX(0)' }
      ],
      { duration: 280, easing: 'ease-out' }
    );
  }

  function applyMotion(reduced) {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
  }

  /* ---- Sheets ------------------------------------------------------------ */

  function openSheet(id) {
    const el = $('#sheet-' + id);
    if (!el) return;
    if (openSheetEl) closeSheet();
    lastFocus = document.activeElement;
    openSheetEl = el;
    el.classList.add('is-open');
    screensRoot.inert = true;
    if (tabbarEl) tabbarEl.inert = true;
    const first = $('[data-autofocus]', el) || $('button', el);
    if (first) first.focus({ preventScroll: true });
  }

  function closeSheet() {
    if (!openSheetEl) return false;
    const closedId = openSheetEl.id.replace(/^sheet-/, '');
    openSheetEl.classList.remove('is-open');
    openSheetEl = null;
    if (sheetClosed) sheetClosed(closedId);
    screensRoot.inert = false;
    if (tabbarEl) tabbarEl.inert = false;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    return true;
  }

  /* ---- Rendering --------------------------------------------------------- */

  function renderHome() {
    const S = AF.Storage, D = AF.Daily;
    const total = AF.Levels.TOTAL, playable = AF.Levels.PLAYABLE;
    const highest = S.getHighestUnlocked();
    const target = Math.max(1, Math.min(S.getCurrentLevel(), highest, playable));   // what Continue opens
    const cleared = S.completedCount();

    $('#home-level').textContent = highest;
    $('#home-chapter').textContent = AF.Levels.chapterOf(highest).name + ' chapter';
    $('#play-sub').textContent = (S.isAllCleared() ? 'Replay level ' : 'Level ') + target;
    $('#home-progress').textContent = cleared + ' of ' + total + ' levels cleared';
    $('#home-fill').style.setProperty('--p', Math.round((cleared / total) * 100) + '%');
    $('#home-note').textContent = highest > playable
      ? 'Level ' + highest + ' is unlocked but not built yet. Only levels 1 to ' + playable + ' are playable in this build.'
      : 'Levels 1 to ' + playable + ' are playable in this build.';

    const today = D.todayKey(), p = D.parseKey(today);
    const done = D.isCompleted(today);
    $('#home-date').textContent = D.longLabel(today);
    $('#home-daily-status').textContent = done ? 'Completed today' : 'Not completed yet';
    $('#home-daily-month').textContent = D.month(p.y, p.m).completed + ' done this month';
    $('#home-daily-label').textContent = done ? 'Play again' : 'Play today';
  }

  // view: { y, m } (m is 0-based).
  function renderDaily(view) {
    const D = AF.Daily;
    const d = D.month(view.y, view.m);
    const tk = D.todayKey();
    $('#daily-month').textContent = d.label;
    $('#cal-title').textContent = d.label;
    $('#daily-count').textContent = d.completed + ' completed ' + (d.isCurrent ? 'this month' : 'in ' + d.monthName);
    $('#daily-stars').textContent = D.totalCompleted() + ' virtual ' + (D.totalCompleted() === 1 ? 'star' : 'stars') + ' earned';

    let html = '';
    for (let i = 0; i < d.lead; i++) html += '<span class="day day--pad" aria-hidden="true"></span>';
    d.days.forEach(function (day) {
      const status = day.state === 'done' ? 'completed' : day.state === 'future' ? 'not available yet' : day.state === 'unavailable' ? 'no puzzle' : 'not completed';
      html += '<button type="button" class="day day--' + day.state + (day.today ? ' day--today' : '') + '"' +
        ' data-action="daily-open" data-date="' + day.key + '"' +
        ' aria-label="' + D.longLabel(day.key) + (day.today ? ', today' : '') + ', ' + status + '"' +
        (day.today ? ' aria-current="date"' : '') + (day.playable ? '' : ' disabled') + '>' +
        '<span>' + day.n + '</span>' + (day.state === 'done' ? icon('check', 'day__tick') : '') + '</button>';
    });
    $('#cal-grid').innerHTML = html;

    const prev = view.m === 0 ? { y: view.y - 1, m: 11 } : { y: view.y, m: view.m - 1 };
    const next = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };
    $('#cal-prev').disabled = !D.monthInRange(prev.y, prev.m);
    $('#cal-next').disabled = !D.monthInRange(next.y, next.m);
    $('#daily-play-label').textContent = D.isCompleted(tk) ? 'Replay today' : 'Play today';
  }

  function renderDailyComplete(key, firstTime) {
    const D = AF.Daily, p = D.parseKey(key);
    const m = D.month(p.y, p.m);
    $('#complete-title').textContent = 'Daily challenge cleared';
    $('#complete-sub').textContent = D.longLabel(key) + (firstTime ? ': 1 virtual star earned.' : ': already completed, so no extra star.');
    $('#complete-count').textContent = m.completed + ' of ' + m.length + ' ' + m.monthName + ' challenges completed';
    $('#complete-fill').style.setProperty('--p', Math.round((m.completed / m.length) * 100) + '%');
    $('#complete-next').hidden = true;
    const b = $('#complete-levels');
    b.dataset.action = 'daily';
    b.textContent = 'Daily Challenges';
  }

  function renderLevels() {
    const S = AF.Storage;
    const highest = S.getHighestUnlocked();
    const list = $('#levels-list');
    list.textContent = '';

    // Only the chapters a player can reach soon get tiles (every chapter up to the one after the current level);
    // later chapters are a plain locked row, which keeps this screen light with 1000 levels.
    const tilesUpTo = AF.Levels.chapterOf(Math.min(AF.Levels.TOTAL, highest)).to + 50;
    AF.Levels.CHAPTERS.forEach(function (ch) {
      let done = 0;
      let tiles = '';
      if (ch.from > tilesUpTo) {
        const row = document.createElement('section');
        row.className = 'chapter chapter--locked';
        row.innerHTML = '<header class="chapter__head"><h3 class="chapter__name">' + ch.name + '</h3>' +
          '<p class="chapter__meta">Levels ' + ch.from + ' to ' + ch.to + ' locked</p></header>';
        list.appendChild(row);
        return;
      }
      for (let id = ch.from; id <= ch.to; id++) {
        let state, label, inner;
        if (S.isCompleted(id)) {
          state = 'done'; done++;
          label = 'Level ' + id + ', completed';
          inner = id + icon('check', 'lvl__badge');
        } else if (id === highest) {
          state = 'current';
          label = 'Level ' + id + ', current';
          inner = String(id);
        } else {
          state = 'locked';
          label = 'Level ' + id + ', locked';
          inner = icon('lock');
        }
        tiles += '<button type="button" class="lvl lvl--' + state + '" data-action="open-level" data-level="' + id + '"' +
          ' aria-label="' + label + '"' + (state === 'locked' ? ' aria-disabled="true"' : '') + '>' + inner + '</button>';
      }
      const count = ch.to - ch.from + 1;
      const section = document.createElement('section');
      section.className = 'chapter';
      section.innerHTML =
        '<header class="chapter__head"><h3 class="chapter__name">' + ch.name + '</h3>' +
        '<p class="chapter__meta">' + done + ' of ' + count + '</p></header>' +
        '<div class="chapter__grid">' + tiles + '</div>';
      list.appendChild(section);
    });

    $('#levels-count').textContent = S.completedCount() + ' of ' + AF.Levels.TOTAL;

    // Centre the current level in the scroll area.
    const scroller = $('#levels-scroll');
    const target = $('.lvl--current', list) || $('.lvl--done:last-of-type', list);
    scroller.scrollTop = 0;
    if (target) {
      let top = 0;
      for (let n = target; n && n !== scroller; n = n.offsetParent) top += n.offsetTop;
      scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 2 + target.offsetHeight / 2);
    }
  }

  function renderGame(session) {
    $('.game__level').textContent = session.mode === 'daily' ? 'Daily ' + AF.Daily.shortLabel(session.dateKey) : 'Level ' + session.levelId;
    $('#game-count').textContent = session.cleared + '/' + session.total;
    const lives = $('#game-lives');
    if (lives) {
      lives.innerHTML = Array.from({ length: session.maxLives }, function (_, index) {
        return '<svg class="game__life' + (index >= session.lives ? ' game__life--spent' : '') +
          '" aria-hidden="true"><use href="#i-heart"/></svg>';
      }).join('');
      lives.setAttribute('aria-label', session.lives + ' of ' + session.maxLives + ' lives remaining');
    }
    const pct = session.total ? Math.round((session.cleared / session.total) * 100) : 0;
    const bar = $('#game-progress');
    bar.setAttribute('aria-valuenow', String(pct));
    bar.style.setProperty('--p', pct + '%');
    const undoBtn = $('.ctrl[data-action="undo"]');
    if (undoBtn) {
      undoBtn.classList.toggle('is-off', !session.canUndo);
      undoBtn.setAttribute('aria-disabled', session.canUndo ? 'false' : 'true');
    }
  }

  // hasNext: the following level exists AND can be played. Unlocked-but-unbuilt levels get an honest note instead.
  function renderComplete(levelId, hasNext) {
    const S = AF.Storage;
    const total = AF.Levels.TOTAL;
    const isLast = levelId >= total;
    const lv = $('#complete-levels');
    lv.dataset.action = 'levels';
    lv.textContent = 'Levels';
    $('#complete-title').textContent = 'Level ' + levelId + ' cleared';
    $('#complete-sub').textContent = isLast ? 'You have cleared all ' + total + ' levels.'
      : hasNext ? 'Level ' + (levelId + 1) + ' is unlocked.'
      : 'Level ' + (levelId + 1) + ' is unlocked, but its puzzle is not built yet.';
    $('#complete-count').textContent = S.completedCount() + ' of ' + total + ' levels cleared';
    $('#complete-fill').style.setProperty('--p', Math.round((S.completedCount() / total) * 100) + '%');
    $('#complete-next').hidden = isLast || !hasNext;
  }

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }

  function renderMe() {
    const S = AF.Storage, A = AF.Achievements;
    A.evaluate();
    const total = AF.Levels.TOTAL, cleared = S.completedCount(), sum = A.summary();
    $('#me-chapter').textContent = AF.Levels.chapterOf(S.getHighestUnlocked()).name + ' chapter';
    $('#me-progress').textContent = cleared + ' of ' + total + ' levels cleared';
    $('#me-fill').style.setProperty('--p', Math.round((cleared / total) * 100) + '%');
    $('#me-stat-campaign').textContent = cleared;
    $('#me-stat-daily').textContent = sum.daily;
    $('#me-stat-awards').textContent = sum.unlocked + '/' + sum.total;
    $('#me-awards-sub').textContent = sum.unlocked + ' of ' + sum.total + ' unlocked';

    const next = A.list().find(function (a) { return !a.unlocked; });
    $('#me-next-title').textContent = next ? 'Next: ' + next.title : 'All awards unlocked';
    $('#me-next-meta').textContent = next ? next.current + ' of ' + next.target : '';
    $('#me-next-fill').style.setProperty('--p', next ? Math.round((next.current / next.target) * 100) + '%' : '100%');
    $('#me-streak').textContent = sum.streak
      ? 'Daily streak: ' + sum.streak + (sum.streak === 1 ? ' day' : ' days')
      : 'No Daily Challenge streak right now';
  }

  function renderAwards() {
    const A = AF.Achievements;
    A.evaluate();
    const list = A.list(), sum = A.summary();
    $('#awards-count').textContent = sum.unlocked + ' of ' + sum.total;
    $('#awards-list').innerHTML = list.map(function (a) {
      const status = a.unlocked ? 'Unlocked' + (a.at ? ' · ' + fmtDate(a.at) : '') : 'Locked';
      const pct = Math.round((a.current / a.target) * 100);
      return '<article class="award' + (a.unlocked ? ' award--on' : '') + '" aria-label="' + a.title + ', ' + status.replace(' · ', ', ') + '">' +
        '<span class="award__badge">' + icon(a.icon, '').replace('#i-' + a.icon, '#' + a.icon) +
        (a.unlocked ? '' : '<span class="award__lock">' + icon('lock') + '</span>') + '</span>' +
        '<div><h3 class="award__title">' + a.title + '</h3>' +
        '<p class="award__desc">' + a.desc + '</p>' +
        '<span class="award__status">' + status + '</span>' +
        '<div class="award__prog"><div class="aprog" aria-hidden="true"><span style="--p:' + pct + '%"></span></div>' +
        '<span class="award__count">' + a.current + ' / ' + a.target + ' ' + a.unit + '</span></div>' +
        (a.note ? '<p class="award__note">' + a.note + '</p>' : '') +
        '</div></article>';
    }).join('');
  }

  function renderAbout() {
    $('#about-version').textContent = 'Version ' + AF.APP_VERSION + ' (demo build)';
    $('#about-levels').textContent = AF.Levels.PLAYABLE + ' of ' + AF.Levels.TOTAL + ' levels are playable in this build.';
  }

  function renderSettings() {
    const settings = AF.Storage.getSettings();
    $$('[data-setting]').forEach(function (btn) {
      btn.setAttribute('aria-checked', String(!!settings[btn.dataset.setting]));
    });
    const v = $('#settings-version');
    if (v) v.textContent = 'Arrow Flow demo build ' + AF.APP_VERSION + '.';
  }

  /* ---- Input -------------------------------------------------------------- */

  // One delegated listener; handlers are keyed by data-action.
  function bindActions(handlers) {
    document.addEventListener('click', function (e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const fn = handlers[el.dataset.action];
      if (!fn) return;
      vibrate(6);
      fn(el, e);
    });
  }

  // Spoken/visually-hidden status for screen readers (blocked and successful moves).
  function announce(text) {
    if (!liveEl) return;
    liveEl.textContent = '';
    setTimeout(function () { liveEl.textContent = text; }, 30);
  }

  let backHandler = null;

  // Returns true when the back action was consumed (a sheet was closed or the screen handler stepped back).
  function goBack(handler) {
    if (openSheetEl && openSheetEl.id === 'sheet-game-over') return true;   // must be answered, never dismissed
    if (closeSheet()) return true;
    return handler(currentName) === true;
  }

  function onBack(handler) {
    backHandler = handler;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      goBack(handler);
    });
  }

  AF.UI = {
    init: init,
    show: show,
    currentName: function () { return currentName; },
    toast: toast,
    vibrate: vibrate,
    shake: shake,
    applyMotion: applyMotion,
    openSheet: openSheet,
    closeSheet: closeSheet,
    renderHome: renderHome,
    renderDaily: renderDaily,
    renderDailyComplete: renderDailyComplete,
    renderLevels: renderLevels,
    renderGame: renderGame,
    renderComplete: renderComplete,
    renderMe: renderMe,
    renderAwards: renderAwards,
    renderAbout: renderAbout,
    renderSettings: renderSettings,
    bindActions: bindActions,
    announce: announce,
    onSheetClose: function (fn) { sheetClosed = fn; },
    onBack: onBack,
    handleBack: function () { return backHandler ? goBack(backHandler) : false; }
  };
})(window.AF = window.AF || {});
