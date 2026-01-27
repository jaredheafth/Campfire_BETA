# AI Developer Handoff — Campfire Widget (SLOBS/OBS)

**Goal:** Enable another developer (human or AI) to clone this repo and continue work immediately, with minimal re-discovery.

**Repo type:** Node + Electron (desktop app) + standalone Express server.

---

## Current checkpoint (what just changed)

### Desktop app version
- `desktop-app/package.json` is now **`0.0.20`**.

### Latest feature/fix included in working tree
- **Front “FLICKER” glow layer controls** added to the desktop dashboard:
  - **Flicker Opacity**
  - **Flicker Size / Spread**
  - Implemented in `desktop-app/server/dashboard.html` and consumed by `desktop-app/server/widget.html`.
- **Sprite facing/orientation fix while moving**:
  - Movement animations no longer override the sprite’s **flip + perspective scaling**.
  - Implemented by switching some animations to use CSS transform longhands (`translate`, `scale`) rather than overwriting `transform` in `desktop-app/server/widget.html`.

### Release notes for this checkpoint
- `RELEASE_NOTES_v0.0.20.md`

---

## Repo map (what lives where)

### Standalone / web mode (Express)
- **Server:** `server.js`
- **Widget:** `widget.html`
- **Dashboards:** `dashboard.html` and `viewer-dashboard.html` (plus other root HTML files)
- **Sprites:** `sprites/` (defaults + custom)

Run this mode when you want browser-source style usage, local dev, or hosting (e.g. Railway).

### Desktop app (Electron)
- **Electron entrypoint:** `desktop-app/main.js`
- **Preload bridge:** `desktop-app/preload.js`
- **HTML assets served inside the app:** `desktop-app/server/`
  - `desktop-app/server/widget.html`
  - `desktop-app/server/dashboard.html`
  - `desktop-app/server/viewer-dashboard.html`
- **App-embedded server (Express-like):** `desktop-app/server/server.js`

This mode is intended to be the “product”: open the desktop app and use the widget window as the OBS source (often via Application Capture).

---

## How to run (local dev)

### Standalone server (root)

Install deps:

```bash
npm install
```

Start:

```bash
node server.js
```

Then open:
- `http://localhost:3000/widget.html`
- `http://localhost:3000/dashboard.html` (if present)
- `http://localhost:3000/viewer-dashboard.html`

Twitch credentials are read from env vars (preferred) or fall back to placeholders in `server.js`:
- `TWITCH_BOT_USERNAME`
- `TWITCH_OAUTH_TOKEN` (must include the `oauth:` prefix)
- `TWITCH_CHANNEL_NAME`

### Desktop app (Electron)

```bash
cd desktop-app
npm install
npm start
```

Build:

```bash
cd desktop-app
npm run build:win
npm run build:mac
```

See also:
- `desktop-app/BUILD_QUICK_START.md`
- `desktop-app/BUILD_INSTRUCTIONS.md`

---

## Key “source of truth” behaviors

### Twitch chat integration
- Uses `tmi.js` in both modes.
- Common commands and behavior are documented in `QUICK_START.md` and related docs.

### Settings & state persistence
- The widget uses **localStorage** heavily.
- The server side also persists settings (JSON files).
- In Electron, multiple windows interact via **IPC**.

This multi-source-of-truth approach works, but it’s also the source of several sync bugs (see “Known risks”).

---

## Known risks / backlog (high-signal)

These are pulled from `CODE_ANALYSIS_AND_SUMMARY.md` (and related docs). Treat them as the current “engineering reality” list.

### High priority (fix soon)
- **Dashboard preview sync targets wrong DOM/window**:
  - `executeInWidgetIframe` assumes an iframe that doesn’t exist in the widget window.
  - This breaks some “sync preview from widget” logic.
- **Preload exposes IPC channels that main doesn’t handle**:
  - `generate-twitch-token`, `send-chat-message`, `disconnect-twitch` are exposed but not handled in `desktop-app/main.js` (per analysis doc).
- **`/api/shutdown` has no auth** (both in root `server.js` and `desktop-app/server/server.js`):
  - Risky if the server is reachable beyond localhost.
- **XSS risk via `innerHTML` with user-controlled names**:
  - Usernames and sprite names need robust HTML/attribute escaping (or move to `textContent` + DOM APIs).

### Medium priority (stability/maintainability)
- **Members window overwrites HTML on disk** (Electron): fragile and can create confusing git diffs.
- **Duplicated implementations**:
  - `server.js` and `desktop-app/server/server.js` drift.
  - Root HTML and `desktop-app/server/*.html` drift.

### Still-being-tested items
- “Users disappearing on settings/tab changes” investigation notes are in:
  - `ISSUES_FIXED.md`
  - `FIXES_APPLIED.md`

---

## Where to read next (order matters)

If you are an AI dev joining cold, read these in order:
- `RELEASE_NOTES_v0.0.20.md`
- `QUICK_START.md`
- `CODE_ANALYSIS_AND_SUMMARY.md` (high-signal, actionable issues)
- `ISSUES_FIXED.md` + `FIXES_APPLIED.md` (sprite/settings stability work)
- Desktop build docs: `desktop-app/BUILD_QUICK_START.md`

---

## Ready-to-paste “AI Dev Prompt”

Copy/paste the following into your AI dev tool of choice.

```text
You are an AI software engineer joining an existing repo mid-stream.

Repository: Campfire Widget (standalone Express mode + Electron desktop app mode).

Your goals:
1) Get the project running locally (both modes if possible).
2) Validate the latest checkpoint (v0.0.20): dashboard has Flicker Opacity/Spread controls and sprites no longer snap orientation while moving.
3) Identify and fix the highest-impact engineering issues listed in CODE_ANALYSIS_AND_SUMMARY.md, in this order:
   - Fix executeInWidgetIframe logic (dashboard preview sync should target the correct window/DOM).
   - Fix preload/main IPC mismatches (generate-twitch-token, send-chat-message, disconnect-twitch).
   - Secure /api/shutdown (restrict to localhost and/or require a token header).
   - Remove XSS footguns by replacing innerHTML rendering of usernames/sprite names with safe DOM APIs (or robust escaping).

Constraints:
- Do not commit any real tokens/secrets.
- Keep changes minimal and targeted; avoid broad refactors unless required for stability.
- Prefer changes that reduce duplication between root and desktop-app/server versions, but do not attempt a full rewrite.

Key files:
- desktop-app/main.js
- desktop-app/preload.js
- desktop-app/server/widget.html
- desktop-app/server/dashboard.html
- desktop-app/server/server.js
- server.js

Docs to rely on:
- AI_DEV_HANDOFF.md
- RELEASE_NOTES_v0.0.20.md
- CODE_ANALYSIS_AND_SUMMARY.md
- FIXES_APPLIED.md
- ISSUES_FIXED.md

Deliverables:
- A short status summary of what works locally and what’s broken.
- A PR-ready set of commits that fixes the high-priority items above, with a clear test plan.
```

