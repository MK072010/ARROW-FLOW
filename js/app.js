/* App wiring: boots the game, connects UI actions to Storage and Game. */
(function (AF) {
  'use strict';

  const Levels = AF.Levels, Storage = AF.Storage, Game = AF.Game, UI = AF.UI, Tutorial = AF.Tutorial;
  const boardEl = function () { return document.getElementById('board'); };

  const nextTimer = { id: 0 };
  let nextBusy = false;             // true while the Next-level tap waits on a possible interstitial (blocks double taps)

  const Daily = AF.Daily, Ach = AF.Achievements;
  let settingsFrom = 'home';            // where Settings was opened from, so its Back button returns there
  let tutorialReturn = 'settings';      // where a replayed tutorial returns to (Settings or Help)
  let dailyView = null;                 // { y, m } month shown on the Daily screen

  function arrowNumber(levelId, arrowId) {
    const puzzle = Game.getPuzzle();
    return puzzle ? puzzle.arrows.findIndex(function (a) { return a.id === arrowId; }) + 1 : 0;
  }

  /* Starts a level. `resume` restores arrows already cleared earlier in this unfinished level
     (only for Play / the level grid); Next and Replay always start from the original puzzle. */
  function startLevel(id, dir, resume) {
    if (!Levels.isPlayable(id)) {
      UI.toast('Level ' + id + ' is not built yet. Only the first ' + Levels.PLAYABLE + ' levels are playable.');
      return false;
    }
    clearTimeout(nextTimer.id);
    if (!resume) Storage.clearLevelProgress();
    const snap = Game.loadLevel(id, resume ? Storage.getLevelProgress(id) : null);
    if (!snap) { UI.toast('This level could not be loaded.'); return false; }
    Storage.setCurrentLevel(id);
    UI.renderGame(snap);
    AF.Extra.begin();
    UI.show('game', dir || 'forward');
    return true;
  }

  // The level Play should open: where the player was, but never an unbuilt placeholder.
  function resumeTarget() {
    return Math.max(1, Math.min(Storage.getCurrentLevel(), Storage.getHighestUnlocked(), Levels.PLAYABLE));
  }

  function goLevels() {
    Game.leave();
    const dir = UI.currentName() === 'home' ? 'forward' : 'back';
    UI.renderLevels();
    UI.show('levels', dir);
  }

  /* ---- Me tab and its sub-screens ------------------------------------------- */

  // Tab changes never touch campaign or Daily progress; they only switch which screen is shown.
  function goMe(dir) {
    UI.renderMe();
    UI.show('me', dir || 'fade');
  }

  const SUBSCREENS = {
    awards: function () { UI.renderAwards(); },
    help: function () {},
    about: function () { UI.renderAbout(); },
    rights: function () {},
    prefs: function () { renderConsentRecord(); }
  };

  // One toast/announcement for any awards earned by the event that just happened.
  function announceAwards(fresh) {
    if (!fresh || !fresh.length) return;
    const names = fresh.map(function (a) { return a.title; }).join(', ');
    UI.toast('Award unlocked: ' + names);
    UI.announce('Award unlocked: ' + names + '.');
  }

  function goHome(dir) {
    Game.leave();
    UI.renderHome();
    UI.show('home', dir || 'back');
  }

  /* ---- Daily Challenge ------------------------------------------------------- */

  function currentMonthView() {
    const t = Daily.parseKey(Daily.todayKey());
    return { y: t.y, m: t.m };
  }

  // reset: jump back to the current month (tabs); otherwise keep the month the player was browsing.
  function goDaily(reset, dir) {
    Game.leave();
    if (reset || !dailyView) dailyView = currentMonthView();
    UI.renderDaily(dailyView);
    UI.show('daily', dir || 'back');
  }

  function maybeShowDailyIntro() {
    if (Daily.introSeen()) return;
    setTimeout(function () {
      if (UI.currentName() === 'daily' && !Daily.introSeen()) UI.openSheet('daily-intro');
    }, 450);
  }

  function shiftMonth(delta) {
    if (!dailyView) dailyView = currentMonthView();
    let y = dailyView.y, m = dailyView.m + delta;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    if (!Daily.monthInRange(y, m)) return;
    dailyView = { y: y, m: m };
    UI.renderDaily(dailyView);
  }

  function startDaily(key, dir) {
    if (!Daily.canPlay(key)) {
      UI.toast(!Daily.parseKey(key) ? 'That date is not valid.'
        : key > Daily.todayKey() ? 'That challenge is not available yet.'
        : 'No puzzle is available for that day.');
      return false;
    }
    const puzzle = Daily.puzzleFor(key);
    const snap = puzzle ? Game.loadDaily(key, puzzle) : null;
    if (!snap) { UI.toast('This challenge could not be loaded.'); return false; }
    clearTimeout(nextTimer.id);
    UI.renderGame(snap);
    AF.Extra.begin();
    UI.show('game', dir || 'forward');
    return true;
  }

  /* Reached only from the engine's daily completion event (every arrow exited, fired once).
     Writes the daily record only: campaign progress is never touched. */
  function onDailyComplete(key) {
    AF.Extra.finish(null, Game.getState().lives);
    const res = Daily.complete(key);
    announceAwards(Ach.recordDaily());
    UI.vibrate(25);
    UI.announce('Daily challenge cleared.');
    clearTimeout(nextTimer.id);
    nextTimer.id = setTimeout(function () {
      const st = Game.getState();
      if (UI.currentName() !== 'game' || st.mode !== 'daily' || st.dateKey !== key || st.status !== 'complete') return;
      UI.renderDailyComplete(key, res.firstTime);
      UI.show('complete', 'forward');
    }, document.documentElement.dataset.motion === 'reduced' ? 150 : 450);
  }

  function refreshClockViews() {
    const name = UI.currentName();
    if (name === 'home') UI.renderHome();
    else if (name === 'daily') { dailyView = dailyView || currentMonthView(); UI.renderDaily(dailyView); }
    else if (name === 'me') UI.renderMe();
    else if (name === 'awards') UI.renderAwards();
  }

  /* The ONLY route to the complete screen. Game calls this once, and only after every arrow has exited. */
  function onLevelComplete(levelId) {
    AF.Extra.finish(levelId, Game.getState().lives);
    Storage.completeLevel(levelId);
    announceAwards(Ach.recordLevel(levelId));
    const hasNext = levelId < Levels.TOTAL && Levels.isPlayable(levelId + 1);
    UI.vibrate(25);
    UI.announce('Level ' + levelId + ' cleared.');
    clearTimeout(nextTimer.id);
    // Brief beat so the last arrow's exit and the full progress bar are seen before the screen changes.
    nextTimer.id = setTimeout(function () {
      const st = Game.getState();
      if (UI.currentName() !== 'game' || st.levelId !== levelId || st.status !== 'complete') return;
      UI.renderComplete(levelId, hasNext);
      UI.show('complete', 'forward');
    }, document.documentElement.dataset.motion === 'reduced' ? 150 : 450);
  }

  // Shows one hint using one of the player's hints (free or earned). Ad logic is not involved here.
  function giveHint() {
    if (AF.Extra.hints() <= 0) return;
    const r = Game.hint();
    if (r.status === 'ok') {
      AF.Extra.useHint();
      UI.announce('Hint: arrow ' + arrowNumber(null, r.arrowId) + ' can exit.');
      UI.toast('Try the highlighted arrow.');
    } else if (r.status === 'none') UI.toast('No arrow can exit right now.');
  }

  function openPause() {
    if (Game.getState().status === 'complete') return;
    const exitBtn = document.querySelector('#sheet-pause [data-action="exit-level"]');
    if (exitBtn) exitBtn.textContent = Game.getState().mode === 'daily' ? 'Back to Daily' : 'Back to levels';
    UI.openSheet('pause');
    AF.Extra.pause();
    Game.pauseGame();
  }

  /* ---- Onboarding flow: Welcome -> Accept -> Tutorial -> Level 1 ------------ */

  function showWelcome(dir) {
    document.getElementById('welcome-update').hidden = !Storage.consentSuperseded();
    UI.show('welcome', dir || 'fade');
  }

  function afterTutorial(replay) {
    Tutorial.stop();
    if (replay) {
      if (tutorialReturn === 'settings') UI.renderSettings();
      UI.show(tutorialReturn, 'back');
    } else {
      // A brand-new player is always on Level 1; someone who already had progress resumes where they were.
      startLevel(resumeTarget(), 'forward', true);
    }
  }

  function startTutorial(replay, dir) {
    Tutorial.start({
      replay: replay,
      // Only a first-run tutorial writes state. Completion is recorded when the puzzle is cleared,
      // a skip is recorded only after the explicit Skip tap.
      onComplete: function () { if (!replay) Storage.completeTutorial('completed'); },
      onSkip: function () { if (!replay) Storage.completeTutorial('skipped'); afterTutorial(replay); },
      onContinue: function () { afterTutorial(replay); }
    });
    UI.show('tutorial', dir || 'fade');
  }

  function renderConsentRecord() {
    const c = Storage.getConsent();
    let text = '';
    if (c) {
      let when = c.acceptedAt;
      try { when = new Date(c.acceptedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { /* keep ISO text */ }
      text = 'Terms & Privacy Policy version ' + c.version + ' accepted on ' + when + '.';
    }
    const a = document.getElementById('consent-record');
    const b = document.getElementById('prefs-consent-record');
    if (a) a.textContent = text;
    if (b) b.textContent = text || 'Not recorded yet.';
  }

  // Decides the first screen after launch. `ret` is set when the player comes back from a legal page.
  function route(ret) {
    if (!Storage.hasCurrentConsent()) { if (ret === 'welcome' || Storage.consentSuperseded()) showWelcome('fade'); else UI.show('onboarding', 'fade'); }
    else if (ret === 'settings') { settingsFrom = 'home'; UI.renderSettings(); renderConsentRecord(); UI.show('settings', 'fade'); }
    else if (ret === 'me') { UI.renderMe(); UI.show('me', 'fade'); }
    else if (!Storage.isTutorialDone()) startTutorial(false, 'fade');
    else { UI.renderHome(); UI.show('home', 'fade'); }
  }

  function readReturnParam() {
    let ret = null;
    try {
      const v = new URLSearchParams(window.location.search).get('return');
      if (v === 'welcome' || v === 'settings' || v === 'me') ret = v;
      if (v !== null && window.history.replaceState) window.history.replaceState(null, '', window.location.pathname);
    } catch (e) { /* keep whatever was read */ }
    return ret;
  }

  const actions = {
    play: function () { startLevel(resumeTarget(), 'forward', true); },
    levels: goLevels,
    daily: function () { goDaily(false, 'back'); },
    'tab-main': function () { if (UI.currentName() !== 'home') goHome('fade'); },
    'tab-awards': function () { if (UI.currentName() === 'awards') return; AF.subFrom = 'home'; UI.renderAwards(); UI.show('awards', 'fade'); },
    'tab-settings': function () { if (UI.currentName() === 'settings') return; settingsFrom = 'home'; UI.renderSettings(); renderConsentRecord(); UI.show('settings', 'fade'); },
    'tab-me': function () { if (UI.currentName() !== 'me') goMe('fade'); },
    'go-me': function () { goMe('back'); },
    'open-screen': function (el) {
      const t = el.dataset.target;
      if (!SUBSCREENS[t]) return;
      AF.subFrom = UI.currentName();
      SUBSCREENS[t]();
      UI.show(t, 'forward');
    },
    'settings-back': function () { if (settingsFrom === 'me') goMe('back'); else goHome('back'); },
    'reopen-daily-intro': function () { UI.openSheet('daily-intro'); },
    'erase-ask': function () { UI.openSheet('erase'); },
    'erase-confirm': function () {
      // Removes every key this game owns, then restarts so no stale in-memory state survives.
      try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('arrowflow.') === 0) keys.push(k); }
        keys.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* storage unavailable: nothing to remove */ }
      UI.closeSheet();
      window.location.reload();
    },
    'tab-daily': function () {
      if (UI.currentName() === 'daily') return;
      goDaily(true, 'fade');
      maybeShowDailyIntro();
    },
    'daily-play-today': function () { startDaily(Daily.todayKey(), 'forward'); },
    'daily-open': function (el) { startDaily(el.dataset.date, 'forward'); },
    'cal-prev': function () { shiftMonth(-1); },
    'cal-next': function () { shiftMonth(1); },
    'daily-intro-continue': function () { UI.closeSheet(); },    // dismissal is saved by the sheet-close hook
    'daily-intro-skip': function () { UI.closeSheet(); },
    'retry-failed-level': function () {
      UI.closeSheet();
      Storage.clearLevelProgress();
      const snap = Game.restartLevel();
      if (snap) UI.renderGame(snap);
      else UI.toast('This puzzle could not be restarted.');
    },
    'exit-failed-level': function () {
      UI.closeSheet();
      goLevels();
    },

    // Never deletes silently: with saved progress it asks first.
    'new-game': function () {
      const cur = Storage.getCurrentLevel();
      const progress = Storage.getLevelProgress(cur);
      const hasProgress = Storage.getHighestUnlocked() > 1 || Storage.completedCount() > 0 ||
        progress.exited.length > 0 || progress.lives < Levels.LIVES_PER_LEVEL;
      if (!hasProgress) { startLevel(1, 'forward', false); return; }
      document.getElementById('newgame-desc').textContent = 'You are on level ' + Storage.getHighestUnlocked() + ' with ' + Storage.completedCount() +
        ' of ' + Levels.TOTAL + ' levels cleared. Starting over erases this campaign progress. Earned awards and Daily Challenge history are kept.';
      UI.openSheet('newgame');
    },
    'newgame-confirm': function () {
      UI.closeSheet();
      Storage.resetProgress();
      Ach.resetCampaignTally();
      UI.renderHome();
      startLevel(1, 'forward', false);
    },
    settings: function () {
      settingsFrom = UI.currentName() === 'me' ? 'me' : UI.currentName() === 'home' ? 'home' : 'me';
      UI.renderSettings(); renderConsentRecord(); UI.show('settings', 'forward');
    },

    'accept-consent': function () {
      if (UI.currentName() !== 'welcome') return;          // ignore double taps
      Storage.acceptConsent();
      if (Storage.isTutorialDone()) { UI.renderHome(); UI.show('home', 'forward'); }
      else startTutorial(false, 'forward');
    },
    'tutorial-skip': function () { Tutorial.skip(); },
    'tutorial-continue': function () { Tutorial.proceed(); },
    'replay-tutorial': function () {
      tutorialReturn = UI.currentName() === 'help' ? 'help' : 'settings';
      startTutorial(true, 'forward');
    },
    'go-home': function () { goHome('back'); },

    'open-level': function (el) {
      const id = Number(el.dataset.level);
      if (id > Storage.getHighestUnlocked()) {
        UI.shake(el);
        UI.vibrate(20);
        UI.toast('Clear level ' + Storage.getHighestUnlocked() + ' to unlock this one.');
        return;
      }
      startLevel(id, 'forward', true);
    },

    pause: openPause,
    resume: function () { UI.closeSheet(); },          // closing the sheet resumes the game (see onSheetClose below)
    restart: function () {
      UI.closeSheet();
      if (Game.getState().mode !== 'daily') Storage.clearLevelProgress();   // a daily restart never touches campaign saves
      const snap = Game.restartLevel();
      if (snap) { UI.renderGame(snap); AF.Extra.begin(); }
    },
    'exit-level': function () {
      const daily = Game.getState().mode === 'daily';
      UI.closeSheet();
      if (daily) goDaily(false, 'back'); else goLevels();
    },
    'close-sheet': function () { UI.closeSheet(); },

    undo: function () {
      if (UI.currentName() !== 'game') return;
      const r = Game.undo();
      if (r.status === 'ok') {
        UI.vibrate(10);
        UI.announce('Move undone. Arrow ' + arrowNumber(null, r.arrowId) + ' is back. ' + (Game.getState().total - Game.getState().cleared) + ' left.');
      } else if (r.status === 'empty') UI.toast('Nothing to undo yet.');
    },
    hint: function () {
      if (UI.currentName() !== 'game') return;
      if (AF.Extra.hints() <= 0) {
        // Always offer the rewarded flow in the Android app; the ad layer waits briefly if it is still loading.
        if (AF.Ads.hasProvider()) UI.openSheet('hint-ad'); else UI.toast('No hints left. Rewarded ads are available in the Android app.');
        return;
      }
      giveHint();
    },
    'hint-ad-watch': function () {
      UI.closeSheet();
      const st0 = Game.getState();
      UI.toast('Loading rewarded ad…');
      AF.Ads.showRewarded().then(function (earned) {
        const st = Game.getState();
        // Grant only if the SDK confirmed the reward AND the same puzzle is still on screen and unfinished.
        if (!earned) { UI.toast('No hint earned. Ads are not always available.'); return; }
        // The reward was confirmed by the SDK, so it is always banked (once: the ads layer settles each token a single time).
        AF.Extra.grantHint();
        // Only use it right away if the same puzzle is still on screen and unfinished; otherwise it stays in the balance.
        if (UI.currentName() !== 'game' || st.status !== 'playing' || st.levelId !== st0.levelId || st.dateKey !== st0.dateKey) return;
        giveHint();
      });
    },

    'next-level': function () {
      if (nextBusy) return;
      nextBusy = true;
      const done = Game.getState().levelId;
      // Natural break: the level is already saved as complete. A capped interstitial may show here; the player always continues.
      const go = function () {
        nextBusy = false;
        if (UI.currentName() === 'complete') startLevel(done + 1, 'forward', false);
      };
      AF.Ads.maybeShowInterstitial(done).then(go, go);
    },
    replay: function () {
      const st = Game.getState();
      if (st.mode === 'daily') startDaily(st.dateKey, 'fade');
      else startLevel(st.levelId, 'fade', false);
    },

    'toggle-setting': function (el) {
      const key = el.dataset.setting;
      const value = !Storage.getSettings()[key];
      Storage.setSetting(key, value);
      UI.renderSettings();
      if (key === 'reduceMotion') UI.applyMotion(value);
      if (key === 'vibration' && value && navigator.vibrate) navigator.vibrate(15);
    },
    'reset-ask': function () { UI.openSheet('erase'); },
    'reset-confirm': function () {
      Storage.resetProgress();
      Ach.resetCampaignTally();
      UI.closeSheet();
      UI.renderHome();
      UI.toast('Progress reset. Level 1 is ready.');
    }
  };

  // Where "back" goes from each screen (Escape key now, Android back button later).
  // Returns true when the back press was handled inside the app; false means "nothing to go back to" (home, welcome).
  function back(screen) {
    if (screen === 'settings') { if (settingsFrom === 'me') goMe('back'); else goHome(); return true; }
    if (screen === 'me') { goHome('fade'); return true; }
    if (SUBSCREENS[screen]) { goMe('back'); return true; }
    if (screen === 'levels') { goHome(); return true; }
    if (screen === 'daily') { goHome('fade'); return true; }
    if (screen === 'game') { openPause(); return true; }
    if (screen === 'complete') { if (Game.getState().mode === 'daily') goDaily(false, 'back'); else goLevels(); return true; }
    if (screen === 'tutorial') { if (Tutorial.isReplay()) Tutorial.skip(); return true; }   // first-run tutorial: Skip/finish are the ways out
    return false;   // home, splash, welcome, onboarding: let the Android app exit
  }

  function boot() {
    UI.init();
    UI.applyMotion(Storage.getSettings().reduceMotion);
    UI.renderHome();
    UI.renderSettings();

    // The playable board. Game.init binds its listeners once, so repeated level loads never stack handlers.
    Game.init(boardEl(), {
      onChange: function (snap) { UI.renderGame(snap); },
      // A move is only saved here, after its exit animation has finished (never mid-animation).
      onExited: function (snap) {
        if (snap.mode !== 'daily' && snap.cleared < snap.total) Storage.saveLevelProgress(snap.levelId, snap.exited, snap.lives);
        AF.Extra.move();
        UI.vibrate(10);
        UI.announce('Arrow ' + arrowNumber(snap.levelId, snap.exited[snap.exited.length - 1]) + ' cleared. ' + (snap.total - snap.cleared) + ' left.');
      },
      onBlocked: function (info) {
        const snap = Game.getState();
        if (snap.mode !== 'daily') {
          if (info.lives > 0) Storage.saveLevelProgress(snap.levelId, snap.exited, info.lives);
          else Storage.clearLevelProgress();
        }
        AF.Extra.move();
        UI.vibrate(18);
        UI.toast(info.outOfLives ? 'No lives left. Restart this level.' : 'Life lost. ' + info.lives + ' left.');
        UI.announce('Arrow ' + arrowNumber(snap.levelId, info.arrowId) + ' is blocked by arrow ' +
          arrowNumber(snap.levelId, info.blockerId) + '. ' + (info.outOfLives ? 'No lives remain.' : info.lives + ' lives remain.'));
        if (info.outOfLives) UI.openSheet('game-over');
      },
      // An undone move is removed from the saved list too, so a reload resumes from what is really on the board.
      onUndo: function (snap) { if (snap.mode !== 'daily') Storage.saveLevelProgress(snap.levelId, snap.exited, snap.lives); },
      onRestart: function (snap) { if (!snap || snap.mode !== 'daily') Storage.clearLevelProgress(); },
      onComplete: onLevelComplete,
      onDailyComplete: onDailyComplete
    });
    // Closing the pause sheet by any route (button, scrim, Escape) resumes play.
    UI.onSheetClose(function (id) {
      if (id === 'pause') { Game.resumeGame(); AF.Extra.resume(); }
      else if (id === 'daily-intro') Daily.markIntroSeen();     // Continue, Skip, scrim tap and Escape all count as dismissal
    });
    // Ads run in their own full-screen view; keep the game's own timer still while one is on screen and resume after.
    AF.Ads.setHooks({
      start: function () { AF.Extra.pause(); },
      end: function () { if (UI.currentName() === 'game' && Game.getState().status === 'playing') AF.Extra.resume(); }
    });
    // Leaving the app or tab mid-level pauses it, so nothing runs unseen. Coming back re-reads today's date.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && !AF.Ads.isBusy() && UI.currentName() === 'game' && Game.getState().status === 'playing') openPause();
      else if (!document.hidden) refreshClockViews();
    });

    Tutorial.init();
    UI.bindActions(Object.assign(actions, AF.extraActions || {}));
    UI.onBack(back);

    // Coming back from the Privacy Policy / Terms pages: skip the splash and land where the player was.
    const ret = readReturnParam();

    // Leave the splash automatically, or sooner on tap.
    let left = false;
    const leaveSplash = function () {
      if (left) return;
      left = true;
      route(ret);
    };
    if (ret) { leaveSplash(); return; }
    const delay = Storage.getSettings().reduceMotion ? 700 : 2200;
    setTimeout(leaveSplash, delay);
    document.querySelector('.splash').addEventListener('click', leaveSplash);
  }

  AF.back = function () { back(UI.currentName()); };
  AF.handleBack = function () { return UI.handleBack(); };   // used by the Android app's back button
  AF.showDailyIntro = function () { UI.openSheet('daily-intro'); };   // for a future Help screen

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.AF = window.AF || {});
