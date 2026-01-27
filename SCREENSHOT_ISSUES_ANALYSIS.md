# Screenshot issues – analysis and fixes

## 1. Color not correct on widget but correct in dashboard

**Cause:** In **circle/circles** sprite mode, the widget forces usernames to white:

```js
// CIRCLE/CIRCLES mode: names stay WHITE with black outline (regardless of sprite color)
usernameLabel.style.color = '#ffffff';
```

RPG and pixel-morphs modes use `getTwitchColor()` (Twitch or hash). In circles mode the Twitch color is ignored, so the widget shows white while the dashboard (and Twitch chat) show the real color.

**Fix:** In circle/circles mode, use `getTwitchColor()` (or `user.twitchColor`) instead of `#ffffff`, same as other modes. Optional: when `tags.color` is missing on join, set `twitchColor` from `allChatters` in `handleJoinCommand` and `join-member`.

---

## 2. Member list loads in dashboard first; widget list needs exit/reopen to populate

**Cause:**  
- `updatePotentialMembersList()` sends `potentialMembersUpdate` only to **dashboard** and **members** windows, not to the **widget** window.  
- The widget’s in-window **Members** tab (`loadWidgetMembers`) runs only when opening that tab or after join/kick. It never subscribes to `potentialMembersUpdate`.

So when chatters arrive, the dashboard and members window update, but the widget’s Members panel does not. It only gets data on the next open/refresh (e.g. after “exit and reopen”).

**Fix:**
1. In `updatePotentialMembersList()`, also send `potentialMembersUpdate` to `widgetWindow`.
2. In the widget, subscribe to `onPotentialMembersUpdate` and call `loadWidgetMembers()` when the Members section is visible (or whenever the overlay is open and that tab is active).

---

## 3 & 4. Usernames drift left when resizing sprites; not centered

**Cause:**  
- `createUserElement` sets `element.style.width` and `element.style.height` (`.user-shape`) from `spriteSize`.  
- When `spriteSize` changes in settings, the handler updates only **`.shape`** (`shape.style.width/height`), **not** the **`.user-shape`** (element) size.

So after a resize, `.user-shape` can stay at the old size (e.g. 40px) while `.shape` becomes 170px and overflows. The username uses `left: 50%` and `transform: translateX(-50%)` relative to `.user-shape`. If `.user-shape` stays 40px, “50%” is 20px from the left, which lands on the left side of the visible 170px sprite.

**Fix:** In the `spriteSize`/`fireSize` branch of the settings-update logic, also set:

```js
element.style.width = `${spriteSize}px`;
element.style.height = `${spriteSize}px`;
```

(i.e. update the `.user-shape` container, not only `.shape`). The existing `usernameLabel.style.left = '50%'` and `transform: translateX(-50%)` are correct; they will center once the parent width is correct.

---

## 5 & 6. heafth joined as ADVENTURER when CIRCLES was selected

**Cause:** In `getUserSprite()`, **`user.selectedSprite` is applied before the `spriteMode` check**:

```js
if (user.selectedSprite) {
    const spriteData = ...;
    if (spriteData) {
        return { data: spriteData, colorize: false };  // ← returns immediately
    }
}
// ... later: if (spriteMode === 'circles') { ... }
```

If `user.selectedSprite` is set (e.g. from viewer-prefs for an RPG sprite), that sprite is returned for **all** modes, including `circles`. So a saved ADVENTURER/RPG choice overrides the current global “CIRCLES” mode.

**Fix:** Only use `user.selectedSprite` when it is valid **for the current mode**:

- In **circles** (and **circle**) mode: ignore `user.selectedSprite` and always use the circle/SVG (or shadow/morph logic for `circle`).  
- In **rpg-characters**: keep using `user.selectedSprite` if present, otherwise random from `rpgSprites`.  
- In **pixel-morphs** and **custom**: use `selectedSprite` only where it is defined for that mode.

Concretely: move the `if (user.selectedSprite) { ... return }` block to **after** the `spriteMode === 'circles'` (and `circle`) branches, or restrict that block to `spriteMode === 'rpg-characters'` (and any other mode where a custom sprite is intended).

---

## 7 & 8. Chat: every word on a new line unless the word is long

**Cause:**  
- `.chat-message` has `max-width: 150px` and `word-wrap: break-word`.  
- Its width is not set; it’s `position: absolute` with `left: 50%` and `transform: translateX(-50%)`.  
- The parent `.user-shape` can be as small as 40px if `spriteSize` was never applied to the container (same bug as #3–4). In some layouts, the bubble’s **content area** can be constrained by that narrow parent, so each short word (e.g. “aye”) gets a line, while longer words still break only when they exceed the allowed width.

**Fix:**
1. Ensure the parent sizing bug is fixed (see #3–4) so `.user-shape` is not stuck at 40px when sprites are 170px.  
2. For `.chat-message`, make layout robust:
   - `width: max-content` with `max-width: 150px` so the bubble grows with the line(s) of text, up to 150px.  
   - `min-width` (e.g. `min-width: 60px` or `80px`) so it doesn’t collapse to the width of a single character.  
   - `white-space: normal` and `word-break: normal` so we only break where expected (spaces and `word-wrap: break-word` for long words).  
   - Optionally `overflow-wrap: break-word` (or keep `word-wrap: break-word`) so long tokens still break.

---

## Summary of code changes

| Issue | File(s) | Change |
|-------|---------|--------|
| 1 – Color | `widget.html` | In circle/circles branch of `createUserElement` and `updateUserElement`, use `getTwitchColor(...)` (or `user.twitchColor`) instead of `#ffffff`. |
| 2 – Members sync | `main.js`, `widget.html` | Send `potentialMembersUpdate` to `widgetWindow`; in widget, listen for `onPotentialMembersUpdate` and call `loadWidgetMembers()` when Members is visible. |
| 3–4 – Username drift | `widget.html` | In the `spriteSize`/`fireSize` update block, set `element.style.width` and `element.style.height` to `spriteSize` (and keep `positionUserElement` and username centering as is). |
| 5–6 – CIRCLES vs ADVENTURER | `widget.html` | In `getUserSprite`, do **not** use `user.selectedSprite` when `spriteMode === 'circles'` or `'circle'`; only use it in rpg-characters (and any other mode where a custom sprite is intended). |
| 7–8 – Chat wrapping | `widget.html` | For `.chat-message`: `width: max-content`, `min-width: 60px` (or 80px), `max-width: 150px`, `white-space: normal`, `word-break: normal`, and keep `word-wrap: break-word` (or `overflow-wrap: break-word`). |

---

## Optional follow‑ups

- **Issue 1:** In `handleJoinCommand` and `join-member`, if `tags.color` is missing, set `user.twitchColor` from `allChatters` when that user exists there.  
- **Issue 2:** Ensure `getPotentialMembers` (and any cached chatters) is up to date when the widget first opens the Members tab.  
- **Issue 5–6:** If you want “CIRCLES” to fully override *all* saved RPG choices, clear or ignore `user.selectedSprite` in circles mode; if you want “use RPG only in RPG mode,” the more targeted change above is enough.
