# Viewer Dashboard Communication Flow

This document explains how viewer selections (sprite, color, movement) communicate from the viewer dashboard to the server and then to the widget.

## Communication Architecture

The system uses a **dual-communication approach** for maximum compatibility:

1. **Primary Method**: Server API (works across browsers/computers)
2. **Fallback Method**: localStorage events (works same-origin only)

## How It Works

### 1. Viewer Joins Campfire

**Viewer Dashboard** (`viewer-dashboard.html`):
```javascript
// User clicks "Join Campfire"
POST http://localhost:3000/api/viewer/join
{
    username: "ViewerName",
    userId: "12345678",
    color: "#ff0000",
    selectedSprite: { data: "...", name: "Archer" }
}
```

**Server** (`server.js`):
- Receives join request
- Adds user to `activeUsers` Map
- Broadcasts `userJoin` event to event queue
- Returns success

**Widget** (`widget.html`):
- Polls `/api/events` every 500ms
- Receives `userJoin` event
- Calls `widget.addUser()` to add sprite around campfire

### 2. Viewer Moves Left/Right

**Viewer Dashboard**:
```javascript
// User presses Left/Right arrow keys
POST http://localhost:3000/api/viewer/move
{
    username: "ViewerName",
    userId: "12345678",
    direction: -1,  // -1 = left, 1 = right
    speed: 15       // degrees per movement
}
```

**Server**:
- Receives movement request
- Broadcasts `viewerMovement` event

**Widget**:
- Receives `viewerMovement` event via polling
- Calls `widget.moveUser(username, direction, speed)`
- Sprite moves around the campfire circle

### 3. Viewer Stops Moving

**Viewer Dashboard**:
```javascript
// User releases arrow key
POST http://localhost:3000/api/viewer/stop-move
{
    username: "ViewerName",
    userId: "12345678"
}
```

**Server**:
- Broadcasts `viewerStopMovement` event

**Widget**:
- Receives event and calls `widget.stopUserMovement()`
- Sprite stops and returns to idle animation

### 4. Viewer Changes Color/Sprite

**Viewer Dashboard**:
```javascript
// User clicks "Save" after selecting color/sprite
POST http://localhost:3000/api/viewer/update
{
    username: "ViewerName",
    userId: "12345678",
    color: "#00ff00",
    selectedSprite: { data: "...", name: "Knight" }
}
```

**Server**:
- Updates user in `activeUsers` Map
- Broadcasts `viewerColorUpdate` event

**Widget**:
- Receives event and calls `widget.updateUserElement(user)`
- Sprite color/sprite updates immediately

## Server API Endpoints

### POST `/api/viewer/join`
Adds a viewer to the campfire.

**Request Body**:
```json
{
    "username": "ViewerName",
    "userId": "12345678",
    "color": "#ff0000",
    "selectedSprite": { "data": "data:image/gif;base64,...", "name": "Archer" }
}
```

### POST `/api/viewer/move`
Moves a viewer around the campfire.

**Request Body**:
```json
{
    "username": "ViewerName",
    "userId": "12345678",
    "direction": -1,  // -1 = left, 1 = right
    "speed": 15       // degrees per movement
}
```

### POST `/api/viewer/stop-move`
Stops viewer movement.

**Request Body**:
```json
{
    "username": "ViewerName",
    "userId": "12345678"
}
```

### POST `/api/viewer/update`
Updates viewer color or sprite.

**Request Body**:
```json
{
    "username": "ViewerName",
    "userId": "12345678",
    "color": "#00ff00",
    "selectedSprite": { "data": "...", "name": "Knight" }
}
```

## Event Polling

The widget polls the server every 500ms:

```javascript
fetch('http://localhost:3000/api/events?since=' + lastEventId)
```

This returns all new events since the last poll, including:
- `userJoin` - Viewer joined
- `viewerMovement` - Viewer moved
- `viewerStopMovement` - Viewer stopped
- `viewerColorUpdate` - Viewer changed color/sprite
- `chatMessage` - Chat message from Twitch

## Fallback: localStorage Events

If the server is not available (e.g., viewer dashboard and widget on same origin), the system falls back to localStorage events:

1. Viewer dashboard sets `localStorage.setItem('viewerJoin', ...)`
2. Widget listens for `storage` events
3. Widget processes the event

This ensures compatibility even when the server isn't running.

## Benefits of Server-Based Communication

✅ **Works across browsers** - Viewer can be on different computer/browser  
✅ **Works across origins** - No CORS issues  
✅ **Centralized** - All events go through one server  
✅ **Scalable** - Can handle multiple viewers easily  
✅ **Reliable** - Server queues events if widget is temporarily disconnected  

## Testing

1. **Start the server**: `node server.js`
2. **Open widget**: `http://localhost:3000/widget.html`
3. **Open viewer dashboard**: `http://localhost:3000/viewer-dashboard.html` (in different browser/computer)
4. **Login and join** - Should see sprite appear
5. **Press arrow keys** - Should see sprite move
6. **Change color** - Should see sprite update

All actions should work even if viewer dashboard and widget are on different browsers/computers!
