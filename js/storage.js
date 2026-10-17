/* Persistence: localStorage only. Saves the highest unlocked level, the level the player was on,
   the arrows already cleared in that unfinished level, basic settings, and the onboarding record
   (consent version + timestamp, tutorial status). Only COMPLETED moves are ever saved: an arrow that
   is still animating out is never written.
   Every access is wrapped in try/catch so private modes or blocked storage never crash the game.
   If storage is unavailable the values still live in memory for the session. */
(function (AF) {
  'use strict';

  // The application version shown in About and Settings. Change it here when a new build is made.
  AF.APP_VERSION = '0.1';

  const KEY = 'arrowflow.save.v1';
  const ONB_KEY = 'arrowflow.onboarding.v1';
  const TOTAL = AF.Levels.TOTAL;
  const LEGACY_TOTAL = 50;           // the campaign length before the 1000-level pack
  const MAX_LIVES = AF.Levels.LIVES_PER_LEVEL || 3;

  // Bump this whenever the Terms & Conditions or Privacy Policy change in a way that needs
  // fresh acceptance. Players who accepted an older version will see the welcome screen again.
  const CONSENT_VERSION = '1.0';

  function defaults() {
    const prefersReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    return {
      highestUnlocked: 1,
      allCleared: false,
      currentLevel: 1,
      // Finished arrows and remaining lives for the unfinished level.
      levelProgress: null,   // { levelId, exited: ['a', 'c', ...], lives: 1..MAX_LIVES }
      settings: { sound: true, music: true, vibration: true, reduceMotion: prefersReduced }
    };
  }

  // Accept only well-formed values from disk.
  function sanitize(raw) {
    const base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    let level = Number.isInteger(raw.highestUnlocked) ? raw.highestUnlocked : 1;
    // Saves from the 50-level build: a player who had cleared all 50 now continues at level 51.
    if (raw.allCleared === true && level === LEGACY_TOTAL && TOTAL > LEGACY_TOTAL) level = LEGACY_TOTAL + 1;
    base.highestUnlocked = Math.max(1, Math.min(TOTAL, level));
    base.allCleared = raw.allCleared === true && base.highestUnlocked === TOTAL;
    const cur = Number.isInteger(raw.currentLevel) ? raw.currentLevel : base.highestUnlocked;
    base.currentLevel = Math.max(1, Math.min(base.highestUnlocked, cur));
    const lp = raw.levelProgress;
    if (lp && typeof lp === 'object' && Number.isInteger(lp.levelId) && lp.levelId >= 1 && lp.levelId <= base.highestUnlocked &&
        Array.isArray(lp.exited) && lp.exited.length <= 300 &&
        lp.exited.every(function (v) { return typeof v === 'string' && v.length <= 8; })) {
      const lives = Number.isInteger(lp.lives) ? Math.max(1, Math.min(MAX_LIVES, lp.lives)) : MAX_LIVES;
      if (lp.exited.length || lives < MAX_LIVES) {
        base.levelProgress = { levelId: lp.levelId, exited: lp.exited.slice(), lives: lives };   // the game re-verifies the order before using it
      }
    }
    if (raw.settings && typeof raw.settings === 'object') {
      Object.keys(base.settings).forEach(function (k) {
        if (typeof raw.settings[k] === 'boolean') base.settings[k] = raw.settings[k];
      });
    }
    return base;
  }

  function load() {
    try {
      const text = localStorage.getItem(KEY);
      return text ? sanitize(JSON.parse(text)) : defaults();
    } catch (e) {
      return defaults();
    }
  }

  let state = load();

  /* ---- Onboarding record (kept separate from the game save) ------------- */

  function validTime(t) { return typeof t === 'string' && !isNaN(Date.parse(t)); }

  function sanitizeOnboarding(raw) {
    const out = { consent: null, tutorial: null };
    if (!raw || typeof raw !== 'object') return out;
    const c = raw.consent;
    if (c && typeof c === 'object' && typeof c.version === 'string' && c.version && validTime(c.acceptedAt)) {
      out.consent = { version: c.version, acceptedAt: c.acceptedAt };
    }
    const t = raw.tutorial;
    if (t && typeof t === 'object' && (t.status === 'completed' || t.status === 'skipped') && validTime(t.at)) {
      out.tutorial = { status: t.status, at: t.at };
    }
    return out;
  }

  function loadOnboarding() {
    try {
      const text = localStorage.getItem(ONB_KEY);
      return sanitizeOnboarding(text ? JSON.parse(text) : null);
    } catch (e) {
      return sanitizeOnboarding(null);
    }
  }

  let onboarding = loadOnboarding();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  function saveOnboarding() {
    try { localStorage.setItem(ONB_KEY, JSON.stringify(onboarding)); } catch (e) { /* storage unavailable */ }
  }

  AF.Storage = {
    getHighestUnlocked: function () { return state.highestUnlocked; },
    isAllCleared: function () { return state.allCleared; },

    // Levels clear in order, so everything below the highest unlocked level is complete.
    isCompleted: function (id) { return state.allCleared || id < state.highestUnlocked; },
    completedCount: function () { return state.allCleared ? TOTAL : state.highestUnlocked - 1; },

    // Call only from the game's genuine completion callback (every arrow has exited).
    completeLevel: function (id) {
      if (id === state.highestUnlocked) {
        if (id < TOTAL) state.highestUnlocked = id + 1;
        else state.allCleared = true;
      }
      if (state.levelProgress && state.levelProgress.levelId === id) state.levelProgress = null;
      state.currentLevel = Math.min(state.highestUnlocked, id < TOTAL ? id + 1 : id);
      save();
    },

    /* ---- Resume ------------------------------------------------------------ */
    getCurrentLevel: function () { return state.currentLevel; },
    setCurrentLevel: function (id) {
      if (Number.isInteger(id) && id >= 1 && id <= state.highestUnlocked && state.currentLevel !== id) {
        state.currentLevel = id;
        save();
      }
    },
    // Arrows already cleared in an unfinished level (empty when none were saved for that level).
    getLevelProgress: function (id) {
      return state.levelProgress && state.levelProgress.levelId === id
        ? { exited: state.levelProgress.exited.slice(), lives: state.levelProgress.lives }
        : { exited: [], lives: MAX_LIVES };
    },
    saveLevelProgress: function (id, exited, lives) {
      if (!Number.isInteger(id) || !Array.isArray(exited)) return;
      const safeLives = Number.isInteger(lives) ? Math.max(1, Math.min(MAX_LIVES, lives)) : MAX_LIVES;
      state.levelProgress = exited.length || safeLives < MAX_LIVES
        ? { levelId: id, exited: exited.slice(), lives: safeLives }
        : null;
      save();
    },
    clearLevelProgress: function () {
      if (state.levelProgress) { state.levelProgress = null; save(); }
    },

    getSettings: function () { return Object.assign({}, state.settings); },
    setSetting: function (key, value) {
      if (key in state.settings) { state.settings[key] = !!value; save(); }
    },

    /* ---- Consent and tutorial ------------------------------------------ */
    CONSENT_VERSION: CONSENT_VERSION,
    getConsent: function () { return onboarding.consent ? Object.assign({}, onboarding.consent) : null; },
    hasCurrentConsent: function () { return !!onboarding.consent && onboarding.consent.version === CONSENT_VERSION; },
    // True when the player accepted an older version, so the welcome screen can say the documents changed.
    consentSuperseded: function () { return !!onboarding.consent && onboarding.consent.version !== CONSENT_VERSION; },
    // Call only from an explicit tap on "Accept & Continue".
    acceptConsent: function () {
      onboarding.consent = { version: CONSENT_VERSION, acceptedAt: new Date().toISOString() };
      saveOnboarding();
    },
    isTutorialDone: function () { return !!onboarding.tutorial; },
    // status: 'completed' (finished it) or 'skipped' (explicit skip).
    completeTutorial: function (status) {
      onboarding.tutorial = { status: status === 'skipped' ? 'skipped' : 'completed', at: new Date().toISOString() };
      saveOnboarding();
    },

    // Progress only. Settings, consent and tutorial status are kept.
    resetProgress: function () {
      state.highestUnlocked = 1;
      state.allCleared = false;
      state.currentLevel = 1;
      state.levelProgress = null;
      save();
    }
  };
})(window.AF = window.AF || {});
