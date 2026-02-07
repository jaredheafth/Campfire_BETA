# Campfire Widget - Hosted Platform Implementation Plan

## Executive Summary

Based on analysis of the current codebase, transforming Campfire Widget into a fully hosted, multi-user platform is a **significant but achievable** undertaking. The current architecture provides a solid foundation (Express server, Twitch OAuth integration, real-time event system), but lacks the database layer, authentication system, and multi-user infrastructure required for a hosted platform.

**Estimated Complexity**: 8-12 months of iterative development for a stable v1.0
**Recommended Approach**: Build incrementally on localhost first, deploy to Railway when core features are functional

---

## Current State Assessment

### What's Already Working ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Express server | ✅ Ready | Railway-ready, serves static files |
| Twitch OAuth flow | ✅ Working | `viewer-dashboard.html` has OAuth implementation |
| Real-time events | ⚠️ Polling | Uses `/api/events` polling (needs WebSockets) |
| Buddy list UI | ✅ Exists | `buddy-list.html` - 2385 lines, dual-mode support |
| Viewer dashboard | ✅ Exists | `viewer-dashboard.html` - 1398 lines |
| Widget display | ✅ Exists | `widget.html` for OBS overlay |
| Creator dashboard | ⚠️ Partial | `dashboard.html` exists but desktop-focused |
| Settings persistence | ⚠️ Local | Uses localStorage/files, no database |

### What's Missing ❌

| Component | Priority | Description |
|-----------|----------|-------------|
| Database | Critical | No persistent user/campfire data storage |
| User Authentication | Critical | Sessions, JWT tokens, secure access |
| Creator Portal | High | Web-based dashboard for hosted campfires |
| Tents Profile | High | Personal profile pages for viewers |
| Buddy System | High | Global friend list, not per-campfire |
| WebSocket Server | High | Real-time updates (replace polling) |
| Multi-Campfire | Medium | Support multiple streamers/platforms |
| Desktop Integration | Medium | Desktop app ↔ Hosted backend sync |
| Chat Features | Medium | Full chat UI, not just command parsing |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HOSTED CAMPFIRE PLATFORM                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐     ┌─────────────────────────────────────┐    │
│  │   USER TYPES    │     │         CORE SERVICES               │    │
│  ├─────────────────┤     ├─────────────────────────────────────┤    │
│  │ • Creator       │     │ • PostgreSQL Database              │    │
│  │   - Dashboard   │     │ • Redis (sessions, caching)         │    │
│  │   - Campfire   │     │ • WebSocket Server (Socket.io)       │    │
│  │   - Settings   │     │ • Express API                        │    │
│  │                │     │ • Twitch IRC Bridge                  │    │
│  │ • Viewer       │     └─────────────────────────────────────┘    │
│  │   - Tents      │                      │                          │
│  │   - Buddy List │                      ▼                          │
│  │   - Chat      │     ┌─────────────────────────────────────┐    │
│  │   - Campfire │     │          FRONTEND APPS               │    │
│  └─────────────────┘     ├─────────────────────────────────────┤    │
│                          │ • website/ (React/Next.js)          │    │
│                          │   - Landing page                    │    │
│                          │   - Creator dashboard               │    │
│                          │   - Viewer Tents profile            │    │
│                          │   - Buddy list                      │    │
│                          │   - Chat interface                  │    │
│                          │                                      │    │
│                          │ • widget.html (shared)              │    │
│                          │   - OBS overlay widget              │    │
│                          │                                      │    │
│                          │ • desktop-app/ (Electron)          │    │
│                          │   - Full desktop application        │    │
│                          │   - Connects to hosted backend      │    │
│                          └─────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation (Database + Auth)
**Duration**: 4-6 weeks

#### 1.1 Database Setup
```
Files to create:
- database/schema.sql (PostgreSQL)
- database/migrations/
- database/seed.js
```

**Database Schema** (core tables):
```sql
-- Users table (unified for creators and viewers)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twitch_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    bio TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Campfires table
CREATE TABLE campfires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    twitch_channel VARCHAR(255),
    settings JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Campfire members (many-to-many)
CREATE TABLE campfire_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campfire_id UUID REFERENCES campfires(id) NOT NULL,
    user_id UUID REFERENCES users(id) NOT NULL,
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'moderator', 'member'
    sprite_id VARCHAR(255),
    color VARCHAR(7),
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campfire_id, user_id)
);

-- Buddies (friendship system)
CREATE TABLE buddies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    buddy_id UUID REFERENCES users(id) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, buddy_id)
);

-- User preferences (Tents)
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL UNIQUE,
    theme VARCHAR(50) DEFAULT 'modern',
    notifications JSONB DEFAULT '{}',
    privacy JSONB DEFAULT '{}',
    stats JSONB DEFAULT '{}'
);
```

#### 1.2 Authentication System
```
Files to create:
- auth/twitch.js (OAuth flow)
- auth/jwt.js (token management)
- middleware/auth.js
```

**Auth Flow**:
1. User clicks "Login with Twitch" on website
2. Redirect to Twitch OAuth (`scope: user:read:email chat:read`)
3. Twitch redirects back with authorization code
4. Exchange code for access token
5. Fetch user data from Twitch API
6. Create/find user in database
7. Generate JWT token
8. Store session in Redis
9. Set httpOnly cookie with JWT

**Key Files**:
- `routes/auth.js` - OAuth endpoints
- `routes/users.js` - User CRUD
- `middleware/auth.js` - JWT verification

#### 1.3 Database Connection
```
Install: pg, redis, @railway/db
Files:
- database/connection.js
- database/models/*.js
```

---

### Phase 2: Real-Time Infrastructure (WebSockets)
**Duration**: 2-3 weeks

#### 2.1 WebSocket Server
```
Install: socket.io
Files:
- server/websocket.js
- server/socket-handlers/
```

**Socket Events**:
```javascript
// Client → Server
socket.emit('joinCampfire', { campfireId, userId })
socket.emit('leaveCampfire', { campfireId })
socket.emit('updateSprite', { userId, spriteId, color })
socket.emit('sendMessage', { campfireId, message })
socket.emit('addBuddy', { buddyId })
socket.emit('acceptBuddy', { requestId })

// Server → Client
socket.on('userJoined', { user })
socket.on('userLeft', { userId })
socket.on('spriteUpdated', { userId, sprite, color })
socket.on('chatMessage', { userId, message, timestamp })
socket.on('buddyRequest', { fromUser })
socket.on('buddyOnline', { userId })
```

#### 2.2 Room Management
```javascript
// Each campfire is a socket room
io.to(`campfire:${campfireId}`).emit('update', users)

// Each user has a personal notification channel
io.to(`user:${userId}`).emit('notification', data)
```

---

### Phase 3: Creator Dashboard (Web)
**Duration**: 4-6 weeks

#### 3.1 Pages to Create
```
- /dashboard (creator home)
- /dashboard/campfire/[id] (manage specific campfire)
- /dashboard/settings (account settings)
- /dashboard/analytics (view stats)
```

#### 3.2 Features
| Feature | Description |
|---------|-------------|
| Campfire Overview | List all campfires, create new ones |
| Member Management | View, kick, mute members |
| Settings | Configure join methods, restrictions |
| Sprite Editor | Upload/manage custom sprites |
| Command Config | Edit command triggers and responses |
| Widget Preview | Live preview of campfire widget |
| Embed Code | OBS/Browser source embed URLs |

#### 3.3 Embed Widget
```html
<!-- For OBS Browser Source -->
<iframe src="https://campfire.example.com/embed/[campfireId]"
        width="1920" height="1080" frameborder="0"></iframe>

<!-- Direct widget URL -->
https://campfire.example.com/widget/[campfireId]
```

---

### Phase 4: Viewer Experience (Tents + Buddy List)
**Duration**: 4-6 weeks

#### 4.1 Tents (Personal Profile Page)
```
Route: /tents/[username]

Features:
- Profile information (avatar, display name, bio)
- Stats: campfires joined, time spent, achievements
- Current campfire indicator
- Edit profile settings
- Privacy controls
```

#### 4.2 Buddy List System
```
Route: /buddies

Features:
- Global friend list (not campfire-specific)
- Online/offline status
- Quick jump to campfire where buddy is
- Buddy request management
- Blocked users list

UI: Enhance existing buddy-list.html for web
```

#### 4.3 Campfire Browser
```
Route: /campfires

Features:
- Search public campfires
- Filter by game, language, etc.
- "Join Campfire" quick action
- Featured campfires

UI: New page, similar to Discord server browser
```

#### 4.4 Viewer Dashboard (Enhanced)
```
Route: /dashboard/customize/[campfireId]

Features:
- Sprite/color selection (existing, enhance)
- Movement controls (keyboard, UI buttons)
- View current campfire
- Stats summary

UI: Build on existing viewer-dashboard.html
```

---

### Phase 5: Chat System
**Duration**: 3-4 weeks

#### 5.1 Chat Architecture
```
- WebSocket-based for real-time
- Fallback to HTTP polling if needed
- Persist messages to database
- Support Twitch chat integration
```

#### 5.2 Features
| Feature | Description |
|---------|-------------|
| Message History | Load previous messages |
| Emotes | Twitch emote support |
| Mentions | @username highlighting |
| Commands | !join, !leave, etc. |
| Moderation | Block, report messages |
| Private Messages | User-to-user chat |

#### 5.3 UI Integration
```
- Add chat panel to buddy-list.html
- Integrate with widget.html for hover chat
- Create standalone chat window option
```

---

### Phase 6: Desktop App Integration
**Duration**: 4-6 weeks

#### 6.1 Architecture Change
```
Current: Desktop app runs its own server
New: Desktop app connects to hosted backend

Desktop App → HTTPS API (authentication, data)
Desktop App → WebSocket (real-time events)
Desktop App → Twitch IRC (chat integration)
```

#### 6.2 Hybrid Mode Support
```javascript
// Desktop app can operate in two modes:
const MODE = {
    HOSTED: 'hosted',      // Connect to campfire.example.com
    LOCAL: 'local'         // Run local campfire (existing mode)
};

// User can choose mode on first launch
// Settings sync between modes via cloud
```

#### 6.3 Key Changes
```
1. Update main.js to support hosted mode
2. Modify UserManager to sync with cloud
3. Add OAuth login flow to desktop app
4. Keep local mode for offline use
5. Implement auto-sync when online
```

---

### Phase 7: Deployment & Infrastructure
**Duration**: 2-3 weeks

#### 7.1 Railway Configuration
```
Services needed:
- Web app (Express + Next.js/React)
- PostgreSQL (Railway database)
- Redis (Railway kv store)
- WebSocket server (same as web or separate)

Environment variables:
DATABASE_URL
REDIS_URL
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
JWT_SECRET
RAILWAY_PUBLIC_DOMAIN
```

#### 7.2 CI/CD Pipeline
```
GitHub Actions workflow:
1. Run tests
2. Build frontend
3. Deploy to Railway staging
4. Deploy to Railway production
5. Run database migrations
```

#### 7.3 Domain & SSL
```
- Configure custom domain in Railway
- Auto SSL via Railway/LetsEncrypt
- CDN for static assets (optional)
```

---

## Detailed Implementation Steps

### Step 1: Set Up Development Environment
```bash
# Clone and setup
git clone campfire-widget.git
cd campfire-widget

# Install dependencies
npm install express socket.io pg redis jsonwebtoken

# Set up PostgreSQL (local or Docker)
docker run --name campfire-db -e POSTGRES_PASSWORD=secret \
  -p 5432:5432 -d postgres

# Create database
psql -U postgres -c "CREATE DATABASE campfire;"

# Set environment variables
cp .env.example .env
# Edit .env with your credentials
```

### Step 2: Build Database Layer
```bash
# Create migration files
mkdir -p database/migrations

# Write migrations for:
# 001_create_users.sql
# 002_create_campfires.sql
# 003_create_campfire_members.sql
# 004_create_buddies.sql
# 005_create_user_preferences.sql

# Run migrations
npm run migrate
```

### Step 3: Implement Auth System
```bash
# Create auth routes
mkdir -p routes middleware services

# Files to create:
routes/auth.js        # OAuth endpoints
routes/users.js       # User CRUD
middleware/auth.js    # JWT verification
services/twitch.js    # Twitch API wrapper

# Test OAuth flow
npm run dev  # Start server
# Navigate to http://localhost:3000/auth/twitch
```

### Step 4: Build WebSocket Server
```bash
# Create socket handlers
mkdir -p server/socket-handlers

# Files to create:
server/websocket.js   # Socket.io setup
server/socket-handlers/campfire.js
server/socket-handlers/chat.js
server/socket-handlers/buddies.js
server/socket-handlers/notifications.js

# Test real-time features
npm run dev
# Open multiple browser tabs, test events
```

### Step 5: Create Creator Dashboard
```bash
# Choose frontend framework (recommend Next.js for SEO)
npx create-next-app@latest website
cd website

# Create pages:
# app/page.tsx (landing)
# app/dashboard/page.tsx (creator home)
# app/dashboard/[campfireId]/page.tsx (manage campfire)
# app/tents/page.tsx (viewer profile)

# Create components:
components/CampfireList.js
components/MemberTable.js
components/SpriteUploader.js
components/WidgetPreview.js
```

### Step 6: Build Viewer Features
```bash
# Enhance buddy-list.html for web
# Create new pages:
website/app/buddies/page.tsx
website/app/campfires/page.tsx
website/app/dashboard/customize/[campfireId]/page.tsx

# Mobile responsiveness
# Ensure all pages work on mobile
```

### Step 7: Implement Chat
```bash
# Create chat components
components/ChatWindow.js
components/ChatMessage.js
components/EmotePicker.js

# Database schema for messages
database/migrations/006_create_messages.sql
```

### Step 8: Desktop App Updates
```bash
# Modify desktop-app files:
desktop-app/src/main/index.js
desktop-app/src/main/state/UserManager.js
desktop-app/src/main/ipc/AuthHandlers.js

# Add OAuth login window to desktop
# Implement cloud sync
# Test hybrid mode
```

### Step 9: Testing & QA
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests (Playwright)
npm run test:e2e

# Load testing
npm run test:load
```

### Step 10: Deploy to Railway
```bash
# Set up Railway project
railway init
railway add postgresql
railway add redis

# Set environment variables
railway variables set DATABASE_URL=$DATABASE_URL
railway variables set REDIS_URL=$REDIS_URL
railway variables set TWITCH_CLIENT_ID=$CLIENT_ID
railway variables set TWITCH_CLIENT_SECRET=$CLIENT_SECRET

# Deploy
railway up

# Verify deployment
curl https://your-app.railway.app/api/health
```

---

## Desktop ↔ Hosted Communication

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                      DESKTOP APPLICATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Main Process                                             │    │
│  │ • IPC Handlers for renderer processes                   │    │
│  │ • Twitch IRC connection (local or hosted)               │    │
│  │ • State sync with hosted backend (when online)          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            │ IPC                                  │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Renderer Processes                                       │    │
│  │ • Widget window (visual display)                        │    │
│  │ • Dashboard window (creator controls)                   │    │
│  │ • Viewer dashboard (customization)                      │    │
│  │ • Buddy list window                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                     │
│                            │ HTTPS / WebSocket                    │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ HOSTED BACKEND (Railway)                                │    │
│  │ • User authentication (JWT)                            │    │
│  │ • Campfire state management                            │    │
│  │ • Real-time event broadcasting                         │    │
│  │ • Database persistence                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Strategy
```
1. Desktop app authenticates with hosted backend via OAuth
2. Desktop app requests current campfire state from API
3. Changes made locally broadcast to hosted backend
4. Hosted backend broadcasts to all connected clients (web + desktop)
5. Desktop app receives updates, updates local state
6. Conflict resolution: Last-write-wins for most data
7. Offline mode: Desktop app operates independently, syncs when online
```

### API Endpoints
```javascript
// Authentication
POST /api/auth/twitch/login      // Desktop OAuth flow
POST /api/auth/twitch/callback   // OAuth callback
POST /api/auth/logout            // Clear session

// Campfires
GET  /api/campfires              // List user's campfires
POST /api/campfires              // Create new campfire
GET  /api/campfires/:id          // Get campfire details
PUT  /api/campfires/:id          // Update campfire
DELETE /api/campfires/:id       // Delete campfire

// Members
GET  /api/campfires/:id/members  // List members
POST /api/campfires/:id/join     // Join campfire
DELETE /api/campfires/:id/leave  // Leave campfire

// Real-time (WebSocket)
joinCampfire(campfireId)
leaveCampfire(campfireId)
updateSprite(spriteData)
sendChatMessage(message)

// Sync
GET  /api/sync/state             // Get full state
POST /api/sync/changes           // Push local changes
```

---

## User Account Types

### Creator Account
**Purpose**: Streamers who want to host campfires on their streams

**Features**:
- Dashboard: `/dashboard`
  - Create/manage multiple campfires
  - Configure settings (join methods, restrictions)
  - View member list
  - Upload custom sprites
  - Configure commands
  - Analytics (view counts, engagement)
- Widget URLs for OBS
  - Direct: `https://campfire.example/widget/[id]`
  - Embed: `https://campfire.example/embed/[id]`
- API access (optional, for advanced integrations)

**Onboarding**:
1. Login with Twitch
2. "Create Your First Campfire"
3. Configure settings
4. Get widget URL for OBS
5. Done!

### Viewer Account
**Purpose**: People who want to join campfires and connect with friends

**Features**:
- Tents (Profile): `/tents/[username]`
  - Customizable profile
  - Stats (campfires joined, time spent, achievements)
  - Current activity
  - Privacy controls
- Buddy List: `/buddies`
  - Global friend system
  - Online/offline status
  - Quick join to buddy's campfire
  - Blocked users
- Campfire Browser: `/campfires`
  - Discover public campfires
  - Search/filter
  - Quick join
- Viewer Dashboard: `/dashboard/customize/[campfireId]`
  - Customize sprite/color
  - Movement controls
  - View current campfire
  - Stats summary

**Onboarding**:
1. Login with Twitch
2. Complete profile setup (optional)
3. Find friends or browse campfires
4. Join a campfire
5. Customize appearance

---

## Difficulty Assessment

### Overall: MODERATE-HIGH

| Aspect | Difficulty | Notes |
|--------|------------|-------|
| Database design | Medium | Straightforward relational schema |
| Auth system | Medium | Standard OAuth + JWT |
| WebSocket server | Medium | Socket.io is well-documented |
| Creator dashboard | Medium | CRUD + UI work |
| Buddy system | Medium | Social features are complex |
| Tents (profile) | Low-Medium | Standard profile pages |
| Chat system | Medium | Real-time + persistence |
| Desktop integration | High | Hybrid offline/online mode |
| Multi-campfire | Medium | Room management |
| Deployment | Low | Railway handles most |

### Time Estimates (Weekly Hours)

| Phase | Hours | Weeks (20hr/week) |
|-------|-------|-------------------|
| Phase 1: Foundation | 80-120 | 4-6 |
| Phase 2: WebSockets | 40-60 | 2-3 |
| Phase 3: Creator Dashboard | 80-120 | 4-6 |
| Phase 4: Viewer Features | 80-120 | 4-6 |
| Phase 5: Chat | 60-80 | 3-4 |
| Phase 6: Desktop Integration | 80-120 | 4-6 |
| Phase 7: Deployment | 40-60 | 2-3 |
| **Total** | **460-680** | **23-34 weeks** |

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Twitch API limits | High | Cache aggressively, use webhooks |
| Database scaling | Medium | PostgreSQL handles scale well initially |
| WebSocket connections | Medium | Use Redis adapter for horizontal scaling |
| Offline sync conflicts | High | Implement CRDTs or clear conflict resolution |
| Security vulnerabilities | High | Regular audits, rate limiting, input validation |
| User adoption | Medium | Start with existing desktop users |

---

## Recommendations

### 1. Start on Localhost
- Build and test everything locally first
- Use Docker for PostgreSQL/Redis
- Don't deploy to Railway until core features work
- This allows rapid iteration without deployment costs

### 2. Minimum Viable Product (MVP)
For v1.0, focus on:
1. User accounts (Twitch OAuth)
2. Campfire creation/management
3. Basic widget display
4. Simple buddy list
5. LocalStorage sync for desktop app

Defer for v1.1+:
- Full chat system
- Advanced analytics
- Mobile app
- Multi-platform support (YouTube, Kick)

### 3. Incremental Development
```
Sprint 1: Database + Auth
Sprint 2: Basic campfires + widget
Sprint 3: Creator dashboard
Sprint 4: Buddy list
Sprint 5: Tents profile
Sprint 6: Desktop integration
Sprint 7: Testing + Deployment
```

### 4. Keep Desktop App Flexible
- Desktop app should work in both "local" and "hosted" modes
- Users can choose their preferred mode
- Local mode: Run campfire entirely on desktop
- Hosted mode: Connect to campfire.example.com
- Both modes can sync when online

---

## Conclusion

Building a hosted version of Campfire Widget with full user accounts is a **significant but achievable project**. The current codebase provides an excellent foundation with:

**Strengths to leverage:**
- ✅ Express server already set up
- ✅ Twitch OAuth flow working
- ✅ Railway deployment configured
- ✅ Solid widget/buddy list UIs
- ✅ Clear architectural vision in DEVELOPER_GUIDE.md

**Key challenges:**
- ❌ No database layer
- ❌ No persistent user accounts
- ❌ No WebSocket real-time system
- ❌ No web-based creator dashboard
- ❌ No desktop-to-hosted sync

**Recommendation:** Start by implementing the database layer and authentication on localhost. This gives you a solid foundation to build upon. Deploy to Railway only when the core auth + data layer is tested and working.

The goal of having desktop and web access the same underlying campfire is absolutely achievable with the architecture described above. The key is ensuring both clients speak the same API to the hosted backend.

---

*Document created for planning purposes. Update as implementation progresses.*
