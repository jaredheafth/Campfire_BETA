# Members list: options when widget and main are out of sync

When the **widget** has users (e.g. from `localStorage` restore) but the **Members list** does not (e.g. `activeUsers` is empty and `allChatters` doesn’t include them yet), these options can be used to fix or improve the behaviour.

---

## A. Persist `activeUsers` and restore on startup

- **What:** Save `activeUsers` (and optionally a minimal `allChatters`) to a file on join/leave and on shutdown; on startup, reload into `activeUsers` (and optionally `allChatters`).
- **Effect:** Main and widget stay in sync for “who is joined” across restarts. Restored users appear in the Members list as “Joined”.
- **Caveat:** Need a clear policy for reconnects (e.g. after Twitch disconnect) and for stale entries.

---

## B. Seed Members list from the widget’s in‑memory users

- **What:** When building the Members list, also merge in **widget users** (or the same source the widget uses). Mark them e.g. “Joined” or “Restored” if they’re not in `activeUsers`.
- **Effect:** Everyone the widget shows appears in the Members list; no need to “reopen” to see them.
- **Caveat:** Need a defined source for “widget users” (e.g. IPC from widget, or shared storage) and clear meaning of “Joined” vs “Restored” for actions.

---

## C. Fetch full chatters on Twitch connect

- **What:** On Twitch connect, request the **current chatters** (e.g. tmi `client.chatters()` or Helix) and merge into `allChatters`; optionally trigger `potentialMembersUpdate`.
- **Effect:** “Not joined” chatters (e.g. heafth before first message) can appear in the Members list as soon as the app connects.
- **Caveat:** Rate limits, channel size; does not by itself fix `activeUsers` after a restart.

---

## D. Indicate “widget-only” or “out of sync” users

- **What:**
  - In the Members list: if a user is in the **widget** but not in `activeUsers` or `allChatters`, show them with a special state, e.g. “In widget (sync pending)” or an icon.
  - Optionally, in the **widget**, a note like “Some members may not be in the list yet” when `widget.users` has more people than the last Members snapshot from main.
- **Effect:** Does not fix the gap, but makes it obvious when “in widget” and “in Members list” disagree.
- **Caveat:** Needs the Members list (or main) to know about widget users (e.g. `get-widget-display-users`).

---

## E. Combine: restore `activeUsers` + seed chatters on connect

- **What:** Do **A** (persist/restore `activeUsers`) and **C** (fetch chatters on connect and merge into `allChatters`).
- **Effect:**
  - Restored joined users appear as “Joined” in the list.
  - Chatters appear as “Not joined” once chatters are loaded.
- **Caveat:** More moving parts (persistence format, reconnect behaviour, chatters API).

---

## Summary

| Option | Prevents missing in list? | Indicates when it happens? |
|--------|---------------------------|----------------------------|
| **A** – Persist `activeUsers` | Yes, for **joined** users | No |
| **B** – Merge widget users into list | Yes, for everyone the widget shows | Optional (e.g. “Restored” label) |
| **C** – Chatters on connect | Yes, for **not joined** chatters | No |
| **D** – “Out of sync” / “In widget” labels | No | Yes |
| **E** – A + C | Strong reduction for both joined and chatters | No (unless D is also used) |

---

*Implementation note: Option D–style behaviour (widget‑persisted users in the Members list with a “restored”/“may have disconnected” icon) is implemented so that anyone persisted in the widget is represented in the Members list and marked accordingly.*
