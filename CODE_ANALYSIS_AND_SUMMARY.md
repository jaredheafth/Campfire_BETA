# Campfire Widget — Code Analysis & Summary

**Date:** 2025  
**Scope:** Full codebase (Electron desktop app, Express server, widget/dashboard/viewer-dashboard HTML)

---

## 1. What It’s Supposed to Do and How It Runs

### Purpose

**Campfire Widget** is an interactive streaming overlay that shows a campfire with viewers as sprites around it. It is built to run **stably** in two modes:

- **Desktop app (Electron):** Widget + Dashboard + Viewer Dashboard as native windows. Twitch chat and state live in the main process; UI talks over IPC. The widget window is the OBS “Application Capture” source.
- **Web/standalone (Express):** `node server.js` serves `widget.html`, `dashboard.html`, `viewer-dashboard.html`, and REST APIs. Can run locally or on Railway. Twitch is handled in the Node process; the widget polls `/api/events`.

### Core behavior

- **Twitch:** `tmi.js` connects to IRC, listens for e.g. `!join`, `!leave`, `!cw`, `!ccw`, `!sprite`, `!color`, and maps them to join/leave/move/sprite/color.
- **Widget:** Renders a center campfire (GIF/video), a perspective circle (0°–90°), and user sprites (RPG, circles, pixel-morphs) with usernames. Uses `localStorage` and/or IPC for settings and state.
- **Dashboard:** Streamer UI for settings (fire, circle, sprites, Twitch), live preview (iframe or sync), members (join/kick, test users), and “Widget Code” for browser-source use.
- **Viewer Dashboard:** Lets a viewer pick color/sprite and join/leave; in Electron this goes through IPC; in web mode through `/api/viewer/*`.
- **Sprites:** Stored as base64 in `localStorage` or served from `/sprites` (Express) or `campfire-sprites://` (Electron). Widget resolves `spriteInfo.data` as data URLs, blob URLs, or plain URLs.

### Expected stable operation

- **Electron:**  
  - Widget stays responsive (e.g. `backgroundThrottling: false`).  
  - Twitch reconnect, IPC, and state (activeUsers, events) stay in sync.  
  - No main-process crashes; renderer errors are isolated.  
- **Express:**  
  - Polling `/api/events` and `/api/users` works; CORS is correct for the deployment.  
  - Twitch client reconnects; `campfire-widget-settings.json` is read/written safely.  
- **OBS:**  
  - Widget (Electron window or browser source) is a stable, transparent or black-background source at the chosen resolution (e.g. 1920×1080).

---

## 2. Issues and Bad Practices

### 2.1 Critical / High

#### 1) **`executeInWidgetIframe` targets the wrong page and DOM**

- **Where:** `desktop-app/main.js` → `executeInWidgetIframe()`, used by `syncDashboardPreviewFromWidget()` and `getViewerColor()`.
- **What:** The function runs `widgetWindow.webContents.executeJavaScript(...)` and assumes `document.getElementById('fullWidgetPreview')` and `iframe.contentWindow` exist. The **widget** window loads `widget.html` directly; it has **no** `#fullWidgetPreview` iframe. That iframe exists only in **dashboard.html**.
- **Effect:**  
  - `syncDashboardPreviewFromWidget` always gets `null`/`[]` from the widget, so the dashboard Live Preview does not reflect the real widget state.  
  - `getViewerColor` falls back to `viewer-colors.json` or username hash instead of `allViewerColors` in the widget’s `localStorage`.
- **Fix:** Run the same logic in the **widget** window but use `window` (and `window.widget` / `window.campfireWidget`) directly, not an iframe. For example, replace the iframe lookup with:

  ```js
  (function() {
    const win = window;
    const widget = win.widget || win.campfireWidget;
    if (!widget) return null;
    // ... use widget.users, win.localStorage, etc.
  })();
  ```

  Execute this via `widgetWindow.webContents.executeJavaScript(...)`.

#### 2) **Preload exposes IPC channels that main never handles**

- **Where:** `desktop-app/preload.js` exposes:
  - `generateTwitchToken(accountType)`
  - `sendChatMessage(message)`
  - `disconnectTwitch()`
- **What:** `desktop-app/main.js` does **not** define `ipcMain.handle` for `generate-twitch-token`, `send-chat-message`, or `disconnect-twitch`. Handlers exist only in `main.js.old` and `desktop-app/server/main.js` (which the current Electron entrypoint does not use).
- **Effect:** Any call from the renderer (e.g. Dashboard Twitch tab) to these APIs will throw “No handler for …” and can break the UI or leave Twitch config half-done.
- **Fix:** Either implement the three handlers in `desktop-app/main.js` or remove these methods from `preload.js` and all call sites until they’re implemented.

#### 3) **`/api/shutdown` with no auth (Express)**

- **Where:** `server.js` and `desktop-app/server/server.js` → `POST /api/shutdown`.
- **What:** A single unauthenticated POST stops the process (`process.exit(0)`). The dashboard calls it with `fetch('http://localhost:3000/api/shutdown', { method: 'POST' })`.
- **Effect:** If the server is reachable beyond localhost (e.g. misconfiguration, Railway without proper access control), anyone can shut it down.
- **Fix:**  
  - Remove `/api/shutdown` in production or restrict to localhost and/or an internal token.  
  - Or guard with a secret header or query param and document it only for local/dev.

#### 4) **`innerHTML` with user-controlled data (XSS risk)**

- **Where:**  
  - `desktop-app/main.js` inline Members window: `container.innerHTML = allMembers.map(member => { ... \`onclick="toggleMember('${safeUserId}', '${safeUsername}')"\` ... })`  
  - `safeUserId` / `safeUsername` only escape `'` and `"` for JS strings, not HTML/attributes.
  - Similar patterns in `desktop-app/server/dashboard.html`, `members-window.html`, and `widget.html` when rendering `member.username`, `user.username`, or `sprite.name` into HTML or attributes.
- **Effect:** A username or sprite name containing `"`, `'`, `>`, `<`, `&` can break out of attributes or inject HTML/scripts (e.g. `"); somethingBad(); //` or `"><img src=x onerror=alert(1)>`), especially when combined with `innerHTML`.
- **Fix:**  
  - Use a proper HTML escape for text in attributes and HTML: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `'` → `&#39;`.  
  - Prefer `textContent` or `setAttribute` plus `addEventListener` instead of `onclick="...${userInput}..."` and `innerHTML` for user-defined strings.

### 2.2 Medium

#### 5) **Members window overwrites `members-window.html` on disk**

- **Where:** `desktop-app/main.js` → `createMembersWindow()`:

  ```js
  const membersPath = path.join(__dirname, 'server', 'members-window.html');
  fs.writeFileSync(membersPath, membersHTML);
  membersWindow.loadFile(membersPath);
  ```

- **What:** The full Members UI is built as a string and written over `server/members-window.html` every time the Members window is opened.
- **Effect:**  
  - Source file is changed at runtime; git will show local changes.  
  - Risk of clobbering intentional edits; odd for an app to mutate its own HTML in the install directory.
- **Fix:** Write to a temp file (e.g. `path.join(app.getPath('temp'), 'members-window.html')`) or use `loadURL` with a `data:` HTML URL so the on-disk `members-window.html` stays read-only and remains the canonical template.

#### 6) **Redundant `express.json()` on routes**

- **Where:** `server.js` and `desktop-app/server/server.js`: `app.use(express.json())` at the top, and also `express.json()` on individual routes, e.g. `app.post('/api/viewer/join', express.json(), (req, res) => { ... })`.
- **What:** Body parsing is already applied globally; route-level `express.json()` is unnecessary.
- **Effect:** No functional bug, but noisy and can confuse future changes to body parsing.
- **Fix:** Remove `express.json()` from the route definitions and keep only `app.use(express.json())`.

#### 7) **`campfire-sprites` protocol registered but unused**

- **Where:** `desktop-app/main.js` → `registerSpriteProtocol()` for `campfire-sprites://`.
- **What:** Widget and dashboard resolve sprites from `spriteInfo.data` (data URLs, blob URLs, or HTTP). No `campfire-sprites://` URLs are used in the current widget/dashboard logic.
- **Effect:** Dead code; the protocol adds complexity and a possible path for future bugs if used without proper checks. The path traversal guard (`normalizedPath.startsWith(normalizedSpritesDir)`) is correct for when it is used.
- **Fix:** Either wire the widget to use `campfire-sprites://` for file-based sprites and document it, or remove the protocol and related code.

#### 8) **CORS allows `*` in non-production**

- **Where:** `server.js` (and `desktop-app/server/server.js`):

  ```js
  } else {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  ```

- **What:** When `NODE_ENV !== 'production'`, any `Origin` is reflected, or `*` is used if `origin` is missing.
- **Effect:** Fine for local dev; if “production” is ever not set correctly, or the server is used from arbitrary web origins, this is overly permissive.
- **Fix:** Tighten for production (e.g. strict allowlist). For dev, consider still restricting to known dev origins if the server is reachable on a network.

### 2.3 Lower / Code quality

#### 9) **Duplicated server and HTML**

- **What:** `server.js` and `desktop-app/server/server.js` are largely the same. Root `widget.html` / `dashboard.html` / `viewer-dashboard.html` vs. `desktop-app/server/*.html` are parallel implementations.
- **Effect:** Bug fixes and API changes must be done in multiple places; risk of the desktop app’s server and HTML drifting from the “real” ones.
- **Fix:** Share one server implementation (e.g. require from a common module) and, where possible, one set of HTML assets (e.g. symlinks or build step) so Electron and `node server.js` use the same logic and UI.

#### 10) **Heavy `executeJavaScript` and string interpolation**

- **Where:** `getViewerColor` and `syncDashboardPreviewFromWidget` build JS strings that include `userId` and `username` and run them in the renderer.
- **What:** Even with trusted Twitch/account data, building executable JS via string concat is brittle and easy to misuse.
- **Fix:** Prefer structured IPC (e.g. `get-widget-state` → return a serializable object). If `executeJavaScript` is kept, pass arguments via a separate, structured channel and avoid interpolating user-derived strings into the JS body.

#### 11) **`openSettings` via `executeJavaScript` in Settings window**

- **Where:** `createSettingsWindow()`:

  ```js
  settingsWindow.webContents.executeJavaScript(`
    if (typeof openSettings === 'function') { openSettings(); }
  `);
  ```

- **What:** Depends on `openSettings` being defined in `dashboard.html` and on load/ timing. It’s a small, implicit contract.
- **Effect:** If `dashboard.html` is refactored or loads asynchronously, this can no-op or throw. Low risk today but fragile.
- **Fix:** Prefer an explicit IPC or `?openSettings=1` (or similar) that the dashboard handles on load, or a dedicated `settings.html` that doesn’t depend on `openSettings` in the dashboard.

#### 12) **Empty `setInterval` in server.js (Twitch viewer list)**

- **Where:** `server.js` (and likely `desktop-app/server/server.js`):

  ```js
  setInterval(async () => {
    try {
      // Get current chatters from Twitch API
      // Note: This requires additional API setup - for now we rely on part events
    } catch (e) {
      console.error('Error monitoring viewer list:', e);
    }
  }, 30000);
  ```

- **What:** A 30s timer runs with no logic and only a comment.
- **Effect:** Useless CPU wake-ups and noise in logs if `catch` ever runs.
- **Fix:** Implement the Twitch viewer-list logic or remove the `setInterval` until it’s implemented.

---

## 3. Positive Practices

- **Electron:** `nodeIntegration: false` and `contextIsolation: true` with a defined `preload` and `contextBridge` for `electronAPI`; no direct `require('electron')` or `require('fs')` in renderers.
- **campfire-sprites:** Path is normalized and checked with `startsWith(normalizedSpritesDir)` before serving files, which mitigates path traversal.
- **Blob URLs:** Widget revokes blob URLs in `removeUserElement` and in `shutdown()` to avoid leaks.
- **Twitch:** `tmi.js` is used with `reconnect: true`; join/part and command parsing are structured.
- **Events:** Bounded event queue (e.g. last 100) and `since`-based polling for `/api/events` to avoid unbounded growth.
- **No `eval()`:** No use of `eval` or `new Function` on user input in the inspected code.

---

## 4. Summary Table

| Area               | Status / risk                              | Notes                                                         |
|--------------------|---------------------------------------------|---------------------------------------------------------------|
| Electron security  | Good                                        | Preload + context isolation; no node in renderer              |
| IPC preload vs main| Broken for 3 APIs                           | `generateTwitchToken`, `sendChatMessage`, `disconnectTwitch`  |
| `executeInWidgetIframe` | Wrong window / DOM                    | Widget has no iframe; sync and `getViewerColor` impaired      |
| `/api/shutdown`    | High                                        | Unauthenticated; can kill server                              |
| `innerHTML` / XSS  | Medium–high                                 | Username/sprite names need HTML/attribute escaping            |
| Members HTML       | Medium                                      | Overwrites `members-window.html` on disk                      |
| Express / CORS     | Low–medium                                  | Redundant `express.json`; permissive CORS when not production |
| Dead / unused      | Low                                         | `campfire-sprites`; empty viewer `setInterval`                |
| Duplication        | Maintainability                             | Two servers; two sets of HTML                                 |

---

## 5. Recommended Fix Order

1. **Preload/main mismatch:** Implement or remove `generate-twitch-token`, `send-chat-message`, `disconnect-twitch` and align preload.
2. **`executeInWidgetIframe`:** Switch to `window` / `window.widget` in the widget window and fix `syncDashboardPreviewFromWidget` and `getViewerColor`.
3. **`/api/shutdown`:** Restrict to localhost and/or add a simple secret; or remove in production.
4. **XSS:** Introduce an `escapeHtml` (and attribute escape) helper and use it for any `username`/`sprite.name`/etc. before `innerHTML` or attribute assignment.
5. **Members window:** Stop overwriting `server/members-window.html`; use a temp file or `data:` URL.
6. **Cleanup:** Drop redundant `express.json()` on routes; remove or implement the viewer `setInterval`; decide on `campfire-sprites` and remove or integrate it.
7. **Long-term:** Deduplicate server and HTML between root and `desktop-app/server` to keep behavior and security fixes in one place.

---

## 6. How to Run It Stably

- **Electron (primary):**  
  - `cd desktop-app && npm install && npm start`.  
  - Configure Twitch in the Dashboard (Twitch tab).  
  - Capture the “Campfire Widget” window in OBS via Application/window capture.  
  - Ensure `campfire-widget-settings.json` and `twitch-config.json` in `userData` are writable.

- **Express (web / Railway):**  
  - `npm install && node server.js` (or set `PORT` and run on Railway).  
  - Set `TWITCH_BOT_USERNAME`, `TWITCH_OAUTH_TOKEN`, `TWITCH_CHANNEL_NAME` (or the server runs in file-serving-only mode).  
  - Add `http://localhost:3000/widget.html` (or the deployed URL) as a Browser Source in OBS.  
  - Do **not** expose `POST /api/shutdown` to the public internet without restricting or removing it.

- **Sprites:**  
  - In Electron, sprites are under `desktop-app/server/sprites` (or an unpacked path when built).  
  - In Express, they are under `server/sprites` or the configured `spritesDir`.  
  - Ensure `defaults/rpg-characters`, `defaults/circles`, `defaults/pixel-morphs` (and `defaults/shadows` if used) exist and are readable.

---

*End of analysis.*
