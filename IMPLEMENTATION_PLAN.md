# 🔥 Campfire Widget - Implementation Plan

## Current State

✅ **What We Have:**
- Visual widget (`widget.html`) - displays campfire with users
- Streamer dashboard (`dashboard.html`) - settings configuration
- Viewer dashboard (`viewer-dashboard.html`) - viewer customization
- Mock/test data system
- LocalStorage-based communication
- Chat message display system (ready for integration)

❌ **What We Need:**
- Real Twitch chat integration
- Streamer authentication/login
- Persistent settings storage (database)
- Subscriber/badge detection
- Real-time chat monitoring

---

## MVP Options

### Option 1: Local Node.js Program (Easiest MVP) ⭐ RECOMMENDED

**How it works:**
- Runs on your computer as a background program
- Connects to Twitch chat via IRC
- Monitors chat messages in real-time
- Serves the widget HTML with embedded chat data
- No login required - just your Twitch channel name

**Pros:**
- ✅ Fastest to implement
- ✅ No hosting costs
- ✅ Works immediately
- ✅ Full control over your data
- ✅ No authentication complexity

**Cons:**
- ❌ Only works on your computer
- ❌ Must be running for widget to work
- ❌ No multi-streamer support
- ❌ Settings stored locally

**Tech Stack:**
- Node.js + Express (simple HTTP server)
- `tmi.js` (Twitch IRC client)
- File system for settings storage

**Time Estimate:** 2-4 hours

---

### Option 2: Hosted Web Service (Full MVP)

**How it works:**
- Web server hosts widget and dashboards
- Twitch OAuth for streamer login
- Database stores streamer settings
- Real-time chat monitoring via server
- WebSocket for live updates

**Pros:**
- ✅ Works from anywhere
- ✅ Multi-streamer support
- ✅ Persistent settings
- ✅ Can run 24/7

**Cons:**
- ❌ Requires hosting (Heroku, Railway, etc.)
- ❌ More complex setup
- ❌ Twitch OAuth integration needed
- ❌ Database setup required

**Tech Stack:**
- Node.js + Express
- PostgreSQL/MongoDB
- Twitch OAuth
- WebSockets (Socket.io)
- `tmi.js` for chat

**Time Estimate:** 1-2 days

---

## Implementation Steps

### Phase 1: Local MVP (Option 1) - START HERE

#### Step 1: Create Local Server Program

**File:** `server.js` (new file)

```javascript
const express = require('express');
const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve widget HTML
app.use(express.static(__dirname));

// Chat client setup
const client = new tmi.Client({
    options: { debug: false },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: 'YOUR_BOT_USERNAME', // Your Twitch username
        password: 'oauth:YOUR_OAUTH_TOKEN' // Get from https://twitchtokengenerator.com
    },
    channels: ['YOUR_CHANNEL_NAME'] // Your Twitch channel
});

// Store active users
let activeUsers = new Map();

client.connect();

// Listen for chat messages
client.on('message', (channel, tags, message, self) => {
    if (self) return; // Ignore bot's own messages
    
    const username = tags['display-name'] || tags.username;
    const userId = tags['user-id'];
    const isSubscriber = tags.subscriber === true;
    const isMod = tags.mod === true;
    const isVip = tags.badges?.vip === '1';
    
    // Check for join command
    if (message.toLowerCase().trim() === '!join') {
        // Add user to campfire
        activeUsers.set(userId, {
            username,
            userId,
            isSubscriber,
            isMod,
            isVip,
            joinedAt: Date.now()
        });
        
        // Send join event to widget
        broadcastToWidget('userJoin', { username, userId });
    }
    
    // Display chat message (if under 50 chars)
    if (message.length <= 50) {
        broadcastToWidget('chatMessage', {
            username,
            message,
            userId
        });
    }
});

// Broadcast to widget (via WebSocket or polling)
function broadcastToWidget(event, data) {
    // Store in file that widget polls, or use WebSocket
    const eventData = {
        type: event,
        data: data,
        timestamp: Date.now()
    };
    
    fs.writeFileSync(
        path.join(__dirname, 'chat-events.json'),
        JSON.stringify(eventData)
    );
}

// API endpoint for widget to poll
app.get('/api/events', (req, res) => {
    try {
        const events = fs.readFileSync(
            path.join(__dirname, 'chat-events.json'),
            'utf8'
        );
        res.json(JSON.parse(events));
    } catch (e) {
        res.json({ type: null });
    }
});

app.listen(PORT, () => {
    console.log(`🔥 Campfire Widget Server running on http://localhost:${PORT}`);
    console.log(`📺 Widget URL: http://localhost:${PORT}/widget.html`);
});
```

#### Step 2: Install Dependencies

```bash
npm init -y
npm install express tmi.js
```

#### Step 3: Get Twitch OAuth Token

1. Go to: https://twitchtokengenerator.com/
2. Select scopes: `chat:read` (for reading chat)
3. Copy the OAuth token
4. Update `server.js` with your token

#### Step 4: Update Widget to Poll Server

Add to `widget.html`:

```javascript
// Poll server for chat events
setInterval(async () => {
    try {
        const response = await fetch('http://localhost:3000/api/events');
        const event = await response.json();
        
        if (event.type === 'userJoin') {
            widget.addUser(event.data.username, { userId: event.data.userId });
        } else if (event.type === 'chatMessage') {
            widget.showChatMessage(event.data.username, event.data.message);
        }
    } catch (e) {
        // Server not running or no event
    }
}, 500); // Poll every 500ms
```

#### Step 5: Run Server

```bash
node server.js
```

#### Step 6: Use Widget in OBS

1. Open `http://localhost:3000/widget.html` in OBS Browser Source
2. Start your stream
3. Chat messages will appear automatically!

---

### Phase 2: Full Implementation (Option 2)

#### Step 1: Backend Setup

**Required:**
- Node.js server (Express)
- Database (PostgreSQL or MongoDB)
- Twitch OAuth integration
- WebSocket server (Socket.io)

#### Step 2: Database Schema

```sql
-- Streamers table
CREATE TABLE streamers (
    id SERIAL PRIMARY KEY,
    twitch_user_id VARCHAR(255) UNIQUE,
    twitch_username VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    settings JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Viewers table
CREATE TABLE viewers (
    id SERIAL PRIMARY KEY,
    twitch_user_id VARCHAR(255) UNIQUE,
    twitch_username VARCHAR(255),
    color VARCHAR(7),
    sprite_preference VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Streamer-Viewer relationships
CREATE TABLE campfire_participants (
    id SERIAL PRIMARY KEY,
    streamer_id INTEGER REFERENCES streamers(id),
    viewer_id INTEGER REFERENCES viewers(id),
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(streamer_id, viewer_id)
);
```

#### Step 3: Twitch OAuth Flow

1. **Streamer Login:**
   - Redirect to Twitch OAuth
   - Get access token
   - Store in database
   - Create/update streamer record

2. **Viewer Login:**
   - Optional OAuth for customization
   - Store preferences in database

#### Step 4: Real-time Chat Integration

- Server connects to Twitch IRC for each active streamer
- Broadcasts events via WebSocket to widget
- Handles subscriber detection, badges, etc.

#### Step 5: Settings Persistence

- Streamer settings saved to database
- Loaded when widget initializes
- Updated via dashboard API

---

## Quick Start: Local MVP

### Prerequisites

1. **Node.js installed** (v14+)
2. **Twitch account**
3. **OAuth token** (from twitchtokengenerator.com)

### Setup Steps

1. **Create `server.js`** (see code above)
2. **Install packages:**
   ```bash
   npm install express tmi.js
   ```
3. **Get OAuth token:**
   - Visit: https://twitchtokengenerator.com/
   - Select scope: `chat:read`
   - Copy token
4. **Update `server.js`:**
   - Replace `YOUR_BOT_USERNAME` with your Twitch username
   - Replace `YOUR_OAUTH_TOKEN` with your token
   - Replace `YOUR_CHANNEL_NAME` with your channel name
5. **Run server:**
   ```bash
   node server.js
   ```
6. **Test widget:**
   - Open: http://localhost:3000/widget.html
   - Type in your Twitch chat
   - Messages should appear!

---

## TODO List

### MVP (Local Program)
- [ ] Create `server.js` with Express + tmi.js
- [ ] Add chat event polling to widget
- [ ] Test with real Twitch chat
- [ ] Add subscriber detection
- [ ] Add command handling (!join)
- [ ] Create startup script
- [ ] Add error handling

### Full Implementation
- [ ] Set up database (PostgreSQL/MongoDB)
- [ ] Implement Twitch OAuth
- [ ] Create streamer login flow
- [ ] Create viewer login flow
- [ ] Build settings API
- [ ] Implement WebSocket server
- [ ] Add multi-streamer support
- [ ] Deploy to hosting service
- [ ] Add authentication middleware
- [ ] Implement rate limiting
- [ ] Add logging/monitoring

### Enhancements
- [ ] Add viewer color persistence
- [ ] Add sprite customization persistence
- [ ] Add analytics (viewer count, messages)
- [ ] Add moderation features
- [ ] Add custom commands
- [ ] Add viewer leaderboard
- [ ] Add sound effects
- [ ] Add animations for special events

---

## Technical Requirements

### For Local MVP:
- Node.js 14+
- `express` - HTTP server
- `tmi.js` - Twitch IRC client
- Twitch OAuth token

### For Full Implementation:
- Node.js 14+
- Express.js
- PostgreSQL or MongoDB
- Socket.io (WebSockets)
- Twitch OAuth integration
- Hosting service (Heroku, Railway, Render, etc.)
- Domain name (optional)

---

## Next Steps

1. **Start with Local MVP** (Option 1) - Get it working quickly
2. **Test thoroughly** - Make sure chat integration works
3. **Iterate** - Add features as needed
4. **Upgrade to Full** - When ready for multi-streamer support

Would you like me to create the `server.js` file for the local MVP now?
