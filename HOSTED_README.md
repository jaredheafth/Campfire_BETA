# Campfire Widget - Hosted Platform

This is the hosted version of Campfire Widget, a real-time interactive campfire experience for Twitch streamers.

## Features

- 🔥 **Creator Campfires** - Streamers can create and manage their own campfires
- 👥 **Buddy System** - Add friends and see when they're online
- 💬 **Real-time Chat** - Chat with other campfire members
- 🎨 **Custom Sprites** - Choose your character and color
- 🌐 **Web + Desktop** - Access from browser or desktop app

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (for production) or use SQLite (development)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/campfire-widget.git
cd campfire-widget

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Configuration

Edit `.env` and add your credentials:

```env
# Generate a strong secret
JWT_SECRET=your-super-secret-key

# Get from https://dev.twitch.tv/console
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# Set your frontend URL
FRONTEND_URL=http://localhost:3000
```

### Running Locally (SQLite)

```bash
# Run with SQLite (no PostgreSQL needed)
npm run dev
# or
node hosted-server.js
```

The server will start at `http://localhost:3000`

### Running with PostgreSQL

```bash
# Set your PostgreSQL connection URL
export DATABASE_URL="postgresql://user:password@host:5432/database"

# Run migrations
npm run db:migrate

# Start server
node hosted-server.js
```

## Deployment to Railway

### 1. Create Railway Project

```bash
# Install Railway CLI
npm i -g railway

# Login
railway login

# Create project
railway init
```

### 2. Add PostgreSQL

```bash
railway add postgresql
```

### 3. Set Environment Variables

```bash
railway variables set JWT_SECRET="your-strong-secret"
railway variables set TWITCH_CLIENT_ID="your_twitch_client_id"
railway variables set TWITCH_CLIENT_SECRET="your_twitch_client_secret"
railway variables set FRONTEND_URL="https://your-app.railway.app"
```

### 4. Deploy

```bash
railway up
```

Railway will automatically:
- Build the application
- Set up PostgreSQL
- Configure environment variables
- Start the server

## API Documentation

### Authentication

```javascript
// Get OAuth URL
GET /api/auth/twitch
// Returns: { url: "...", state: "..." }

// Complete OAuth login
POST /api/auth/twitch/token
Body: { code: "authorization_code", deviceId: "optional" }
Returns: { user, accessToken, refreshToken, sessionToken }

// Refresh token
POST /api/auth/refresh
Body: { refreshToken }
Returns: { accessToken }

// Logout
POST /api/auth/logout

// Get current user
GET /api/auth/me
Headers: { Authorization: "Bearer ..." }
```

### Campfires

```javascript
// List user's campfires
GET /api/campfires
Headers: { Authorization: "Bearer ..." }

// Create campfire
POST /api/campfires
Headers: { Authorization: "Bearer ..." }
Body: { name, slug?, description?, tags? }

// Get campfire details
GET /api/campfires/:id
Headers: { Authorization: "Bearer ..." }

// Get campfire members
GET /api/campfires/:id/members

// Join campfire
POST /api/campfires/:id/join
Headers: { Authorization: "Bearer ..." }

// Leave campfire
POST /api/campfires/:id/leave
Headers: { Authorization: "Bearer ..." }

// Discover campfires
GET /api/campfires/discover
Query: { query?, platform?, tags?, limit? }

// Featured campfires
GET /api/campfires/featured
```

### Buddies

```javascript
// Get friends
GET /api/buddies
Headers: { Authorization: "Bearer ..." }

// Get pending requests
GET /api/buddies/requests

// Send buddy request
POST /api/buddies/request
Body: { userId, message? }
```

## WebSocket Events

Connect to `http://localhost:3000/socket.io` with authentication:

```javascript
// Authentication
io({
    auth: { token: "access_token" }
});

// Events
socket.on('userJoined', (data) => { ... })
socket.on('userLeft', (data) => { ... })
socket.on('chatMessage', (data) => { ... })
socket.on('spriteUpdated', (data) => { ... })

// Emit
socket.emit('joinCampfire', { campfireId })
socket.emit('chatMessage', { campfireId, content })
socket.emit('updateSprite', { campfireId, spriteId, color })
socket.emit('startMovement', { campfireId, direction })
socket.emit('stopMovement', { campfireId })
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HOSTED BACKEND                        │
│                  (Express + Socket.io)                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                    API Layer                       │   │
│  │  • Authentication (JWT, Twitch OAuth)            │   │
│  │  • Campfire CRUD                                │   │
│  │  • Buddy System                                 │   │
│  │  • Messages                                     │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                                │
│                          ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │              WebSocket Layer                       │   │
│  │  • Real-time events                               │   │
│  │  • Campfire rooms                                │   │
│  │  • Chat broadcasting                             │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                                │
│                          ▼                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 Database (PostgreSQL)              │   │
│  │  • Users, Campfires, Members, Buddies, Messages   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Development

### Running Tests

```bash
npm test
```

### Database Migrations

```bash
# Run migrations
npm run db:migrate

# Run seeds (optional)
npm run db:seed
```

## License

MIT License - see LICENSE file for details.

## Support

- GitHub Issues: Report bugs and feature requests
- Discord: Join our community server
