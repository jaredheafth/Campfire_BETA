# Discord Channel Integration - Feasibility Analysis

## Executive Summary

**FEASIBLE WITH SIGNIFICANT ARCHITECTURAL CHANGES**

Discord integration is technically possible but fundamentally different from Twitch IRC. The main challenge is that Discord requires a **bot account** to be invited to the server, unlike Twitch IRC which uses OAuth authentication for any user.

---

## Current Architecture Analysis

### Twitch Integration Model
```
┌─────────────────────────────────────────────────────────────┐
│ TWITCH INTEGRATION (Current)                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User authenticates via OAuth (chat:read, chat:edit)        │
│        │                                                     │
│        ▼                                                     │
│  tmi.js connects to irc.chat.twitch.tv                      │
│        │                                                     │
│        ▼                                                     │
│  Real-time IRC message stream                               │
│        │                                                     │
│        ▼                                                     │
│  Handle commands: !join, !leave, !cw, !ccw, etc.            │
│        │                                                     │
│        ▼                                                     │
│  User state management (ACTIVE, SLEEPY, AFK, LURK)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Twitch IRC Capabilities Used
1. **Real-time message streaming** via IRC protocol
2. **User identification** (username, userId from tags)
3. **User roles** (mod, VIP, subscriber, broadcaster)
4. **Chat colors** from user settings
5. **Command handling** (!commands)
6. **Message sending** (bot responses)

---

## Discord API Comparison

### Discord Bot vs. OAuth Approach

| Aspect | Twitch IRC | Discord |
|--------|-----------|---------|
| **Connection Type** | IRC with OAuth | Gateway WebSocket + REST |
| **Authentication** | User OAuth token | Bot Token |
| **Must be in server** | No (just know channel) | **Yes - Bot must be invited** |
| **Message reading** | Any chat message | Requires Message Content intent |
| **Message sending** | As authenticated user | As bot |
| **Rate limits** | IRC-based | Per-route REST limits |
| **Verification** | No special approval | May require verification for some intents |

### Discord Gateway Events (Relevant)
- `MESSAGE_CREATE` - New messages
- `MESSAGE_DELETE` - Deleted messages
- `MESSAGE_UPDATE` - Edited messages
- `THREAD_CREATE` / `THREAD_UPDATE` / `THREAD_DELETE`
- `GUILD_MEMBER_ADD` / `REMOVE`
- `READY` - Connection established

---

## Feasibility: Two Integration Paths

### Path A: Discord Bot in Creator's Server (Recommended)

The streamer invites the Campfire bot to their Discord server, selects a channel/thread, and the app mirrors that chat.

```
┌─────────────────────────────────────────────────────────────┐
│ DISCORD INTEGRATION - PATH A (Bot in Server)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Streamer invites Campfire Bot to their Discord server   │
│        │                                                     │
│        ▼                                                     │
│  2. Streamer authorizes via OAuth (Discord OAuth2)           │
│        │                                                     │
│        ▼                                                     │
│  3. Bot connects to Gateway, joins selected channel/thread  │
│        │                                                     │
│        ▼                                                     │
│  4. Listen for MESSAGE_CREATE events                         │
│        │                                                     │
│        ▼                                                     │
│  5. Map Discord users to Campfire users                     │
│        │                                                     │
│        ▼                                                     │
│  6. Handle commands (!join, !leave, etc.)                   │
│        │                                                     │
│        ▼                                                     │
│  7. User state management (ACTIVE, SLEEPY, AFK)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Requirements for Path A:
- **Discord Developer Application** with Bot token
- **OAuth2 authorization** (identify, guilds.join scopes)
- **Message Content privileged intent** (requires approval for 100+ servers)
- **Bot invited to streamer's server** with appropriate permissions

### Path B: User Connects Their Discord Account (Like Twitch)

User authenticates with Discord OAuth, and the app reads messages from channels they're in.

```
┌─────────────────────────────────────────────────────────────┐
│ DISCORD INTEGRATION - PATH B (User OAuth)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚠️ NOT RECOMMENDED - Significant Limitations               │
│                                                              │
│  User authenticates via Discord OAuth                        │
│        │                                                     │
│        ▼                                                     │
│  Can only read messages in DMs or channels they have access │
│        │                                                     │
│        ▼                                                     │
│  Cannot read messages in other servers' channels             │
│        │                                                     │
│        ▼                                                     │
│  Cannot act as a bot (send messages, manage threads)         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Path B Major Limitations:
- Cannot read messages in servers where the user isn't a member
- Cannot send messages as a bot
- Cannot manage thread lifecycle
- Limited to DMs or channels the user is already in

---

## Key Technical Challenges

### 1. Bot Invitation Requirement

**Problem**: Unlike Twitch where anyone can connect to any channel, Discord bots must be explicitly invited to servers.

**Solution**:
- Create a Discord OAuth2 flow for "Add Bot to Server"
- Provide invite link in the app's dashboard
- User selects their server and grants permissions

### 2. Thread Lifecycle Management

**Problem**: Discord threads have different behavior than Twitch chat:
- Threads can auto-archive after inactivity
- Threads can be deleted by moderators
- Threads have member limits

**Solution**:
- Monitor `THREAD_CREATE`, `THREAD_UPDATE`, `THREAD_DELETE` events
- Show thread status in dashboard (active, archived, deleted)
- Auto-handle thread re-creation if needed

### 3. User Identity Mapping

**Problem**: Discord user IDs are different from Twitch IDs.

**Solution**:
- Create a separate `discordUserId` field in User model
- Store both Twitch and Discord IDs for users
- Allow users to link both accounts

```javascript
// Example User model extension
class User {
    constructor(userId, data = {}) {
        this.twitchUserId = data.twitchUserId || null;
        this.discordUserId = data.discordUserId || null;
        this.username = data.username || '';
        // ...
    }
}
```

### 4. Message Content Intent

**Problem**: Reading message content requires the `MESSAGE_CONTENT` privileged intent, which requires Discord approval if your bot is in 100+ servers.

**Solution**:
- For personal use bots, enable intent in developer portal
- For distribution, may need to apply for intent approval
- Fallback: Only read message metadata (author, timestamp) if intent not available

### 5. Rate Limits

**Problem**: Discord has stricter rate limits than Twitch IRC.

**Solution**:
- Implement message batching
- Use gateway for real-time instead of REST polling
- Handle 429 responses with exponential backoff

---

## Implementation Complexity Assessment

### Low Complexity (Easy)
- Basic message receiving (MESSAGE_CREATE events)
- User join/leave detection
- Simple command handling

### Medium Complexity (Moderate Effort)
- Thread monitoring (create, archive, delete)
- User state management (ACTIVE, SLEEPY, AFK)
- OAuth flow for bot invitation
- Rate limit handling

### High Complexity (Significant Effort)
- Full command parity with Twitch (!join, !leave, !cw, !ccw, etc.)
- Emote/emoji handling (Discord has different format)
- Role mapping (Discord roles vs Twitch mod/VIP/sub)
- Cross-platform user linking
- Message editing/deletion sync

---

## Recommended Approach

### Phase 1: Basic Discord Bot Integration

1. **Create Discord Bot Application**
   - Register at discord.com/developers/applications
   - Enable Message Content intent
   - Copy Bot Token

2. **Add OAuth2 for Bot Installation**
   - Add OAuth2 redirect URL
   - Create "Add to Server" flow

3. **Implement Gateway Connection**
   - Use `discord.js` library or raw WebSocket
   - Handle `READY`, `MESSAGE_CREATE` events

4. **Basic Message Display**
   - Show Discord messages in Campfire widget
   - Map Discord users to sprites

### Phase 2: Command Support

1. **Implement !join Command**
   - User types !join in Discord thread
   - Sprite appears in campfire

2. **Implement !leave Command**
   - User types !leave
   - Sprite leaves campfire

3. **State Management**
   - Track user activity (messages = active)
   - Auto-AFK after inactivity

### Phase 3: Full Feature Parity

1. **All Movement Commands**
   - !cw, !ccw, !still, !roam, !wander, !spin, !dance

2. **Thread Lifecycle**
   - Monitor thread status
   - Handle archived/deleted threads

3. **Role Mapping**
   - Map Discord roles to streamer/mod/VIP equivalent
   - Show role indicators

---

## Required Code Changes

### 1. New Discord Integration Module

```
desktop-app/src/main/integration/
├── DiscordClient.js      # Gateway connection, event handling
├── DiscordOAuth.js       # OAuth flow for bot installation
└── DiscordMessageParser.js # Parse Discord messages to Campfire format
```

### 2. State Management Updates

```
desktop-app/src/main/state/
├── User.js               # Add discordUserId field
├── UserManager.js        # Handle Discord user tracking
└── UserPreferencesStore.js # Store Discord preferences
```

### 3. Dashboard Updates

```
desktop-app/server/
├── dashboard.html        # Add Discord connection UI
├── settings-window.html  # Discord settings tab
└── styles/
    └── dashboard-forms.css # Discord connection styles
```

### 4. Widget Updates

```
desktop-app/server/
└── widget.html           # Handle Discord user display
    # Note: Minimal changes - already handles generic users
```

---

## Estimated Effort

| Phase | Components | Effort |
|-------|-----------|--------|
| Phase 1 | Bot setup, OAuth, Gateway connection, basic display | 2-3 weeks |
| Phase 2 | Commands, state management | 1-2 weeks |
| Phase 3 | Full parity, thread lifecycle | 2-3 weeks |

---

## Verification Requirements

### Discord Bot Verification

If you want to distribute the bot publicly:

1. **Standard Bot** (no verification needed):
   - Up to 100 servers
   - Message Content intent available
   - Can add to servers via invite link

2. **Verified Bot** (requires Discord approval):
   - 100+ servers requires verification
   - Submit app for review
   - Provide privacy policy, terms of service

For personal/small-scale use, standard bot is sufficient.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Message Content intent approval | Medium | Start with small user base, apply for verification later |
| Thread lifecycle complexity | Medium | Implement robust thread monitoring, graceful degradation |
| Rate limit issues | Low | Implement proper batching and backoff |
| Bot invitation friction | High | Create simple "Add Bot" flow with clear instructions |
| Cross-platform user confusion | Low | Clear UI showing which platform user is from |

---

## Conclusion

**Discord integration is FEASIBLE** with the following key considerations:

1. **Use Path A (Bot in Server)** - Path B is not viable for this use case
2. **Message Content intent** is required and may need verification for large scale
3. **Bot invitation** requires OAuth flow and user action
4. **Thread lifecycle** needs proper handling
5. **Estimated effort: 5-8 weeks** for full feature parity

The core Campfire functionality (sprites, commands, state management) can work with Discord, but the user experience will differ from Twitch due to the bot-based architecture.

---

## Next Steps

1. Create Discord Developer Application
2. Implement OAuth2 "Add Bot to Server" flow
3. Build Discord Gateway client using discord.js or raw WebSocket
4. Create Discord-to-Campfire message parser
5. Implement basic !join/!leave commands
6. Add Discord settings to dashboard
7. Test with small user group
