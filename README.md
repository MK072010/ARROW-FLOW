# Arrow Flow

Arrow Flow is a complete, mobile-first arrow puzzle game made with plain HTML, CSS, and JavaScript. It has 1,000 campaign levels, three lives per attempt (blocked taps cost one life), a daily challenge, hints, undo, restart, pause/resume, achievements, settings, onboarding and local progress saving.

## Run it

`index.html` is the starting file. Open it in a modern browser, or host this folder as a static website. No install, compilation, backend, account, paid service, or third-party library is needed.

Some browsers restrict persistent storage for pages opened with `file://`. If saves do not persist when opening the file directly, serve this folder with any static file server or publish it to a static host. The game itself still runs entirely in the browser.

Android: `android/` contains a thin WebView wrapper (with optional Google AdMob ads) that bundles these files; see `android/README.md`, `android/PRODUCTION.md` and `ADMOB_SETUP.md`. In a plain browser there are no ads at all.

## Source layout

- `index.html` — app screens and the game interface
- `css/` — responsive layout and screen styles
- `js/` — puzzle rules, level loader, game state, UI, settings and storage
- `data/` — the permanent level packs: `levels.v1.json` (1,000 campaign levels) and `daily.v1.json` (392 Daily Challenge puzzles), each also shipped as a `.js` file the page loads (works offline and from `file://`)
- `tools/` — Node scripts that build and verify the packs (not needed to play)
- `assets/` — local app icon
- `terms/` and `privacy-policy/` — linked legal information pages

Campaign progress and settings are saved only in the browser's LocalStorage on the current device. The game does not need a server or network connection.

## Levels

- All campaign levels are stored in `data/levels.v1.json` and were generated and validated **once**. The game never generates levels at play time, so every player sees the same layout, arrows and board size for each level. Levels 1–50 are the original levels, unchanged. Levels 51–1000 were redesigned once as packed boards (about 97% of cells used, mostly bent and multi-segment arrows, interlocking exit paths, no two touching arrows sharing a colour). Each level kept its original difficulty tier and, except level 139, its board size.
- The Daily Challenge for a date comes from `data/daily.v1.json` by date arithmetic only (days since 2026-10-10, modulo 392), so every player gets the same puzzle on the same date. Dates before 2026-10-10 keep their original puzzles. Daily difficulty follows the weekday.
- `data/*.js` files are generated copies of the JSON; edit neither by hand.

## Verifying (Node 18+, no installs)

    node tools/validate-levels.js   # re-checks every level with js/rules.js, duplicates, difficulty mix, variety
    node tools/test-daily.js        # Daily Challenge determinism over ~880 dates
    node tools/verify-levels-independent.js  # separate decoder + solver; writes tools/out/independent-verification.json
    node tools/e2e-browser.js       # optional: needs Playwright + Chromium; plays all 1000 levels in a real browser
    node tools/test-ads.js          # optional: same tools; ads layer + hint/Next wiring against a FAKE bridge (no SDK)
    node tools/test-ads-repeat.js   # repeat the full ads test 6 times to detect flaky behaviour
    node tools/test-back.js         # optional: back-button logic (AF.handleBack) in a real browser

`node tools/build-levels.js` rebuilds the campaign pack deterministically (same input, same files). Levels 1–50 come from `tools/fixtures/legacy-levels-1-50.json`, board sizes and tiers from `tools/fixtures/levels-pack-before-redesign.json`, and the Daily pool from `tools/fixtures/daily-pack-v1.json` (kept untouched). Only run it deliberately: it replaces the shipped level data. `tools/lib/densify.js` and `tools/lib/quality.js` hold the packing pass and design standards.

`tools/e2e-browser-python.py` is a Python Playwright version of the browser check (also clicks real arrow shapes on sampled levels). Reports are written to `tools/out/`.

## Saves

Progress is stored as before under `arrowflow.save.v1`. A player who had cleared all 50 original levels continues at level 51.
