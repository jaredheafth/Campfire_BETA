# Twitch OAuth and API restrictions

## Will “just login” work?

**For end users:** Almost. They must:

1. **Log in and authorize** when the OAuth window opens (Grant access for `chat:read` and `chat:edit`).
2. **Enter Username and Channel** in the dashboard (the OAuth flow does not return these; only the access token is filled).
3. **Click Save Configuration** so the app can connect.

No Twitch Developer account or app is required from the **viewer/streamer** for this to work, **as long as the app is correctly configured** (see below).

---

## What the app / publisher must have

For **Generate Token** (in‑app OAuth) to work, **one** of these must be true:

### 1. App ships with a working Twitch application (recommended)

The **publisher** (e.g. The Offline Club) creates a Twitch application at [dev.twitch.tv](https://dev.twitch.tv/consoles):

1. **Create Application** → choose “Broadcaster” or “Chat Bot” (or similar).
2. **OAuth Redirect URLs** → add **exactly**:
   - `http://localhost:3010/twitch-callback`
   - (Optional) `http://localhost:3011/twitch-callback` if you expect port 3010 to sometimes be in use.
3. **Client ID** → copy it.
4. **Ship the app** with that Client ID:
   - Set `TWITCH_CLIENT_ID` in the environment when building/running, **or**
   - In code, replace the fallback `'kimne78kx3ncx6brgo4mv6wki5h1ko'` with your Client ID (or keep using an env var).

Then, for users: **Generate Token → log in and authorize → enter Username and Channel → Save** is enough. No dev account needed for them.

### 2. User provides their own Twitch application

If the app does **not** ship with a valid Client ID and redirect:

- **Generate Token will fail** with a redirect or client error.
- The user can still get a token from [twitchtokengenerator.com](https://twitchtokengenerator.com) (or similar), paste it into **Access Token**, and use the app. In that case they never use in‑app OAuth.

If you want to support “bring your own app”:

1. User creates an app at [dev.twitch.tv](https://dev.twitch.tv/consoles).
2. Adds `http://localhost:3010/twitch-callback` (and optionally `http://localhost:3011/twitch-callback`) to **OAuth Redirect URLs**.
3. Sets `TWITCH_CLIENT_ID` to their app’s Client ID when running the desktop app (e.g. via env or a settings file, if you add that).

---

## Scopes: are there extra restrictions?

- We request the following scopes for the **main account** (streamer):
  - **`chat:read`** – Read chat messages
  - **`chat:edit`** – Send chat messages
  - **`channel:read:subscriptions`** – Read subscriber information
  - **`moderator:read:chatters`** – Read list of chatters in channel
  - **`user:read:chat`** – Read user chat colors (for displaying username colors above sprites)

- For the **bot account** (if separate):
  - **`chat:read`** – Read chat messages
  - **`chat:edit`** – Send chat messages

- These are **not** "restricted" scopes; they do **not** require Twitch to manually approve your app.
- The user only needs to **accept the consent screen** when authorizing. No extra steps or forms.

Enough for:

- Reading chat (e.g. `!join`, `!leave`, `!cw`, `!ccw`).
- Sending messages (e.g. `send-chat-message`), as long as the channel allows it (moderation, ban, etc. are separate).
- Fetching user chat colors proactively for authenticated accounts (streamer/bot).

---

## Rate limits and IRC

- Twitch IRC (used by tmi.js) has **rate limits**. For a single bot in one channel and normal usage (commands, occasional sends), you typically stay under those limits.
- No special “verified” or “approved” status is required for basic chat in one channel. Verified Bot is only for very high‑traffic bots.

---

## OAuth callback port (technical)

- The in‑app OAuth server uses a **fixed port** by default: **3010**.
- Twitch requires the **redirect_uri** to match **exactly** a URL registered in the Twitch app. So the app’s redirect must be `http://localhost:3010/twitch-callback` (and optionally the same for 3011 if you use it).
- If 3010 is already in use on the machine, the OAuth server fails. The user can:
  - Set `OAUTH_CALLBACK_PORT=3011` (or another free port) when starting the app, and
  - Add `http://localhost:3011/twitch-callback` to the **same** Twitch app’s OAuth Redirect URLs.

---

## Summary

| Who           | Extra restrictions beyond "login + authorize"? |
|---------------|-------------------------------------------------|
| **End user**  | **No** – as long as they accept the OAuth screen and fill Username + Channel. No dev account. |
| **App / publisher** | **Yes** – a Twitch app with `http://localhost:3010/twitch-callback` in Redirect URLs and a Client ID used by the app (or user-supplied via `TWITCH_CLIENT_ID`). |
| **Scopes**    | **No** – all requested scopes (`chat:read`, `chat:edit`, `channel:read:subscriptions`, `moderator:read:chatters`, `user:read:chat`) are standard; no special approval. |
| **Rate limits** | **Yes** – normal IRC limits apply; acceptable for typical single‑channel usage. |

So: for **retrieving the API (OAuth token) and using it for the app’s functions**, the main requirement is that the **app is set up with a valid Twitch app and redirect**. Once that’s in place, the user only needs to log in, authorize, and enter Username + Channel.
