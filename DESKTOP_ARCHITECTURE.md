# Desktop App Architecture - Native Electron Implementation

## Overview
The desktop app will run entirely within Electron windows, with no localhost server or Node.js dependency. Everything runs natively in Electron's main and renderer processes.

## Architecture Components

### 1. Main Process (`main.js`)
- **Twitch Client**: Runs tmi.js client directly in main process
- **IPC Handlers**: Handle communication between windows
- **Window Management**: Create/manage widget, dashboard, and member dashboard windows
- **File Access**: Direct file system access for sprites and settings
- **Settings Storage**: Store settings in JSON file (or Electron's userData)

### 2. Widget Window
- **Purpose**: Visual display for OBS Application Capture
- **File**: `widget.html` (loaded via `file://` protocol)
- **Communication**: IPC with main process for settings/updates
- **Features**: 
  - Transparent background
  - Full-screen or custom size
  - Real-time user updates via IPC

### 3. Dashboard Window
- **Purpose**: Streamer's control panel
- **File**: `dashboard.html` (loaded via `file://` protocol)
- **Communication**: IPC with main process
- **Features**:
  - Settings configuration
  - Test button (opens widget preview window)
  - Member management
  - Per-member dashboard buttons

### 4. Member Dashboard Windows
- **Purpose**: Individual viewer customization
- **File**: `viewer-dashboard.html` (loaded via `file://` protocol)
- **Communication**: IPC with main process
- **Features**:
  - Sprite selection
  - Color selection
  - Save to main process

## Communication Flow

### Current (Server-based):
```
Dashboard → localStorage → Widget (via storage event)
Server → WebSocket → Widget
```

### New (IPC-based):
```
Dashboard → IPC → Main Process → IPC → Widget
Main Process (Twitch) → IPC → Widget
```

## File Serving

### Current:
- HTTP server serves files at `http://localhost:3000/...`

### New:
- Custom Electron protocol: `campfire://` or direct `file://` access
- Sprites loaded via `file://` protocol or custom protocol handler
- No HTTP server needed

## Implementation Steps

1. **Remove server spawning** from main.js
2. **Create custom protocol** for sprite/file serving
3. **Move Twitch client** to main process
4. **Create widget window** (transparent, always on top option)
5. **Update dashboard** to use IPC instead of localStorage
6. **Update widget** to use IPC instead of localStorage
7. **Add member dashboard** window creation
8. **Add Test button** functionality
9. **Add per-member buttons** in dashboard

## Benefits

- ✅ No Node.js dependency
- ✅ No localhost server needed
- ✅ More stable (no process spawning)
- ✅ Better performance (direct IPC)
- ✅ Native desktop app feel
- ✅ Easier OBS integration (Application Capture)

## Hosted Version

- Keep existing server.js architecture unchanged
- Desktop and hosted versions can coexist
- Same HTML files, different communication layer
