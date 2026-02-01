/**
 * Campfire Widget - Desktop App (Native Electron Architecture)
 *
 * This version runs entirely in Electron windows with no localhost server.
 * - Widget window = Primary window (for OBS Application Capture)
 * - Dashboard window = Secondary window (opened from widget menu)
 * - Twitch client runs in main process
 * - Communication via IPC instead of HTTP/WebSocket
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, protocol } = require('electron');
// NOTE: electron-updater is loaded lazily after app.whenReady() to avoid
// "Cannot read properties of undefined (reading 'getVersion')" error
let autoUpdater = null;
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const tmi = require('tmi.js');

// New modular state management system - loaded lazily to avoid circular dependency issues
// These will be populated in app.whenReady()
let UserManager = null;
let UserPreferencesStore = null;
let UserIPCHandlers = null;
let UserManagerBridge = null;
let BotMessageHelper = null;
let IPC_CHANNELS = null;
let USER_STATES = null;

// NOTE: We intentionally keep hardware acceleration enabled for performance.
// If macOS transparent-window "ghosting" returns for some setups, we can reintroduce
// an opt-in setting to disable GPU acceleration (it can cause UI sluggishness).

// ============================================
// GLOBAL STATE
// ============================================
let widgetWindow;        // Primary window - the widget view (for OBS)
let dashboardWindow;     // Secondary window - streamer dashboard
let settingsWindow;      // Settings-only window (gear icon)
let membersWindow;       // Members-only window
let chatPopoutWindow;    // Chat popout window
let buddyListWindow;     // Buddy list window
let memberDashboardWindows = new Map(); // Individual viewer dashboards
let tray;
let twitchClient = null;
let isTwitchConnected = false;
let twitchChannelRoomId = null; // Twitch channel (room) id, captured from IRC message tags when available
// Optional separate chat-bot client (send messages only)
let twitchChatClient = null;
let isTwitchChatConnected = false;
// Derived from twitchConfig at connection time (for UI/status only)
let lastSeparateChatBotUsername = null;
let isRecreatingWidgetWindow = false;
let isQuittingApp = false;
let isQuittingForUpdate = false;

// Auto-join flag - prevents duplicate joins on startup/reconnect
let hasAutoJoinedStreamerBot = false;

// Active users and chat state
let activeUsers = new Map(); // userId -> user data (LEGACY - being replaced by userManager)
let allChatters = new Map(); // username -> user info (for potential members list)
let events = []; // Event queue for widget updates
let lastEventId = 0;

// NEW: Centralized state management (Phase 2 integration)
// These will gradually replace activeUsers Map
let userPreferencesStore = null;  // Initialized in app.whenReady()
let userManager = null;           // Initialized in app.whenReady()
let userManagerBridge = null;     // Backward-compatible wrapper
let userIPCHandlers = null;       // IPC handlers for user operations
let botMessageHelper = null;      // Helper for sending bot messages

// Third-party emotes (BTTV/FFZ/7TV) cache for the connected channel
let thirdPartyEmotesCache = { channel: null, emotes: {}, updatedAt: 0 };
let thirdPartyEmotesInFlight = null;

// Chat message buffer for popout chat persistence
// Stores recent messages so they can be restored when popout is reopened
const CHAT_BUFFER_MAX_SIZE = 200;
let chatMessageBuffer = [];

// Command cooldown tracking
// Maps command ID -> { userId -> lastUsedTimestamp } for per-user cooldowns
// or { '_global' -> lastUsedTimestamp } for global cooldowns
const commandCooldowns = new Map();

// Default cooldown values (in seconds)
const DEFAULT_COOLDOWN_SECONDS = 3;
const DEFAULT_WHO_COOLDOWN_SECONDS = 30;

/**
 * Check if a command is on cooldown for a user
 * @param {string} commandId - The command ID
 * @param {string} userId - The user ID (or '_global' for global cooldowns)
 * @param {Object} commandConfig - The command configuration
 * @returns {Object} { onCooldown: boolean, remainingSeconds: number }
 */
function checkCommandCooldown(commandId, userId, commandConfig) {
    // If cooldown is not enabled or is 0, command is not on cooldown
    if (!commandConfig.cooldownEnabled || !commandConfig.cooldown || commandConfig.cooldown <= 0) {
        return { onCooldown: false, remainingSeconds: 0 };
    }
    
    const cooldownMs = commandConfig.cooldown * 1000; // Convert seconds to ms
    const cooldownKey = commandConfig.cooldownType === 'global' ? '_global' : userId;
    
    // Get or create cooldown map for this command
    if (!commandCooldowns.has(commandId)) {
        commandCooldowns.set(commandId, new Map());
    }
    
    const commandCooldownMap = commandCooldowns.get(commandId);
    const lastUsed = commandCooldownMap.get(cooldownKey) || 0;
    const now = Date.now();
    const elapsed = now - lastUsed;
    
    if (elapsed < cooldownMs) {
        const remainingMs = cooldownMs - elapsed;
        return {
            onCooldown: true,
            remainingSeconds: Math.ceil(remainingMs / 1000)
        };
    }
    
    return { onCooldown: false, remainingSeconds: 0 };
}

/**
 * Update the cooldown timestamp for a command
 * @param {string} commandId - The command ID
 * @param {string} userId - The user ID (or '_global' for global cooldowns)
 * @param {Object} commandConfig - The command configuration
 */
function updateCommandCooldown(commandId, userId, commandConfig) {
    if (!commandConfig.cooldownEnabled || !commandConfig.cooldown || commandConfig.cooldown <= 0) {
        return;
    }
    
    const cooldownKey = commandConfig.cooldownType === 'global' ? '_global' : userId;
    
    if (!commandCooldowns.has(commandId)) {
        commandCooldowns.set(commandId, new Map());
    }
    
    commandCooldowns.get(commandId).set(cooldownKey, Date.now());
}

// Settings storage
let userDataPath;
let settingsPath;
let viewerPrefsPath;

function loadViewerPrefs() {
    try {
        if (fs.existsSync(viewerPrefsPath)) {
            return JSON.parse(fs.readFileSync(viewerPrefsPath, 'utf8'));
        }
    } catch (e) { /* ignore */ }
    return {};
}
function saveViewerPrefsFile(prefs) {
    try {
        fs.writeFileSync(viewerPrefsPath, JSON.stringify(prefs, null, 2), 'utf8');
    } catch (e) {
        console.error('[Main] Error saving viewer-prefs:', e);
    }
}

// Window dimension settings
let windowDimensions = {
    width: 1920,
    height: 1080,
    locked: true
};

// ============================================
// SPRITE PATH MANAGEMENT
// ============================================

function getDefaultSpritePath() {
    if (process.env.ELECTRON_IS_DEV === '1' || !__dirname.includes('.asar')) {
        return path.join(__dirname, 'server', 'sprites');
    }
    const unpackedDir = __dirname.replace('app.asar', 'app.asar.unpacked');
    const unpackedSprites = path.join(unpackedDir, 'server', 'sprites');
    if (fs.existsSync(unpackedSprites)) {
        return unpackedSprites;
    }
    return path.join(__dirname, 'server', 'sprites');
}

function getCustomSpritePath() {
    const configPath = path.join(userDataPath, 'sprite-path.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.customPath && fs.existsSync(config.customPath)) {
                return config.customPath;
            }
        } catch (e) {
            console.error('Error reading sprite path config:', e);
        }
    }
    return null;
}

function getEffectiveSpritePath() {
    const customPath = getCustomSpritePath();
    return customPath || getDefaultSpritePath();
}

// ============================================
// CUSTOM PROTOCOL FOR SPRITES
// ============================================

function registerSpriteProtocol() {
    protocol.registerFileProtocol('campfire-sprites', (request, callback) => {
        const url = request.url.replace('campfire-sprites://', '');
        const spritesDir = getEffectiveSpritePath();
        const filePath = path.join(spritesDir, url);
        
        // Security: ensure file is within sprites directory
        const normalizedPath = path.normalize(filePath);
        const normalizedSpritesDir = path.normalize(spritesDir);
        
        if (!normalizedPath.startsWith(normalizedSpritesDir)) {
            callback({ error: -6 }); // FILE_NOT_FOUND
            return;
        }
        
        callback({ path: normalizedPath });
    });
}

// ============================================
// WINDOW CREATION
// ============================================

async function disconnectTwitchClients() {
    try {
        if (twitchClient) {
            try { await twitchClient.disconnect(); } catch (e) { try { twitchClient.disconnect(); } catch (e2) { /* ignore */ } }
        }
    } catch (e) { /* ignore */ }
    try {
        if (twitchChatClient) {
            try { await twitchChatClient.disconnect(); } catch (e) { try { twitchChatClient.disconnect(); } catch (e2) { /* ignore */ } }
        }
    } catch (e) { /* ignore */ }
    twitchClient = null;
    twitchChatClient = null;
    isTwitchConnected = false;
    isTwitchChatConnected = false;
}

async function shutdownEntireApp({ reason = 'shutdown', forUpdate = false } = {}) {
    if (isQuittingApp) return;
    isQuittingApp = true;
    if (forUpdate) isQuittingForUpdate = true;
    try { console.log(`[Main] shutdownEntireApp: ${reason}${forUpdate ? ' (for update)' : ''}`); } catch (e) { /* ignore */ }

    // Disconnect Twitch clients (both main + optional chat bot)
    await disconnectTwitchClients();

    // Destroy tray (if present)
    try {
        if (tray) {
            tray.destroy();
            tray = null;
        }
    } catch (e) { /* ignore */ }

    // Close all windows (use close(), not destroy(), so Electron can unwind cleanly)
    try {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(w => {
            try { w.removeAllListeners('close'); } catch (e) { /* ignore */ }
            try { w.close(); } catch (e) { /* ignore */ }
        });
    } catch (e) { /* ignore */ }

    // Allow a moment for sockets/windows to close before triggering the updater or quitting
    await new Promise(r => setTimeout(r, 600));

    if (forUpdate) {
        try {
            autoUpdater.quitAndInstall(false, true);
            return;
        } catch (e) {
            console.error('[Main] quitAndInstall failed:', e);
        }
    }

    // Normal quit: request quit, then hard-exit as a safety net.
    try { app.quit(); } catch (e) { /* ignore */ }
    setTimeout(() => {
        try { app.exit(0); } catch (e) { /* ignore */ }
    }, 2500);
}

function createWidgetWindow() {
    // Load saved window dimensions and update the global variable
    const savedDimensions = loadWindowDimensions();
    windowDimensions = savedDimensions; // Update global so toggle-window-lock uses correct values
    const isWindows = process.platform === 'win32';
    const settings = loadSettings() || {};
    const widgetBackground = String(settings.widgetBackground || 'black').toLowerCase();
    const wantsTransparentBg = widgetBackground === 'transparent';
    const useNativeFrame = settings.useNativeFrame !== false;
    const windowBgColor =
        widgetBackground === 'white' ? '#FFFFFFFF' :
        widgetBackground === 'green' ? '#FF00FF00' :
        widgetBackground === 'black' ? '#FF000000' :
        '#FF000000';
    // On Windows, transparent windows are most stable when frameless.
    const frameForWidget = isWindows ? (wantsTransparentBg ? false : useNativeFrame) : useNativeFrame;
    
    widgetWindow = new BrowserWindow({
        width: savedDimensions.width,
        height: savedDimensions.height,
        minWidth: 600,
        minHeight: 600,
        // NOTE: We intentionally do NOT use useContentSize: true
        // Using outer window dimensions (getBounds/setBounds) is more reliable
        // and avoids drift caused by content-to-window size conversions
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false // Keep animations smooth
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Campfire Widget',
        // Background + transparency are chosen based on the user's capture preference.
        // For best performance, we only use a transparent window when explicitly requested.
        backgroundColor: wantsTransparentBg ? '#00000000' : windowBgColor,
        frame: frameForWidget,
        transparent: wantsTransparentBg,
        hasShadow: false,
        resizable: !savedDimensions.locked
    });

    // Load widget HTML directly (cleanest approach - no iframe nesting)
    const widgetPath = path.join(__dirname, 'server', 'widget.html');
    widgetWindow.loadFile(widgetPath);

    // If the renderer fails to load in production, surface a useful error.
    widgetWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error('[Main] Widget did-fail-load:', { errorCode, errorDescription, validatedURL });
        if (app.isPackaged) {
            try {
                dialog.showErrorBox(
                    'Campfire Widget failed to load',
                    `The widget window failed to load.\n\n${errorDescription} (${errorCode})\n${validatedURL || ''}`
                );
            } catch (e) { /* ignore */ }
        }
    });

    widgetWindow.webContents.on('render-process-gone', (_event, details) => {
        console.error('[Main] Widget render-process-gone:', details);
        if (app.isPackaged) {
            try {
                dialog.showErrorBox(
                    'Campfire Widget crashed',
                    `The widget renderer crashed.\n\nReason: ${details?.reason || 'unknown'}\nExit code: ${details?.exitCode ?? 'unknown'}`
                );
            } catch (e) { /* ignore */ }
        }
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        widgetWindow.webContents.openDevTools();
    }

    // Closing the Visual Display should end the entire program (widget-style app).
    // IMPORTANT: allow closes triggered by recreateWidgetWindow() and updater shutdown.
    widgetWindow.on('close', (e) => {
        if (isRecreatingWidgetWindow || isQuittingApp || isQuittingForUpdate) return;
        e.preventDefault();
        shutdownEntireApp({ reason: 'widget-window-closed' }).catch(() => {
            try { app.exit(0); } catch (e2) { /* ignore */ }
        });
    });

    widgetWindow.on('closed', () => {
        widgetWindow = null;
        // Don't clear dashboardWindow - it's a separate window now
    });
    
    widgetWindow.on('resize', () => {
        // Skip saving during lock toggle to prevent dimension drift
        // The isTogglingLock flag is set by toggle-window-lock handler
        if (typeof isTogglingLock !== 'undefined' && isTogglingLock) {
            return;
        }
        
        if (widgetWindow && !windowDimensions.locked) {
            // Use getBounds() for outer window dimensions (more reliable than getSize with useContentSize)
            const bounds = widgetWindow.getBounds();
            const width = bounds.width;
            const height = bounds.height;

            // Enforce minimum dimensions programmatically
            const minWidth = 600;
            const minHeight = 600;
            let needsResize = false;
            let newWidth = width;
            let newHeight = height;

            if (width < minWidth) {
                newWidth = minWidth;
                needsResize = true;
            }
            if (height < minHeight) {
                newHeight = minHeight;
                needsResize = true;
            }

            if (needsResize) {
                widgetWindow.setBounds({ ...bounds, width: newWidth, height: newHeight });
            }

            windowDimensions.width = needsResize ? newWidth : width;
            windowDimensions.height = needsResize ? newHeight : height;
            saveWindowDimensions();
        }
    });
    
    console.log('[Main] Widget window created successfully');
}

function createDashboardWindow(tab = null) {
    console.log('[Main] createDashboardWindow called with tab:', tab);
    console.log('[Main] dashboardWindow exists?', !!dashboardWindow);
    console.log('[Main] dashboardWindow destroyed?', dashboardWindow ? dashboardWindow.isDestroyed() : 'N/A');
    
    // Check if dashboard window already exists AND is not destroyed
    if (dashboardWindow) {
        if (!dashboardWindow.isDestroyed()) {
            console.log('[Main] Dashboard window already exists, showing and focusing');
            dashboardWindow.show(); // Make sure it's visible
            dashboardWindow.focus(); // Bring to front
            dashboardWindow.moveTop(); // Move to top of window stack
            if (tab) {
                dashboardWindow.webContents.send('switch-tab', tab);
            }
            return;
        } else {
            console.log('[Main] Dashboard window was destroyed, clearing reference');
            dashboardWindow = null;
        }
    }

    console.log('[Main] Creating new dashboard window');
    
    // Create new dashboard window with full settings
    dashboardWindow = new BrowserWindow({
        width: 750,
        height: 900,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Campfire Widget - Dashboard',
        backgroundColor: '#1a1a1a',
        show: false // Don't show until ready to load
    });

    const dashboardPath = path.join(__dirname, 'server', 'dashboard.html');
    console.log('[Main] Loading dashboard from:', dashboardPath);
    console.log('[Main] Dashboard path exists?', fs.existsSync(dashboardPath));
    
    dashboardWindow.loadFile(dashboardPath).then(() => {
        console.log('[Main] Dashboard loaded successfully');
        dashboardWindow.show(); // Show after loaded
    }).catch((err) => {
        console.error('[Main] Error loading dashboard:', err);
    });

    // Open DevTools only in development mode
    // dashboardWindow.webContents.openDevTools();

    if (tab) {
        dashboardWindow.webContents.on('did-finish-load', () => {
            dashboardWindow.webContents.send('switch-tab', tab);
        });
    }

    dashboardWindow.on('closed', () => {
        console.log('[Main] Dashboard window closed');
        dashboardWindow = null;
    });
    
    console.log('[Main] Dashboard window created successfully');
}

function createMemberDashboardWindow(userId, username, mode = 'streamer') {
    // Close existing window for this user if open
    if (memberDashboardWindows.has(userId)) {
        const existingWindow = memberDashboardWindows.get(userId);
        if (!existingWindow.isDestroyed()) {
            existingWindow.focus();
            return;
        }
        memberDashboardWindows.delete(userId);
    }

    const memberWindow = new BrowserWindow({
        width: 500,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: `Viewer Dashboard - ${username}`,
        backgroundColor: '#1a1a1a'
    });

    const viewerDashboardPath = path.join(__dirname, 'server', 'viewer-dashboard.html');
    memberWindow.loadFile(viewerDashboardPath, {
        query: { userId: String(userId), username: String(username), mode: String(mode || 'streamer') }
    });

    memberWindow.on('closed', () => {
        memberDashboardWindows.delete(userId);
    });

    memberDashboardWindows.set(userId, memberWindow);
}

function createSettingsWindow() {
    // Check if settings window already exists
    if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Campfire Widget - Settings',
        backgroundColor: '#1a1a1a'
    });

    // Load the dashboard HTML (which contains the settings modal)
    const dashboardPath = path.join(__dirname, 'server', 'dashboard.html');
    settingsWindow.loadFile(dashboardPath);

    if (process.env.NODE_ENV === 'development') {
        settingsWindow.webContents.openDevTools();
    }

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
    
    // Open settings modal automatically when window loads
    settingsWindow.webContents.once('did-finish-load', () => {
        // Send message to open settings modal
        setTimeout(() => {
            settingsWindow.webContents.executeJavaScript(`
                if (typeof openSettings === 'function') {
                    openSettings();
                }
            `);
        }, 200);
    });
}

function createMembersWindow() {
    // Check if members window already exists
    if (membersWindow && !membersWindow.isDestroyed()) {
        membersWindow.focus();
        return;
    }

    membersWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Campfire Widget - Members',
        backgroundColor: '#1a1a1a'
    });

    // Create a simple HTML page for members
    const membersHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Campfire Widget - Members</title>
    <style>
        @font-face {
            font-family: 'UsernameFont';
            src: url('fonts/w95fa.woff2') format('woff2'),
                 url('fonts/w95fa.woff') format('woff'),
                 url('fonts/W95FA.otf') format('opentype');
            font-weight: normal;
            font-style: normal;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #1a1a1a;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #333;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 5px;
        }
        .header p {
            color: #888;
            font-size: 13px;
        }
        .members-list {
            display: grid;
            gap: 10px;
        }
        .member-item {
            background: #2a2a2a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 15px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        }
        .member-info {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .member-name {
            font-weight: bold;
            font-size: 14px;
            color: #fff;
        }
        .member-status {
            font-size: 11px;
            color: #888;
        }
        .member-actions {
            display: flex;
            gap: 8px;
        }
        .toggle-switch {
            position: relative;
            width: 50px;
            height: 24px;
            background: #444;
            border-radius: 12px;
            cursor: pointer;
            transition: background 0.3s;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
        }
        .toggle-switch.active {
            background: #4caf50;
        }
        .btn {
            padding: 6px 12px;
            border: 1px solid #444;
            border-radius: 4px;
            background: #333;
            color: #fff;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }
        .btn:hover {
            background: #444;
        }
        .btn.danger {
            background: #ff3b30;
            border-color: #ff3b30;
        }
        .btn.danger:hover {
            background: #ff2d20;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #888;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>👥 Campfire Members</h1>
        <p>Manage viewers around the campfire</p>
    </div>
    <div id="membersList" class="members-list">
        <div class="loading">Loading members...</div>
    </div>
    <script>
        let allMembers = [];
        let activeUsers = [];
        function escapeHtml(str) { if (str == null) return ''; var s = String(str); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
        function escapeJsQuoted(str) { if (str == null) return ''; return String(str).replace(/\\\\/g,'\\\\\\\\').replace(/'/g,"\\\\'").replace(/\\r/g,'\\r').replace(/\\n/g,'\\n'); }
        
        async function loadMembers() {
            if (!window.electronAPI) {
                document.getElementById('membersList').innerHTML = '<div class="empty-state">Not available (Web version)</div>';
                return;
            }
            
            try {
                const [active, widgetUsers, potential] = await Promise.all([
                    window.electronAPI.getActiveUsers(),
                    window.electronAPI.getWidgetUsers(),
                    window.electronAPI.getPotentialMembers()
                ]);
                
                activeUsers = active;
                
                // Create a map of all users from both sources (like dashboard does)
                const userMap = new Map();
                
                // Add active users from main process
                active.forEach(u => {
                    userMap.set(u.userId || u.username.toLowerCase(), {
                        username: u.username,
                        userId: u.userId || u.username.toLowerCase(),
                        joined: true,
                        source: 'main'
                    });
                });
                
                // Add widget users (includes test users) - this is critical for test users
                widgetUsers.forEach(u => {
                    const key = u.userId || u.username.toLowerCase();
                    if (userMap.has(key)) {
                        userMap.get(key).joined = true;
                    } else {
                        userMap.set(key, {
                            username: u.username,
                            userId: key,
                            joined: true,
                            source: 'widget'
                        });
                    }
                });
                
                // Add potential members that aren't already active
                potential.forEach(p => {
                    const key = p.userId || p.username.toLowerCase();
                    if (!userMap.has(key)) {
                        userMap.set(key, {
                            username: p.username,
                            userId: key,
                            joined: false,
                            source: 'potential'
                        });
                    }
                });
                
                // Ensure test users are always present
                const testUsers = ['TestUser1', 'TestUser2', 'TestUser3'];
                testUsers.forEach(testUser => {
                    const key = testUser.toLowerCase();
                    if (!userMap.has(key)) {
                        // Check if in widget users (most reliable for test users)
                        const inWidget = widgetUsers.find(w => 
                            (w.userId || w.username.toLowerCase()) === key
                        );
                        userMap.set(key, {
                            username: testUser,
                            userId: key,
                            joined: !!inWidget,
                            source: 'test'
                        });
                    } else {
                        // Update joined status from widget users (most reliable)
                        const inWidget = widgetUsers.find(w => 
                            (w.userId || w.username.toLowerCase()) === key
                        );
                        if (inWidget) {
                            userMap.get(key).joined = true;
                        }
                    }
                });
                
                // Convert map to array
                allMembers = Array.from(userMap.values());
                
                renderMembers();
            } catch (error) {
                console.error('Error loading members:', error);
                document.getElementById('membersList').innerHTML = '<div class="empty-state">Error loading members</div>';
            }
        }
        
        function renderMembers() {
            const container = document.getElementById('membersList');
            
            if (allMembers.length === 0) {
                container.innerHTML = '<div class="empty-state">No members found</div>';
                return;
            }
            
            container.innerHTML = allMembers.map(member => {
                const isJoined = member.joined || activeUsers.find(a => a.userId === member.userId || a.username === member.username);
                const isTestUser = member.username && member.username.startsWith('TestUser');
                const uid = escapeJsQuoted(member.userId || '');
                const uname = escapeJsQuoted(member.username || '');
                const unameHtml = escapeHtml(member.username || '');
                if (isTestUser) {
                    return \`
                        <div class="member-item" style="background: #1f1f1f; border: 1px solid #3a3a3a; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; min-height: 40px;">
                            <div class="member-info" style="flex: 1; display: flex; align-items: center; gap: 10px;">
                                <span class="member-name" style="font-family: 'UsernameFont', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: bold; font-size: 14px; color: #fff;">\${unameHtml}</span>
                                <span class="member-status" style="font-size: 11px; color: #888;">\${isJoined ? 'Joined' : 'Not joined'}</span>
                            </div>
                            <div class="member-actions" style="display: flex; gap: 8px; align-items: center;">
                                <div class="toggle-switch \${isJoined ? 'active' : ''}" onclick="toggleMember('\${uid}', '\${uname}')" title="\${isJoined ? 'Joined' : 'Not joined'}" style="position: relative; width: 50px; height: 24px; background: \${isJoined ? '#4caf50' : '#444'}; border-radius: 12px; cursor: pointer; transition: background 0.3s; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);">
                                    <div style="position: absolute; top: 2px; left: \${isJoined ? '28px' : '2px'}; width: 20px; height: 20px; background: white; border-radius: 50%; transition: left 0.3s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.15);"></div>
                                </div>
                            </div>
                        </div>
                    \`;
                } else {
                    return \`
                        <div class="member-item" style="background: #1f1f1f; border: 1px solid #3a3a3a; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; min-height: 40px;">
                            <div class="member-info" style="flex: 1; display: flex; align-items: center; gap: 10px;">
                                <span class="member-name" style="font-family: 'UsernameFont', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-weight: bold; font-size: 14px; color: #fff;">\${unameHtml}</span>
                                <span class="member-status" style="font-size: 11px; color: #888;">\${isJoined ? 'Joined' : 'Not joined'}</span>
                            </div>
                            <div class="member-actions" style="display: flex; gap: 8px; align-items: center;">
                                \${isJoined ? \`<button class="btn danger" onclick="kickMember('\${uid}')" style="padding: 6px 12px; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Leave</button>\` : \`<button class="btn" onclick="toggleMember('\${uid}', '\${uname}')" style="padding: 6px 12px; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Join</button>\`}
                                <button class="btn" onclick="openMemberDashboard('\${uid}', '\${uname}')" style="padding: 6px 12px; background: #444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Dashboard</button>
                            </div>
                        </div>
                    \`;
                }
            }).join('');
        }
        
        async function toggleMember(userId, username) {
            if (!window.electronAPI) return;
            
            try {
                // Check if this is a test user
                const isTestUser = username && username.startsWith('TestUser');
                
                if (isTestUser) {
                    // Use the same logic as dashboard for test users
                    const widgetUsers = await window.electronAPI.getWidgetUsers();
                    const isInWidget = widgetUsers.find(w => {
                        const wUserId = (w.userId || '').toLowerCase();
                        const wUsername = (w.username || '').toLowerCase();
                        const checkUserId = (userId || '').toLowerCase();
                        const checkUsername = (username || '').toLowerCase();
                        return wUserId === checkUserId || wUsername === checkUsername;
                    });
                    
                    if (isInWidget) {
                        // Remove user
                        const result = await window.electronAPI.removeTestUserFromWidget(userId, username);
                        if (!result || !result.success) {
                            console.error('Failed to remove test user:', result);
                            alert('Failed to remove test user: ' + (result?.error || 'Unknown error'));
                            return;
                        }
                    } else {
                        // Add user
                        const result = await window.electronAPI.addTestUserToWidget(userId, username);
                        if (!result || !result.success) {
                            console.error('Failed to add test user:', result);
                            alert('Failed to add test user: ' + (result?.error || 'Unknown error'));
                            return;
                        }
                    }
                } else {
                    // Regular users: use join/kick
                    const isJoined = activeUsers.find(a => a.userId === userId || a.username === username);
                    if (isJoined) {
                        await window.electronAPI.kickMember(userId);
                    } else {
                        await window.electronAPI.joinMember(userId, username);
                    }
                }
                
                // Refresh after a short delay
                setTimeout(loadMembers, 200);
            } catch (e) {
                console.error('Error toggling member:', e);
                alert('Error toggling member: ' + e.message);
            }
        }
        
        async function kickMember(userId) {
            if (!window.electronAPI) return;
            if (!confirm('Remove this member from the campfire?')) return;
            
            await window.electronAPI.kickMember(userId);
            await loadMembers();
        }
        
        async function openMemberDashboard(userId, username) {
            if (!window.electronAPI) return;
            await window.electronAPI.openMemberDashboard(userId, username);
        }
        
        // Listen for member updates
        if (window.electronAPI && window.electronAPI.onPotentialMembersUpdate) {
            window.electronAPI.onPotentialMembersUpdate(() => {
                loadMembers();
            });
        }
        
        // Listen for refresh-members IPC message from main process
        if (window.electronAPI && window.electronAPI.onRefreshMembers) {
            window.electronAPI.onRefreshMembers(() => {
                loadMembers();
            });
        }
        
        // Load members on startup and refresh periodically
        loadMembers();
        setInterval(loadMembers, 2000);
    </script>
</body>
</html>
    `;

    // Write to a temporary file or use data URL
    const membersPath = path.join(__dirname, 'server', 'members-window.html');
    fs.writeFileSync(membersPath, membersHTML);

    membersWindow.loadFile(membersPath);

    if (process.env.NODE_ENV === 'development') {
        membersWindow.webContents.openDevTools();
    }

    membersWindow.on('closed', () => {
        membersWindow = null;
    });
}

// ============================================
// CHAT POPOUT WINDOW
// ============================================

function createChatPopoutWindow() {
    // Check if chat popout window already exists
    if (chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
        chatPopoutWindow.focus();
        return;
    }

    // Landscape dimensions (wider than tall)
    chatPopoutWindow = new BrowserWindow({
        width: 650,
        height: 530,
        minWidth: 400,
        minHeight: 300,
        frame: false,
        transparent: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Campfire Widget - Chat',
        backgroundColor: '#00000000' // Transparent
    });

    chatPopoutWindow.loadFile(path.join(__dirname, 'server', 'chat-popout.html'));

    chatPopoutWindow.on('closed', () => {
        chatPopoutWindow = null;
    });
    
    // ============================================
    // SNAP-TO-EDGE WINDOW GROUPING
    // ============================================
    
    // Track snap state
    chatPopoutWindow.snappedTo = null;      // 'widget-right', 'buddy-right', or null
    chatPopoutWindow.snappedFrom = null;    // 'buddy-left' or null (who snapped to us)
    chatPopoutWindow.isSnapped = false;     // Are we snapped to anyone?
    
    // When Chat moves, this fires at the end of the move
    // Note: Position sync happens in the 'moving' handler
    // We only unsnap here if the user explicitly detaches via the button
    // (Detach is handled via IPC, not via drag distance)
    chatPopoutWindow.on('move', () => {
        // No automatic unsnap on move - only explicit detach works
        // The 'moving' handler handles position sync during drag
    });
    
    // When Chat moves while snapped, move Buddy List too
    chatPopoutWindow.on('moving', () => {
        // Check if Chat is snapped TO Buddy List OR if Buddy List is snapped TO Chat
        const isSnappedToBuddy = (chatPopoutWindow.snappedTo === 'buddy-right');
        const buddySnappedToChat = (buddyListWindow?.snappedTo === 'chat-left');
        const isSnapped = isSnappedToBuddy || buddySnappedToChat;
        
        console.log(`[Snap] Chat moving - isSnapped: ${isSnapped}, snappedTo: ${chatPopoutWindow.snappedTo}, buddy.snappedTo: ${buddyListWindow?.snappedTo}`);
        
        if (isSnapped && buddyListWindow && !buddyListWindow.isDestroyed()) {
            const chatBounds = chatPopoutWindow.getBounds();
            const buddyBounds = buddyListWindow.getBounds();
            
            // Move Buddy List to be adjacent to Chat
            // Chat's left edge minus Buddy List width (no gap for clean drop shadow merge)
            const SNAP_GAP = 0;
            const targetX = chatBounds.x - SNAP_GAP - buddyBounds.width;
            const targetY = chatBounds.y;
            
            console.log(`[Snap] Moving Buddy List to x:${targetX}, y:${targetY}`);
            
            // Only move if significantly different to avoid jitter
            if (Math.abs(buddyBounds.x - targetX) > 2 || Math.abs(buddyBounds.y - targetY) > 2) {
                buddyListWindow.setPosition(targetX, targetY);
            }
        }
    });
    
    // When Chat is released (move ended), check if it should snap or unsnap from Buddy List
    chatPopoutWindow.on('moved', () => {
        if (!buddyListWindow || buddyListWindow.isDestroyed()) return;
        
        const chatBounds = chatPopoutWindow.getBounds();
        const buddyBounds = buddyListWindow.getBounds();
        
        // Check if Buddy List is to the left of Chat
        const buddyRight = buddyBounds.x + buddyBounds.width;
        const distance = chatBounds.x - buddyRight;
        
        // Snap threshold (pixels)
        const SNAP_THRESHOLD = 30;
        const Y_TOLERANCE = 50; // Allow 50 pixels Y difference for snapping (more forgiving)
        
        // If already snapped, check if user dragged it far enough to unsnap
        if (chatPopoutWindow.snappedTo === 'buddy-right') {
            // Check if dragged beyond snap threshold
            if (Math.abs(distance) > SNAP_THRESHOLD * 2 || Math.abs(chatBounds.y - buddyBounds.y) > Y_TOLERANCE) {
                // User dragged far enough - unsnap
                chatPopoutWindow.snappedTo = null;
                chatPopoutWindow.snappedFrom = null;
                buddyListWindow.snappedTo = null;
                buddyListWindow.snappedFrom = null;
                chatPopoutWindow.isSnapped = false;
                buddyListWindow.isSnapped = false;
                notifySnapStateChanged(null);
                console.log('[Snap] Chat unsnapped from Buddy List (dragged away)');
            } else {
                console.log('[Snap] Chat already snapped to Buddy List');
            }
            return;
        }
        
        // Try to snap if not already snapped
        if (Math.abs(distance) < SNAP_THRESHOLD && Math.abs(chatBounds.y - buddyBounds.y) <= Y_TOLERANCE) {
            // Snap Chat to the right edge of Buddy List
            chatPopoutWindow.setPosition(buddyRight, buddyBounds.y);
            chatPopoutWindow.snappedTo = 'buddy-right';
            chatPopoutWindow.snappedFrom = null;
            buddyListWindow.snappedTo = null;
            buddyListWindow.snappedFrom = 'chat-left';
            
            chatPopoutWindow.isSnapped = true;
            buddyListWindow.isSnapped = true;
            
            // Resize Buddy List to match Chat height
            const newChatBounds = chatPopoutWindow.getBounds();
            const newBuddyBounds = buddyListWindow.getBounds();
            buddyListWindow.setSize(newBuddyBounds.width, newChatBounds.height);
            
            // Notify renderer processes of snap state change
            notifySnapStateChanged('buddy-right');
            
            console.log('[Snap] Chat snapped to Buddy List (released)');
        } else {
            console.log('[Snap] Chat released - distance:', distance, 'yDiff:', Math.abs(chatBounds.y - buddyBounds.y));
        }
    });
    
    // ============================================
    // SYNCHRONIZED RESIZE HANDLERS
    // ============================================
    
    // When Chat resizes while snapped, sync Buddy List height
    chatPopoutWindow.on('resize', () => {
        if (!buddyListWindow || buddyListWindow.isDestroyed()) return;
        
        const isSnappedToBuddy = (chatPopoutWindow.snappedTo === 'buddy-right');
        const buddySnappedToChat = (buddyListWindow?.snappedTo === 'chat-left');
        const isSnapped = isSnappedToBuddy || buddySnappedToChat;
        
        if (isSnapped) {
            const chatBounds = chatPopoutWindow.getBounds();
            const buddyBounds = buddyListWindow.getBounds();
            
            // Sync Buddy List height to match Chat
            if (buddyBounds.height !== chatBounds.height) {
                buddyListWindow.setSize(buddyBounds.width, chatBounds.height);
                console.log(`[Snap] Synced Buddy List height to Chat: ${chatBounds.height}px`);
            }
        }
    });
    
    // When Chat is released after resize, ensure Buddy List is synced
    chatPopoutWindow.on('resized', () => {
        if (!buddyListWindow || buddyListWindow.isDestroyed()) return;
        
        const isSnappedToBuddy = (chatPopoutWindow.snappedTo === 'buddy-right');
        const buddySnappedToChat = (buddyListWindow?.snappedTo === 'chat-left');
        const isSnapped = isSnappedToBuddy || buddySnappedToChat;
        
        if (isSnapped) {
            const chatBounds = chatPopoutWindow.getBounds();
            const buddyBounds = buddyListWindow.getBounds();
            
            // Final sync of Buddy List height
            buddyListWindow.setSize(buddyBounds.width, chatBounds.height);
            console.log(`[Snap] Final sync of Buddy List height after Chat resize: ${chatBounds.height}px`);
        }
    });
    
    // When Chat closes, unsnap Buddy List
    chatPopoutWindow.on('close', () => {
        if (buddyListWindow && !buddyListWindow.isDestroyed()) {
            buddyListWindow.snappedTo = null;
            buddyListWindow.snappedFrom = null;
            buddyListWindow.isSnapped = false;
        }
    });
}

/**
 * Create the Buddy List window
 * Shows a list of users around the campfire with their states
 */
function createBuddyListWindow() {
    // Check if buddy list window already exists
    if (buddyListWindow && !buddyListWindow.isDestroyed()) {
        buddyListWindow.focus();
        return;
    }

    // Portrait dimensions (taller than wide) - AIM style buddy list
    buddyListWindow = new BrowserWindow({
        width: 280,
        height: 530,
        minWidth: 220,
        minHeight: 350,
        frame: false,
        transparent: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Campfire Widget - Buddy List',
        backgroundColor: '#00000000' // Transparent for Modern mode
    });

    buddyListWindow.loadFile(path.join(__dirname, 'server', 'buddy-list.html'));
    
    // Update windows object for IPC event forwarding
    if (typeof windows !== 'undefined' && windows) {
        windows.buddyList = buddyListWindow;
    }
    
    // Also update the userIPCHandlers windows reference if it exists
    if (typeof userIPCHandlers !== 'undefined' && userIPCHandlers) {
        userIPCHandlers.windows.buddyList = buddyListWindow;
        console.log('[BuddyList] Registered in UserIPCHandlers');
    } else {
        console.log('[BuddyList] WARNING: userIPCHandlers not available');
    }
    
    // Store original height for restore on detach
    buddyListWindow.originalHeight = 500;

    buddyListWindow.on('closed', () => {
        buddyListWindow = null;
    });
    
    // ============================================
    // SNAP-TO-EDGE WINDOW GROUPING (Buddy List)
    // ============================================
    
    // Track snap state
    buddyListWindow.snappedTo = null;      // 'chat-left' or null
    buddyListWindow.snappedFrom = null;    // 'widget-right' or null
    buddyListWindow.isSnapped = false;
    
    // When Buddy List moves, this fires at the end of the move
    // Note: Position sync happens in the 'moving' handler
    // We only unsnap here if the user explicitly detaches via the button
    // (Detach is handled via IPC, not via drag distance)
    buddyListWindow.on('move', () => {
        // No automatic unsnap on move - only explicit detach works
        // The 'moving' handler handles position sync during drag
    });
    
    // When Buddy List moves while snapped, move Chat too
    buddyListWindow.on('moving', () => {
        // Check if Buddy List is snapped TO Chat OR if Chat is snapped TO Buddy List
        const isSnappedToChat = (buddyListWindow.snappedTo === 'chat-left');
        const chatSnappedToBuddy = (chatPopoutWindow?.snappedTo === 'buddy-right');
        const isSnapped = isSnappedToChat || chatSnappedToBuddy;
        
        console.log(`[Snap] Buddy List moving - isSnapped: ${isSnapped}, snappedTo: ${buddyListWindow.snappedTo}, chat.snappedTo: ${chatPopoutWindow?.snappedTo}`);
        
        if (isSnapped && chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
            const buddyBounds = buddyListWindow.getBounds();
            const chatBounds = chatPopoutWindow.getBounds();
            
            // Move Chat to be adjacent to Buddy List
            // Buddy List's right edge (no gap for clean drop shadow merge)
            const SNAP_GAP = 0;
            const targetX = buddyBounds.x + buddyBounds.width + SNAP_GAP;
            const targetY = buddyBounds.y;
            
            console.log(`[Snap] Moving Chat to x:${targetX}, y:${targetY}`);
            
            // Only move if significantly different to avoid jitter
            if (Math.abs(chatBounds.x - targetX) > 2 || Math.abs(chatBounds.y - targetY) > 2) {
                chatPopoutWindow.setPosition(targetX, targetY);
            }
        }
    });
    
    // When Buddy List is released (move ended), check if it should snap or unsnap from Chat
    buddyListWindow.on('moved', () => {
        if (!chatPopoutWindow || chatPopoutWindow.isDestroyed()) return;
        
        const buddyBounds = buddyListWindow.getBounds();
        const chatBounds = chatPopoutWindow.getBounds();
        
        // Check if Chat is to the right of Buddy List
        const buddyRight = buddyBounds.x + buddyBounds.width;
        const distance = chatBounds.x - buddyRight;
        
        // Snap threshold (pixels)
        const SNAP_THRESHOLD = 30;
        const Y_TOLERANCE = 50; // Allow 50 pixels Y difference for snapping (more forgiving)
        
        // If already snapped, check if user dragged it far enough to unsnap
        if (buddyListWindow.snappedTo === 'chat-left') {
            // Check if dragged beyond snap threshold
            if (Math.abs(distance) > SNAP_THRESHOLD * 2 || Math.abs(buddyBounds.y - chatBounds.y) > Y_TOLERANCE) {
                // User dragged far enough - unsnap
                buddyListWindow.snappedTo = null;
                buddyListWindow.snappedFrom = null;
                chatPopoutWindow.snappedTo = null;
                chatPopoutWindow.snappedFrom = null;
                buddyListWindow.isSnapped = false;
                chatPopoutWindow.isSnapped = false;
                notifySnapStateChanged(null);
                console.log('[Snap] Buddy List unsnapped from Chat (dragged away)');
            } else {
                console.log('[Snap] Buddy List already snapped to Chat');
            }
            return;
        }
        
        // Try to snap if not already snapped
        if (Math.abs(distance) < SNAP_THRESHOLD && Math.abs(buddyBounds.y - chatBounds.y) <= Y_TOLERANCE) {
            // Snap Buddy List to the left edge of Chat
            buddyListWindow.setPosition(chatBounds.x - buddyBounds.width, chatBounds.y);
            buddyListWindow.snappedTo = 'chat-left';
            buddyListWindow.snappedFrom = null;
            chatPopoutWindow.snappedTo = null;
            chatPopoutWindow.snappedFrom = 'buddy-right';
            
            buddyListWindow.isSnapped = true;
            chatPopoutWindow.isSnapped = true;
            
            // Resize Buddy List to match Chat height
            const newChatBounds = chatPopoutWindow.getBounds();
            buddyListWindow.setSize(buddyBounds.width, newChatBounds.height);
            
            // Notify renderer processes of snap state change
            notifySnapStateChanged('chat-left');
            
            console.log('[Snap] Buddy List snapped to Chat (released)');
        } else {
            console.log('[Snap] Buddy List released - distance:', distance, 'yDiff:', Math.abs(buddyBounds.y - chatBounds.y));
        }
    });
    
    // ============================================
    // SYNCHRONIZED RESIZE HANDLERS (Buddy List)
    // ============================================
    
    // When Buddy List resizes while snapped, sync Chat height
    buddyListWindow.on('resize', () => {
        if (!chatPopoutWindow || chatPopoutWindow.isDestroyed()) return;
        
        const isSnappedToChat = (buddyListWindow.snappedTo === 'chat-left');
        const chatSnappedToBuddy = (chatPopoutWindow?.snappedTo === 'buddy-right');
        const isSnapped = isSnappedToChat || chatSnappedToBuddy;
        
        if (isSnapped) {
            const buddyBounds = buddyListWindow.getBounds();
            const chatBounds = chatPopoutWindow.getBounds();
            
            // Sync Chat height to match Buddy List
            if (chatBounds.height !== buddyBounds.height) {
                chatPopoutWindow.setSize(chatBounds.width, buddyBounds.height);
                console.log(`[Snap] Synced Chat height to Buddy List: ${buddyBounds.height}px`);
            }
        }
    });
    
    // When Buddy List is released after resize, ensure Chat is synced
    buddyListWindow.on('resized', () => {
        if (!chatPopoutWindow || chatPopoutWindow.isDestroyed()) return;
        
        const isSnappedToChat = (buddyListWindow.snappedTo === 'chat-left');
        const chatSnappedToBuddy = (chatPopoutWindow?.snappedTo === 'buddy-right');
        const isSnapped = isSnappedToChat || chatSnappedToBuddy;
        
        if (isSnapped) {
            const buddyBounds = buddyListWindow.getBounds();
            const chatBounds = chatPopoutWindow.getBounds();
            
            // Final sync of Chat height
            chatPopoutWindow.setSize(chatBounds.width, buddyBounds.height);
            console.log(`[Snap] Final sync of Chat height after Buddy List resize: ${buddyBounds.height}px`);
        }
    });
    
    // When Buddy List closes, unsnap Chat
    buddyListWindow.on('close', () => {
        if (chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
            chatPopoutWindow.snappedTo = null;
            chatPopoutWindow.snappedFrom = null;
            chatPopoutWindow.isSnapped = false;
        }
    });

    // Log successful creation
    console.log('[Main] Buddy List window created');
}

// ============================================
// TWITCH CLIENT (Main Process)
// ============================================

let twitchConfig = {
    botUsername: '',
    oauthToken: '',
    channelName: ''
};

function loadTwitchConfig() {
    const configPath = path.join(userDataPath, 'twitch-config.json');
    try {
        if (fs.existsSync(configPath)) {
            const rawConfig = fs.readFileSync(configPath, 'utf8');
            twitchConfig = JSON.parse(rawConfig);
            console.log('[Twitch] Loaded config:', {
                botUsername: twitchConfig.botUsername ? '***' : '(empty)',
                channelName: twitchConfig.channelName || '(empty)',
                hasOauthToken: !!(twitchConfig.oauthToken || twitchConfig.accessToken),
                hasChatBotUsername: !!twitchConfig.chatBotUsername,
                hasChatBotToken: !!twitchConfig.chatBotAccessToken,
                streamerUserId: twitchConfig.streamerUserId || '(not fetched)',
                botUserId: twitchConfig.botUserId || '(not fetched)'
            });
        } else {
            console.log('[Twitch] No config file found at:', configPath);
        }
    } catch (e) {
        console.error('[Twitch] Error loading config:', e);
    }
}

function saveTwitchConfig() {
    const configPath = path.join(userDataPath, 'twitch-config.json');
    try {
        fs.writeFileSync(configPath, JSON.stringify(twitchConfig, null, 2));
    } catch (e) {
        console.error('Error saving Twitch config:', e);
    }
}

function initializeStreamerBotChatters() {
    try {
        // Get streamer and bot usernames from config
        const streamerUsername = (twitchConfig.channelName || '').toLowerCase().trim();
        const botUsername = (twitchConfig.chatBotUsername || '').toLowerCase().trim();

        // Add streamer to chatters if configured
        // Use stored Twitch ID if available (from previous connection)
        if (streamerUsername) {
            const existing = allChatters.get(streamerUsername);
            // Use stored streamerUserId if available, otherwise preserve existing or null
            const storedStreamerId = twitchConfig.streamerUserId ? String(twitchConfig.streamerUserId) : null;
            const existingUserId = existing?.userId && existing.userId !== streamerUsername ? existing.userId : null;
            const userId = storedStreamerId || existingUserId || null;
            
            // Only update if we have new info or entry doesn't exist
            if (!existing || !existing.userId || existing.userId === streamerUsername || (storedStreamerId && existing.userId !== storedStreamerId)) {
                allChatters.set(streamerUsername, {
                    ...(existing || {}),
                    username: streamerUsername,
                    userId: userId,
                    isBroadcaster: true,
                    isMod: true,
                    isBot: false,
                    joinedAt: existing?.joinedAt || Date.now(),
                    pendingRealUserId: !userId // Only pending if we don't have a real userId
                });
                if (userId) {
                    console.log(`[Main] Added streamer ${streamerUsername} to chatters with Twitch ID: ${userId}`);
                } else {
                    console.log(`[Main] Added streamer ${streamerUsername} to chatters (pending real userId)`);
                }
            }
        }

        // Add bot to chatters if different from streamer
        if (botUsername && botUsername !== streamerUsername) {
            const existing = allChatters.get(botUsername);
            // Use stored botUserId if available
            const storedBotId = twitchConfig.botUserId ? String(twitchConfig.botUserId) : null;
            const existingUserId = existing?.userId && existing.userId !== botUsername ? existing.userId : null;
            const userId = storedBotId || existingUserId || null;
            
            if (!existing || !existing.userId || existing.userId === botUsername || (storedBotId && existing.userId !== storedBotId)) {
                allChatters.set(botUsername, {
                    ...(existing || {}),
                    username: botUsername,
                    userId: userId,
                    isBroadcaster: false,
                    isMod: true,
                    isBot: true, // This IS the configured bot account
                    joinedAt: existing?.joinedAt || Date.now(),
                    pendingRealUserId: !userId
                });
                if (userId) {
                    console.log(`[Main] Added bot ${botUsername} to chatters with Twitch ID: ${userId}`);
                } else {
                    console.log(`[Main] Added bot ${botUsername} to chatters (pending real userId)`);
                }
            }
        }

        // Notify dashboard that chatters have been updated
        updatePotentialMembersList();
    } catch (e) {
        console.warn('[Main] Error initializing streamer/bot chatters:', e);
    }
}

function sendThirdPartyEmotesUpdate() {
    const payload = thirdPartyEmotesCache || { channel: null, emotes: {}, updatedAt: Date.now() };
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('thirdPartyEmotesUpdate', payload);
    }
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('thirdPartyEmotesUpdate', payload);
    }
    if (membersWindow && !membersWindow.isDestroyed()) {
        membersWindow.webContents.send('thirdPartyEmotesUpdate', payload);
    }
}

function getHelixAuth() {
    const rawToken = (twitchConfig.accessToken || twitchConfig.oauthToken || '').replace(/^oauth:/, '').trim();
    const clientId = (twitchConfig.clientId || twitchConfig.mainClientId || twitchConfig.botClientId || '').trim();
    if (!rawToken || !clientId) return null;
    return { token: rawToken, clientId };
}

async function getClientIdFromToken() {
    const rawToken = (twitchConfig.accessToken || twitchConfig.oauthToken || '').replace(/^oauth:/, '').trim();
    if (!rawToken) return null;
    const json = await fetchJson('https://id.twitch.tv/oauth2/validate', {
        headers: { 'Authorization': `OAuth ${rawToken}` }
    });
    const cid = json && json.client_id ? String(json.client_id) : null;
    if (cid && twitchConfig.clientId !== cid) {
        twitchConfig.clientId = cid;
        saveTwitchConfig();
    }
    return cid;
}

async function getHelixAuthAsync() {
    const rawToken = (twitchConfig.accessToken || twitchConfig.oauthToken || '').replace(/^oauth:/, '').trim();
    if (!rawToken) return null;
    let clientId = (twitchConfig.clientId || twitchConfig.mainClientId || twitchConfig.botClientId || '').trim();
    if (!clientId) clientId = (await getClientIdFromToken()) || '';
    if (!clientId) return null;
    return { token: rawToken, clientId };
}

async function fetchJson(url, opts = {}) {
    return await new Promise((resolve) => {
        try {
            const u = new URL(String(url));
            const headers = { ...(opts.headers || {}) };
            // Avoid compressed responses so we don't need a decompressor here
            if (!headers['Accept-Encoding'] && !headers['accept-encoding']) headers['Accept-Encoding'] = 'identity';

            const req = https.request(
                {
                    protocol: u.protocol,
                    hostname: u.hostname,
                    port: u.port || 443,
                    path: u.pathname + u.search,
                    method: (opts.method || 'GET'),
                    headers
                },
                (res) => {
                    const status = res.statusCode || 0;
                    if (status < 200 || status >= 300) {
                        res.resume();
                        return resolve(null);
                    }
                    let body = '';
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => { body += chunk; });
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(body));
                        } catch (e) {
                            resolve(null);
                        }
                    });
                }
            );
            req.on('error', () => resolve(null));
            req.end();
        } catch (e) {
            resolve(null);
        }
    });
}

async function getTwitchUserIdByLogin(login) {
    const auth = await getHelixAuthAsync();
    if (!auth) return null;
    const url = `https://api.twitch.tv/helix/users?login=${encodeURIComponent(String(login || '').replace(/^#/, '').toLowerCase())}`;
    const json = await fetchJson(url, {
        headers: {
            'Client-ID': auth.clientId,
            'Authorization': `Bearer ${auth.token}`
        }
    });
    const id = json && json.data && json.data[0] && json.data[0].id;
    return id ? String(id) : null;
}

/**
 * Fetch a user's chat color from Twitch Helix API
 * Requires user:read:chat scope
 * @param {string} userId - The Twitch user ID
 * @returns {Promise<string|null>} Hex color string (e.g., '#FF0000') or null
 */
async function fetchUserChatColor(userId) {
    if (!userId) return null;
    
    const auth = await getHelixAuthAsync();
    if (!auth) {
        console.warn('[fetchUserChatColor] No Helix auth available');
        return null;
    }
    
    try {
        const url = `https://api.twitch.tv/helix/chat/color?user_id=${encodeURIComponent(userId)}`;
        const json = await fetchJson(url, {
            headers: {
                'Client-ID': auth.clientId,
                'Authorization': `Bearer ${auth.token}`
            }
        });
        
        if (json && json.data && json.data[0] && json.data[0].color) {
            const color = json.data[0].color;
            console.log(`[fetchUserChatColor] User ${userId} has chat color: ${color}`);
            return color;
        }
        
        return null;
    } catch (e) {
        console.error(`[fetchUserChatColor] Error fetching color for user ${userId}:`, e);
        return null;
    }
}

/**
 * Fetch and store real Twitch IDs and chat colors for streamer and bot accounts.
 * This eliminates the need for placeholder IDs like "streamer" and "bot".
 * Called when Twitch connection is established.
 */
async function fetchAndStoreRealTwitchIds() {
    const streamerUsername = twitchConfig.channelName || twitchConfig.botUsername;
    const botUsername = twitchConfig.chatBotUsername;
    
    console.log('[Twitch IDs] Fetching real Twitch IDs and chat colors for streamer and bot...');
    
    // Fetch streamer's real Twitch ID and chat color
    if (streamerUsername) {
        try {
            const streamerId = await getTwitchUserIdByLogin(streamerUsername);
            if (streamerId) {
                twitchConfig.streamerUserId = streamerId;
                console.log(`[Twitch IDs] Streamer ${streamerUsername} has Twitch ID: ${streamerId}`);
                
                // Fetch and store streamer's chat color
                const streamerColor = await fetchUserChatColor(streamerId);
                if (streamerColor) {
                    twitchConfig.streamerChatColor = streamerColor;
                    console.log(`[Twitch IDs] Streamer ${streamerUsername} has chat color: ${streamerColor}`);
                }
                
                // Update allChatters with real ID and color
                const chatterEntry = allChatters.get(streamerUsername.toLowerCase());
                if (chatterEntry) {
                    chatterEntry.userId = streamerId;
                    if (streamerColor) chatterEntry.color = streamerColor;
                    allChatters.set(streamerUsername.toLowerCase(), chatterEntry);
                }
                
                saveTwitchConfig();
            } else {
                console.warn(`[Twitch IDs] Could not fetch Twitch ID for streamer: ${streamerUsername}`);
            }
        } catch (e) {
            console.error(`[Twitch IDs] Error fetching streamer ID:`, e);
        }
    }
    
    // Fetch bot's real Twitch ID and chat color (if different from streamer)
    if (botUsername && botUsername.toLowerCase() !== (streamerUsername || '').toLowerCase()) {
        try {
            const botId = await getTwitchUserIdByLogin(botUsername);
            if (botId) {
                twitchConfig.botUserId = botId;
                console.log(`[Twitch IDs] Bot ${botUsername} has Twitch ID: ${botId}`);
                
                // Fetch and store bot's chat color
                const botColor = await fetchUserChatColor(botId);
                if (botColor) {
                    twitchConfig.botChatColor = botColor;
                    console.log(`[Twitch IDs] Bot ${botUsername} has chat color: ${botColor}`);
                }
                
                // Update allChatters with real ID and color
                const chatterEntry = allChatters.get(botUsername.toLowerCase());
                if (chatterEntry) {
                    chatterEntry.userId = botId;
                    if (botColor) chatterEntry.color = botColor;
                    allChatters.set(botUsername.toLowerCase(), chatterEntry);
                }
                
                saveTwitchConfig();
            } else {
                console.warn(`[Twitch IDs] Could not fetch Twitch ID for bot: ${botUsername}`);
            }
        } catch (e) {
            console.error(`[Twitch IDs] Error fetching bot ID:`, e);
        }
    }
    
    // Update potential members list with real IDs
    updatePotentialMembersList();
}

/**
 * Get the real Twitch ID for the streamer (from config or fetch)
 */
function getStreamerTwitchId() {
    return twitchConfig.streamerUserId || null;
}

/**
 * Get the real Twitch ID for the bot (from config or fetch)
 */
function getBotTwitchId() {
    return twitchConfig.botUserId || null;
}

// Fetch current chatters from Twitch Helix API
// Requires moderator:read:chatters scope
async function fetchTwitchChatters(broadcasterId, moderatorId) {
    const auth = await getHelixAuthAsync();
    if (!auth) {
        console.log('[fetchTwitchChatters] No auth available');
        return { success: false, error: 'No authentication available' };
    }
    
    if (!broadcasterId || !moderatorId) {
        console.log('[fetchTwitchChatters] Missing broadcaster or moderator ID');
        return { success: false, error: 'Missing broadcaster or moderator ID' };
    }
    
    try {
        const url = `https://api.twitch.tv/helix/chat/chatters?broadcaster_id=${encodeURIComponent(broadcasterId)}&moderator_id=${encodeURIComponent(moderatorId)}&first=1000`;
        const json = await fetchJson(url, {
            headers: {
                'Client-ID': auth.clientId,
                'Authorization': `Bearer ${auth.token}`
            }
        });
        
        if (!json) {
            console.log('[fetchTwitchChatters] API returned null/empty response');
            return { success: false, error: 'API request failed' };
        }
        
        if (json.error) {
            console.log('[fetchTwitchChatters] API error:', json.error, json.message);
            return { success: false, error: json.message || json.error };
        }
        
        const chatters = (json.data || []).map(c => ({
            username: c.user_login || c.user_name,
            userId: c.user_id,
            displayName: c.user_name
        }));
        
        console.log(`[fetchTwitchChatters] Fetched ${chatters.length} chatters from API`);
        return { success: true, chatters };
    } catch (e) {
        console.error('[fetchTwitchChatters] Error:', e);
        return { success: false, error: e.message };
    }
}

// Refresh chatters list from Twitch API and merge with existing data
async function refreshChattersFromAPI() {
    const channelName = (twitchConfig.channelName || '').replace(/^#/, '').toLowerCase();
    if (!channelName) {
        return { success: false, error: 'No channel configured' };
    }
    
    // Get broadcaster ID
    const broadcasterId = await getTwitchUserIdByLogin(channelName);
    if (!broadcasterId) {
        return { success: false, error: 'Could not get broadcaster ID' };
    }
    
    // For moderator ID, we use the authenticated user (main account)
    // The main account should be the broadcaster or a moderator
    const mainUsername = (twitchConfig.username || twitchConfig.botUsername || '').toLowerCase();
    const moderatorId = mainUsername ? await getTwitchUserIdByLogin(mainUsername) : broadcasterId;
    
    if (!moderatorId) {
        return { success: false, error: 'Could not get moderator ID' };
    }
    
    const result = await fetchTwitchChatters(broadcasterId, moderatorId);
    
    if (result.success && result.chatters) {
        // Merge fetched chatters with existing allChatters map
        const now = Date.now();
        let newCount = 0;
        let updatedCount = 0;
        
        for (const chatter of result.chatters) {
            const key = chatter.username.toLowerCase();
            const existing = allChatters.get(key);
            
            if (existing) {
                // Update existing entry with fresh data
                existing.userId = chatter.userId || existing.userId;
                existing.displayName = chatter.displayName || existing.displayName;
                existing.lastSeen = now;
                updatedCount++;
            } else {
                // Add new chatter
                allChatters.set(key, {
                    username: chatter.username,
                    userId: chatter.userId,
                    displayName: chatter.displayName,
                    joinedAt: now,
                    lastSeen: now
                });
                newCount++;
            }
        }
        
        console.log(`[refreshChattersFromAPI] Added ${newCount} new, updated ${updatedCount} existing chatters`);
        updatePotentialMembersList();
        
        return {
            success: true,
            total: result.chatters.length,
            newCount,
            updatedCount
        };
    }
    
    return result;
}

function asHttps(u) {
    if (!u) return null;
    const s = String(u);
    if (s.startsWith('https://')) return s;
    if (s.startsWith('http://')) return s;
    if (s.startsWith('//')) return 'https:' + s;
    return null;
}

async function fetchBTTVEmotes(twitchUserId) {
    const out = {};
    const add = (code, id) => {
        if (!code || !id) return;
        out[String(code)] = `https://cdn.betterttv.net/emote/${String(id)}/2x`;
    };
    const global = await fetchJson('https://api.betterttv.net/3/cached/emotes/global');
    if (Array.isArray(global)) {
        global.forEach(e => add(e.code, e.id));
    }
    if (twitchUserId) {
        const user = await fetchJson(`https://api.betterttv.net/3/cached/users/twitch/${encodeURIComponent(String(twitchUserId))}`);
        if (user) {
            (user.channelEmotes || []).forEach(e => add(e.code, e.id));
            (user.sharedEmotes || []).forEach(e => add(e.code, e.id));
        }
    }
    return out;
}

async function fetchFFZEmotes(channelLogin) {
    const out = {};
    const login = String(channelLogin || '').replace(/^#/, '').toLowerCase();
    if (!login) return out;
    const json = await fetchJson(`https://api.frankerfacez.com/v1/room/${encodeURIComponent(login)}`);
    if (!json || !json.sets || !json.room) return out;
    const setId = json.room.set;
    const set = json.sets[String(setId)];
    const emoticons = (set && set.emoticons) || [];
    emoticons.forEach(e => {
        const code = e && e.name;
        const urls = e && e.urls;
        if (!code || !urls) return;
        // prefer 2x, then 4x, then 1x
        const u = urls['2'] || urls['4'] || urls['1'];
        const https = asHttps(u);
        if (https) out[String(code)] = https;
    });
    return out;
}

async function fetch7TVEmotes(twitchUserId) {
    const out = {};
    if (!twitchUserId) return out;
    const json = await fetchJson(`https://7tv.io/v3/users/twitch/${encodeURIComponent(String(twitchUserId))}`);
    const emotes = (json && json.emote_set && Array.isArray(json.emote_set.emotes)) ? json.emote_set.emotes : [];
    emotes.forEach(e => {
        const code = e && e.name;
        const hostObj = (e && e.host) || (e && e.data && e.data.host) || null;
        const base = asHttps((hostObj && hostObj.url) || e?.host_url || null);
        if (!code || !base) return;
        const files = (hostObj && Array.isArray(hostObj.files) && hostObj.files) ? hostObj.files : [];
        const best =
            files.find(f => f && f.name === '2x.webp') ||
            files.find(f => f && f.name === '2x.png') ||
            files.find(f => f && f.name === '2x.avif') ||
            files.find(f => f && String(f.name || '').startsWith('2x.')) ||
            files.find(f => f && f.name === '1x.webp') ||
            files.find(f => f && String(f.name || '').startsWith('1x.')) ||
            null;
        if (best && best.name) out[String(code)] = `${base}/${String(best.name)}`;
    });
    return out;
}

async function refreshThirdPartyEmotes(channelLogin, roomId = null) {
    const login = String(channelLogin || '').replace(/^#/, '').toLowerCase();
    if (!login) return;
    if (thirdPartyEmotesInFlight) return thirdPartyEmotesInFlight;
    thirdPartyEmotesInFlight = (async () => {
        const twitchUserId = roomId ? String(roomId) : await getTwitchUserIdByLogin(login);
        // Merge order: global → ffz → bttv user → 7tv user (user-specific wins)
        const [bttv, ffz, seven] = await Promise.all([
            fetchBTTVEmotes(twitchUserId),
            fetchFFZEmotes(login),
            fetch7TVEmotes(twitchUserId)
        ]);
        const merged = { ...bttv, ...ffz, ...seven };
        thirdPartyEmotesCache = { channel: login, emotes: merged, updatedAt: Date.now() };
        try {
            console.log(`[Emotes] Loaded for #${login}: BTTV=${Object.keys(bttv).length} FFZ=${Object.keys(ffz).length} 7TV=${Object.keys(seven).length} total=${Object.keys(merged).length}`);
        } catch (e) { /* ignore */ }
        sendThirdPartyEmotesUpdate();
        return merged;
    })().finally(() => {
        thirdPartyEmotesInFlight = null;
    });
    return thirdPartyEmotesInFlight;
}

function connectTwitch() {
    console.log('[Twitch] connectTwitch() called');
    
    if (twitchClient) {
        console.log('[Twitch] Disconnecting existing client');
        twitchClient.disconnect();
        twitchClient = null;
    }
    if (twitchChatClient) {
        try { twitchChatClient.disconnect(); } catch (e) { /* ignore */ }
        twitchChatClient = null;
        isTwitchChatConnected = false;
        lastSeparateChatBotUsername = null;
    }

    const token = twitchConfig.oauthToken || twitchConfig.accessToken || '';
    console.log('[Twitch] Checking credentials:', {
        hasBotUsername: !!twitchConfig.botUsername,
        hasToken: !!token,
        hasChannelName: !!twitchConfig.channelName
    });
    
    if (!twitchConfig.botUsername || !token || !twitchConfig.channelName) {
        console.log('⚠️  Twitch credentials not configured - missing:', {
            botUsername: !twitchConfig.botUsername ? 'MISSING' : 'OK',
            token: !token ? 'MISSING' : 'OK',
            channelName: !twitchConfig.channelName ? 'MISSING' : 'OK'
        });
        return;
    }

    const oauth = token.startsWith('oauth:') ? token : 'oauth:' + token;

    const ch = (twitchConfig.channelName || '').trim();
    if (!ch) {
        console.log('⚠️  No channel name configured');
        return;
    }
    const chWithHash = ch.startsWith('#') ? ch : '#' + ch;
    twitchChannelRoomId = null;

    twitchClient = new tmi.Client({
        options: { debug: false },
        connection: {
            reconnect: true,
            secure: true
        },
        identity: {
            username: twitchConfig.botUsername,
            password: oauth
        },
        channels: [chWithHash]
    });

    // Optional: separate bot for sending messages (chat bot account)
    const chatBotUsername = (twitchConfig.chatBotUsername || '').trim();
    const chatBotTokenRaw = (twitchConfig.chatBotAccessToken || '').trim();
    const useSeparateChatBot =
        !!chatBotUsername &&
        !!chatBotTokenRaw &&
        chatBotUsername.toLowerCase() !== String(twitchConfig.botUsername || '').toLowerCase();

    if (useSeparateChatBot) {
        lastSeparateChatBotUsername = chatBotUsername;
        const chatOauth = chatBotTokenRaw.startsWith('oauth:') ? chatBotTokenRaw : 'oauth:' + chatBotTokenRaw;
        twitchChatClient = new tmi.Client({
            options: { debug: false },
            connection: { reconnect: true, secure: true },
            identity: { username: chatBotUsername, password: chatOauth },
            channels: [chWithHash]
        });

        twitchChatClient.on('connected', () => {
            isTwitchChatConnected = true;
            console.log(`🤖 Chat bot connected: ${chatBotUsername}`);
            if (dashboardWindow && !dashboardWindow.isDestroyed()) {
                dashboardWindow.webContents.send('twitchChatBotConnected', { connected: true, username: chatBotUsername });
            }
        });
        twitchChatClient.on('disconnected', () => {
            isTwitchChatConnected = false;
            console.log('🤖 Chat bot disconnected');
            if (dashboardWindow && !dashboardWindow.isDestroyed()) {
                dashboardWindow.webContents.send('twitchChatBotDisconnected', { connected: false, username: chatBotUsername });
            }
        });
        twitchChatClient.connect().catch(() => {
            isTwitchChatConnected = false;
        });
    } else {
        lastSeparateChatBotUsername = null;
    }

    const sendToDashboard = (ev, data) => {
        if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.webContents.send(ev, data);
    };

    // Event handlers
    twitchClient.on('connected', (addr, port) => {
        console.log(`✅ Connected to Twitch IRC: ${addr}:${port}`);
        console.log(`📺 Monitoring channel: ${chWithHash}`);
        isTwitchConnected = true;
        broadcastToWidget('twitchConnected', { connected: true });
        sendToDashboard('twitchConnected', { connected: true });
        // Load third-party emotes (BTTV/FFZ/7TV) for the connected channel
        refreshThirdPartyEmotes(chWithHash).catch(() => {});
        
        // Fetch and store real Twitch IDs for streamer and bot
        // This eliminates placeholder IDs and ensures PopOut Chat uses same identity as Twitch Chat
        fetchAndStoreRealTwitchIds().then(async () => {
            // After fetching real IDs, refresh chatters list from Twitch API
            // This populates the members list on startup
            console.log('[Twitch] Fetching chatters list from API...');
            await refreshChattersFromAPI().catch(e => {
                console.warn('[Twitch] Could not fetch chatters from API:', e.message);
            });
            
            // Periodic chatters refresh to detect users who are in chat without typing
            // Runs every 60 seconds (Twitch API rate limit is 1 request/minute)
            setInterval(() => {
                if (twitchConfig.channelName) {
                    refreshChattersFromAPI().catch(e => {
                        // Silent fail for periodic updates
                    });
                }
            }, 60000);
            
            // Auto-join streamer and bot accounts (main process - works even if widget fails to initialize)
            // This is the primary auto-join, independent of widget state
            if (!hasAutoJoinedStreamerBot && twitchConfig.streamerUserId && twitchConfig.botUserId) {
                hasAutoJoinedStreamerBot = true;
                console.log('[Main] Auto-joining streamer and bot accounts...');
                
                // Join streamer
                const streamerUsername = (twitchConfig.channelName || '').replace(/^#/, '');
                if (streamerUsername && twitchConfig.streamerUserId) {
                    console.log(`[Main] Auto-joining streamer: ${streamerUsername} (${twitchConfig.streamerUserId})`);
                    await handleJoinCommand(streamerUsername, twitchConfig.streamerUserId, {
                        'user-id': twitchConfig.streamerUserId,
                        'username': streamerUsername.toLowerCase(),
                        'display-name': streamerUsername,
                        'color': twitchConfig.streamerChatColor || null,
                        'mod': '0',
                        'badges': ''
                    });
                }
                
                // Join bot (if different from streamer)
                const botUsername = (twitchConfig.chatBotUsername || '').trim();
                if (botUsername && botUsername.toLowerCase() !== streamerUsername.toLowerCase() && twitchConfig.botUserId) {
                    console.log(`[Main] Auto-joining bot: ${botUsername} (${twitchConfig.botUserId})`);
                    await handleJoinCommand(botUsername, twitchConfig.botUserId, {
                        'user-id': twitchConfig.botUserId,
                        'username': botUsername.toLowerCase(),
                        'display-name': botUsername,
                        'color': twitchConfig.botChatColor || null,
                        'mod': '0',
                        'badges': ''
                    });
                }
                
                console.log('[Main] Auto-join complete for streamer and bot');
            }
        }).catch(e => {
            console.error('[Twitch IDs] Error fetching real Twitch IDs:', e);
        });
    });

    // Capture the channel room-id ASAP (no need to wait for a user message)
    twitchClient.on('roomstate', (channel, state) => {
        const roomId = state && (state['room-id'] || state.roomId);
        if (roomId && !twitchChannelRoomId) {
            twitchChannelRoomId = String(roomId);
            refreshThirdPartyEmotes(chWithHash, twitchChannelRoomId).catch(() => {});
        }
    });

    twitchClient.on('disconnected', (reason) => {
        console.log(`❌ Disconnected from Twitch: ${reason}`);
        isTwitchConnected = false;
        broadcastToWidget('twitchDisconnected', { connected: false });
        sendToDashboard('twitchDisconnected', { connected: false, reason });
    });

    twitchClient.on('join', (channel, username, self) => {
        if (self) {
            console.log(`✅ Joined channel: ${channel}`);
        } else {
            const existing = allChatters.get(username.toLowerCase());
            allChatters.set(username.toLowerCase(), { ...(existing || {}), username, joinedAt: Date.now() });
            updatePotentialMembersList();
        }
    });

    twitchClient.on('part', (channel, username) => {
        allChatters.delete(username.toLowerCase());
        updatePotentialMembersList();
    });

    twitchClient.on('message', async (channel, tags, message, self) => {

        const username = tags['display-name'] || tags.username;
        const userId = tags['user-id'];
        const roomId = tags['room-id'];
        // If this is the first time we learn the channel room-id, refresh 3rd-party emotes
        // before forwarding the chat message so emote codes can render immediately.
        let emoteRefreshPromise = null;
        if (roomId && !twitchChannelRoomId) {
            twitchChannelRoomId = String(roomId);
            emoteRefreshPromise = refreshThirdPartyEmotes(chWithHash, twitchChannelRoomId);
        }
        const rawColor = tags.color || null;
        let hexColor = null;
        if (rawColor) {
            const r = String(rawColor).replace(/^#/, '').trim();
            if (/^[0-9A-Fa-f]{6}$/.test(r)) hexColor = '#' + r;
        }
        const existing = allChatters.get(username.toLowerCase());
        const tagsSnapshot = {
            badges: tags && tags.badges,
            subscriber: tags && tags.subscriber,
            mod: tags && tags.mod
        };
        allChatters.set(username.toLowerCase(), {
            ...(existing || {}),
            username,
            userId,
            color: hexColor || existing?.color,
            lastMessage: Date.now(),
            tags: tagsSnapshot
        });
        updatePotentialMembersList();

        // Broadcast real Twitch username color to widget when we have a valid hex
        if (hexColor) {
            // Use userManager if available, fall back to activeUsers
            let u = null;
            if (userManager && userId) {
                u = userManager.getUser(userId);
            }
            if (!u && userId) {
                u = activeUsers.get(userId);
            }
            if (!u && username) {
                // Search by username
                if (userManager) {
                    u = userManager.getUserByUsername(username);
                }
                if (!u) {
                    for (const [, v] of activeUsers) {
                        if (v.username && String(v.username).toLowerCase() === String(username).toLowerCase()) { u = v; break; }
                    }
                }
            }
            if (u && u.twitchColor !== hexColor) {
                u.twitchColor = hexColor;
                // Update in userManager if available
                if (userManager && u.userId) {
                    userManager.updateUser(u.userId, { twitchColor: hexColor });
                }
                broadcastToWidget('viewerTwitchColorUpdate', { userId: u.userId, color: hexColor });
            }
        }

        if (emoteRefreshPromise) {
            try { await emoteRefreshPromise; } catch (e) { /* ignore */ }
        }

        // Send to widget for text bubbles above joined users (emotes for rendering Twitch emote images)
        // IMPORTANT: do not show any command-like messages (anything starting with "!") as chat bubbles.
        const trimmed = String(message || '').trim();
        const isCommandLike = trimmed.startsWith('!');
        const settings = loadSettings();
        const allowBubble = shouldAllowChatBubble(tags, settings);
        const senderLogin = String(tags && tags.username ? tags.username : username || '').toLowerCase();
        const mainLogin = String(twitchConfig.botUsername || '').toLowerCase();
        const chatLogin = String(twitchConfig.chatBotUsername || '').toLowerCase();

        // Treat the separate chat-bot account as the "system sender" for bubble suppression.
        // But still allow it to issue commands (so it can be used for moderation/testing).
        const isChatBotSender = !!senderLogin && !!chatLogin && (senderLogin === chatLogin);

        // Ignore echoed messages only when they come from the connected IRC identity (self=true)
        // AND are not from a real user we want to allow (main account should be allowed).
        if (self && senderLogin !== mainLogin) {
            return;
        }

        // Record activity for campers (triggers auto-return from SLEEPY/AFK state)
        // Only for non-command messages to avoid double-triggering with command handlers
        if (userManager && userId && !isCommandLike) {
            userManager.recordActivity(userId);
        }

        // Suppress ALL messages from the chat bot account from showing as chat bubbles.
        // The bot account is used for system responses (join, leave, commands, etc.)
        // and should never show chat bubbles above sprites - only in the popout chat.
        // This is simpler and more robust than pattern-matching individual messages.
        const suppressBubble = isChatBotSender;

        // Check if this is an action message (/me)
        const isAction = tags['message-type'] === 'action';
        
        // Check if this is a command that should be silenced in popout chat
        let shouldShowInPopout = true;
        if (isCommandLike && botMessagesCache) {
            const matchedCmd = botMessagesCache.find(cmd =>
                cmd.enabled &&
                cmd.commands.some(c => trimmed.toLowerCase() === c || trimmed.toLowerCase().startsWith(c + ' '))
            );
            if (matchedCmd && matchedCmd.silent) {
                shouldShowInPopout = false;
            }
        }
        
        // Send to widget for chat bubbles (only non-commands)
        // Pass shouldShowInPopout flag to control popout chat display
        if (!isCommandLike && allowBubble && !suppressBubble) {
            broadcastToWidget('chatMessage', {
                username,
                message,
                userId,
                emotes: tags.emotes || null,
                allowBubble: true,
                isAction,
                displayName: tags['display-name'] || tags.username || username,
                color: tags.color || null,
                _shouldShowInPopout: shouldShowInPopout
            });
        }
        // Send to dashboard Chat tab
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('twitchChatMessage', {
                username,
                userId: userId || null,
                message,
                displayName: tags['display-name'] || tags.username,
                color: tags.color || null,
                isAction
            });
        }

        // Parse chat commands (allow chat-bot sender to issue commands)
        await parseChatCommand(username, userId, message, tags);
    });

    twitchClient.connect().catch(err => {
        console.error('Error connecting to Twitch:', err);
        isTwitchConnected = false;
        const msg = (err && err.message) || 'Connection failed';
        broadcastToWidget('twitchError', { error: msg });
        sendToDashboard('twitchError', { error: msg });
    });
}

// ============================================
// CHAT COMMAND PARSING
// ============================================

function parseBadges(tags) {
    const out = {};
    const raw = tags && tags.badges;
    if (typeof raw === 'string' && raw) {
        raw.split(',').forEach(p => {
            const i = p.indexOf('/');
            if (i > 0) { out[p.slice(0, i)] = p.slice(i + 1); }
        });
    } else if (raw && typeof raw === 'object') {
        Object.assign(out, raw);
    }
    return out;
}

function shouldAllowChatBubble(tags, settings) {
    const s = settings || {};
    if (!s.muteChatBubbles) return true;
    const b = parseBadges(tags);
    const isBroadcaster = b.broadcaster === '1';
    const isMod = tags && (tags.mod === true || tags.mod === '1') || b.moderator === '1';
    const isVip = b.vip === '1';
    const subTier = parseInt(b.subscriber, 10) || 0; // 1,2,3 for subs; 0 if none
    if (isBroadcaster) return true;
    if (s.muteAllowMod && isMod) return true;
    if (s.muteAllowVip && isVip) return true;
    if (s.muteAllowTier3 && subTier >= 3) return true;
    if (s.muteAllowTier2 && subTier >= 2) return true;
    if (s.muteAllowTier1 && subTier >= 1) return true;
    return false;
}

function canUserJoin(tags, settings) {
    if (!settings) return true;
    const b = parseBadges(tags);
    const isSubscriber = tags.subscriber === true || tags.subscriber === '1';
    const subTier = parseInt(b.subscriber, 10) || 0;
    const isPrime = b.premium === '1';
    const isVip = b.vip === '1';
    const isMod = tags.mod === true || tags.mod === '1';
    const isBroadcaster = b.broadcaster === '1';
    if (isBroadcaster || isMod) return true;
    if (settings.vipOnly && !isVip) return false;
    if (settings.primeOnly && !isPrime) return false;
    if (settings.followersOnly) {
        // TODO: Implement follower checking - currently not available in IRC tags
        // For now, allow all users when followersOnly is enabled
        // This should be implemented using Twitch API to check follow status
    }
    if (settings.subTier3Only && subTier < 3) return false;
    if (settings.subTier2Only && subTier < 2) return false;
    if (settings.subscriberOnly && !isSubscriber) return false;
    return true;
}

// Action functions map for bot commands
const actionFunctions = {
    handleJoinCommand,
    handleLeaveCommand,
    handleAfkCommand,
    handleLurkCommand,
    handleReturnCommand,
    handleCwCommand,
    handleCcwCommand,
    handleStillCommand,
    handleRoamCommand,
    handleWanderCommand,
    handleSpriteCommandAction,
    handleColorCommandAction,
    handleNextCommand,
    handleBackCommand,
    handleRandomCommand,
    handleResetCommand,
    handleSpinCommand,
    handleDanceCommand,
    handleSparkleCommand,
    handleWhoCommand,
    handleDuelCommand,
    handleRollCommand
};

// Bot messages cache for main process
// Each command now includes cooldown properties:
// - cooldown: number (seconds, 0 = no cooldown)
// - cooldownEnabled: boolean (whether cooldown is active)
// - cooldownType: 'per-user' | 'global' (default: 'per-user')
// - undeletable: boolean (for core commands that cannot be removed)
let botMessagesCache = [
    // REGULAR
    { id: 'help', name: 'Help Command', commands: ['!help'], command: '!help', message: 'Commands: join with "!join" • !leave • !cw [deg] • !ccw [deg] • !color <hex> • !sprite <name> • !next/!back • !spin • !dance • !sparkle • !random • !reset • !still/!wander', enabled: true, category: 'REGULAR', silent: false, respondAllChats: true, action: null, cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },

    // STATE - Messages will be loaded from saved settings
    { id: 'join', name: 'Join Command', commands: ['!join'], command: '!join', message: '{username} joined the campfire!', enabled: true, category: 'STATE', silent: false, respondAllChats: true, action: 'handleJoinCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'leave', name: 'Leave Command', commands: ['!leave', '!exit'], command: '!leave', message: '{username} left the campfire.', enabled: true, category: 'STATE', silent: false, respondAllChats: true, action: 'handleLeaveCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'afk', name: 'AFK Command', commands: ['!afk'], command: '!afk', message: '{username} went AFK 💤', enabled: true, category: 'STATE', silent: false, respondAllChats: true, action: 'handleAfkCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'lurk', name: 'Lurk Command', commands: ['!lurk'], command: '!lurk', message: '{username} is now lurking 👁️', enabled: true, category: 'STATE', silent: false, respondAllChats: true, action: 'handleLurkCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'return', name: 'Return Command', commands: ['!return', '!imback'], command: '!return', message: '{username} has returned!', enabled: true, category: 'APP', silent: false, respondAllChats: true, action: 'handleReturnCommand', allowNonCampers: false, cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true, returnFromStates: { AFK: true, SLEEPY: false, LURK: true } },

    // MOVEMENT
    { id: 'cw', name: 'Clockwise Rotation', commands: ['!cw'], command: '!cw', message: '', enabled: true, category: 'MOVEMENT', silent: true, respondAllChats: false, action: 'handleCwCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'ccw', name: 'Counter-clockwise Rotation', commands: ['!ccw'], command: '!ccw', message: '', enabled: true, category: 'MOVEMENT', silent: true, respondAllChats: false, action: 'handleCcwCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'still', name: 'Still Command', commands: ['!still'], command: '!still', message: '{username} is now still.', enabled: true, category: 'MOVEMENT', silent: false, respondAllChats: true, action: 'handleStillCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'roam', name: 'Roam Command', commands: ['!roam'], command: '!roam', message: '{username} is now roaming.', enabled: true, category: 'MOVEMENT', silent: false, respondAllChats: true, action: 'handleRoamCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'wander', name: 'Wander Command', commands: ['!wander'], command: '!wander', message: '{username} is now wandering.', enabled: true, category: 'MOVEMENT', silent: false, respondAllChats: true, action: 'handleWanderCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },

    // APPEARANCE
    { id: 'changesprite', name: 'Change Sprite', commands: ['!changesprite', '!sprite'], command: '!changesprite', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleSpriteCommandAction', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'changecolor', name: 'Change Color', commands: ['!changecolor', '!color'], command: '!changecolor', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleColorCommandAction', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'next', name: 'Next Sprite', commands: ['!next'], command: '!next', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleNextCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'back', name: 'Previous Sprite', commands: ['!back'], command: '!back', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleBackCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'random', name: 'Random Appearance', commands: ['!random'], command: '!random', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleRandomCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'reset', name: 'Reset Command', commands: ['!reset'], command: '!reset', message: '{username} reset their campfire look.', enabled: true, category: 'APPEARANCE', silent: false, respondAllChats: true, action: 'handleResetCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },

    // ANIMATION
    { id: 'spin', name: 'Spin Command', commands: ['!spin'], command: '!spin', message: '{username} spins!', enabled: true, category: 'ANIMATION', silent: false, respondAllChats: true, action: 'handleSpinCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'dance', name: 'Dance Command', commands: ['!dance'], command: '!dance', message: '{username} dances!', enabled: true, category: 'ANIMATION', silent: false, respondAllChats: true, action: 'handleDanceCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
    { id: 'sparkle', name: 'Sparkle Command', commands: ['!sparkle'], command: '!sparkle', message: '{username} sparkles! ✨', enabled: true, category: 'ANIMATION', silent: false, respondAllChats: true, action: 'handleSparkleCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },

    // SPECIAL - !who command (lists users around campfire)
    { id: 'who', name: 'Who Command', commands: ['!who'], command: '!who', message: '🔥 Around the campfire:', enabled: true, category: 'APP', silent: false, respondAllChats: true, action: 'handleWhoCommand', cooldown: DEFAULT_WHO_COOLDOWN_SECONDS, cooldownEnabled: true, cooldownType: 'global', undeletable: true, userLineFormat: '{icon} {username}', userSeparator: ' • ', stateIcons: { JOINED: '🔥', ACTIVE: '🔥', SLEEPY: '😴', AFK: '💤', LURK: '👁️' }, stateFilters: { JOINED: true, ACTIVE: true, SLEEPY: true, AFK: true, LURK: true } },

    // APP - Fun commands for viewer engagement (default disabled)
    { id: 'duel', name: 'Duel Command', commands: ['!duel'], command: '!duel', message: '{winner} defeats {loser} in a duel! ⚔️', enabled: false, category: 'APP', silent: false, respondAllChats: true, action: 'handleDuelCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: true, cooldownType: 'per-user', allowNonCampers: true, undeletable: true },
    { id: 'roll', name: 'Roll Command', commands: ['!roll'], command: '!roll', message: '{username} rolls {roll} (1-{max}) 🎲', enabled: false, category: 'APP', silent: false, respondAllChats: true, action: 'handleRollCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: true, cooldownType: 'per-user', allowNonCampers: true, undeletable: true },

    // Note: Automatic announcements removed - STATE commands now handle user-triggered responses
];

// Bot messages file path (for persistence)
let botMessagesPath;

// Load bot messages from file
function loadBotMessagesFromFile() {
    try {
        if (!botMessagesPath) return null;
        if (fs.existsSync(botMessagesPath)) {
            const data = fs.readFileSync(botMessagesPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Main Process] Error loading bot messages from file:', error);
    }
    return null;
}

// Get the default bot messages (used to ensure core commands are always present)
function getDefaultBotMessages() {
    return [
        // REGULAR
        { id: 'help', name: 'Help Command', commands: ['!help'], command: '!help', message: 'Commands: join with "!join" • !leave • !cw [deg] • !ccw [deg] • !color <hex> • !sprite <name> • !next/!back • !spin • !dance • !sparkle • !random • !reset • !still/!wander', enabled: true, category: 'REGULAR', silent: false, respondAllChats: true, action: null, cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },

        // STATE - Messages will be loaded from saved settings
        { id: 'join', name: 'Join Command', commands: ['!join'], command: '!join', message: '{username} joined the campfire!', enabled: true, category: 'STATE', silent: false, respondAllChats: true, action: 'handleJoinCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'leave', name: 'Leave Command', commands: ['!leave', '!exit'], command: '!leave', message: '{username} left the campfire.', enabled: true, category: 'STATE', silent: false, respondAllChats: true, action: 'handleLeaveCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'afk', name: 'AFK Command', commands: ['!afk'], command: '!afk', message: '{username} went AFK 💤', enabled: true, category: 'STATE', silent: false, respondAllChats: true, action: 'handleAfkCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'lurk', name: 'Lurk Command', commands: ['!lurk'], command: '!lurk', message: '{username} is now lurking 👁️', enabled: true, category: 'STATE', silent: false, respondAllChats: true, action: 'handleLurkCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'return', name: 'Return Command', commands: ['!return', '!imback'], command: '!return', message: '{username} has returned!', enabled: true, category: 'APP', silent: false, respondAllChats: true, action: 'handleReturnCommand', allowNonCampers: false, cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true, returnFromStates: { AFK: true, SLEEPY: false, LURK: true } },

        // MOVEMENT
        { id: 'cw', name: 'Clockwise Rotation', commands: ['!cw'], command: '!cw', message: '', enabled: true, category: 'MOVEMENT', silent: true, respondAllChats: false, action: 'handleCwCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'ccw', name: 'Counter-clockwise Rotation', commands: ['!ccw'], command: '!ccw', message: '', enabled: true, category: 'MOVEMENT', silent: true, respondAllChats: false, action: 'handleCcwCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'still', name: 'Still Command', commands: ['!still'], command: '!still', message: '{username} is now still.', enabled: true, category: 'MOVEMENT', silent: false, respondAllChats: true, action: 'handleStillCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'roam', name: 'Roam Command', commands: ['!roam'], command: '!roam', message: '{username} is now roaming.', enabled: true, category: 'MOVEMENT', silent: false, respondAllChats: true, action: 'handleRoamCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'wander', name: 'Wander Command', commands: ['!wander'], command: '!wander', message: '{username} is now wandering.', enabled: true, category: 'MOVEMENT', silent: false, respondAllChats: true, action: 'handleWanderCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },

        // APPEARANCE
        { id: 'changesprite', name: 'Change Sprite', commands: ['!changesprite', '!sprite'], command: '!changesprite', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleSpriteCommandAction', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'changecolor', name: 'Change Color', commands: ['!changecolor', '!color'], command: '!changecolor', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleColorCommandAction', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'next', name: 'Next Sprite', commands: ['!next'], command: '!next', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleNextCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'back', name: 'Previous Sprite', commands: ['!back'], command: '!back', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleBackCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'random', name: 'Random Appearance', commands: ['!random'], command: '!random', message: '', enabled: true, category: 'APPEARANCE', silent: true, respondAllChats: false, action: 'handleRandomCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'reset', name: 'Reset Command', commands: ['!reset'], command: '!reset', message: '{username} reset their campfire look.', enabled: true, category: 'APPEARANCE', silent: false, respondAllChats: true, action: 'handleResetCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },

        // ANIMATION
        { id: 'spin', name: 'Spin Command', commands: ['!spin'], command: '!spin', message: '{username} spins!', enabled: true, category: 'ANIMATION', silent: false, respondAllChats: true, action: 'handleSpinCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'dance', name: 'Dance Command', commands: ['!dance'], command: '!dance', message: '{username} dances!', enabled: true, category: 'ANIMATION', silent: false, respondAllChats: true, action: 'handleDanceCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },
        { id: 'sparkle', name: 'Sparkle Command', commands: ['!sparkle'], command: '!sparkle', message: '{username} sparkles! ✨', enabled: true, category: 'ANIMATION', silent: false, respondAllChats: true, action: 'handleSparkleCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: false, cooldownType: 'per-user', undeletable: true },

        // SPECIAL - !who command (lists users around campfire)
        { id: 'who', name: 'Who Command', commands: ['!who'], command: '!who', message: '🔥 Around the campfire:', enabled: true, category: 'APP', silent: false, respondAllChats: true, action: 'handleWhoCommand', cooldown: DEFAULT_WHO_COOLDOWN_SECONDS, cooldownEnabled: true, cooldownType: 'global', undeletable: true, userLineFormat: '{icon} {username}', userSeparator: ' • ', stateIcons: { JOINED: '🔥', ACTIVE: '🔥', SLEEPY: '😴', AFK: '💤', LURK: '👁️' }, stateFilters: { JOINED: true, ACTIVE: true, SLEEPY: true, AFK: true, LURK: true } },

        // APP - Fun commands for viewer engagement (default disabled)
        { id: 'duel', name: 'Duel Command', commands: ['!duel'], command: '!duel', message: '{winner} defeats {loser} in a duel! ⚔️', enabled: false, category: 'APP', silent: false, respondAllChats: true, action: 'handleDuelCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: true, cooldownType: 'per-user', allowNonCampers: true, undeletable: true },
        { id: 'roll', name: 'Roll Command', commands: ['!roll'], command: '!roll', message: '{username} rolls {roll} (1-{max}) 🎲', enabled: false, category: 'APP', silent: false, respondAllChats: true, action: 'handleRollCommand', cooldown: DEFAULT_COOLDOWN_SECONDS, cooldownEnabled: true, cooldownType: 'per-user', allowNonCampers: true, undeletable: true },
    ];
}

// Ensure all default commands are present in the saved messages
// This prevents accidental deletion of core commands
// NOTE: Only adds MISSING commands (first install scenario) - never overwrites user preferences
function ensureDefaultCommands(savedMessages) {
    const defaults = getDefaultBotMessages();
    const result = [...savedMessages];
    let addedCount = 0;
    
    for (const defaultCmd of defaults) {
        const exists = result.find(msg => msg.id === defaultCmd.id);
        if (!exists) {
            // Only add commands that don't exist (first install or new command added in update)
            // This preserves user's enabled/disabled preferences for existing commands
            console.log(`[Main] Adding new default command: ${defaultCmd.id}`);
            result.push(defaultCmd);
            addedCount++;
        }
        // Intentionally NOT overwriting existing command properties
        // User preferences (enabled, message, cooldown, etc.) are preserved
    }
    
    if (addedCount > 0) {
        console.log(`[Main] Added ${addedCount} new command(s) to existing configuration`);
    }
    
    return result;
}

// Save bot messages to file
function saveBotMessagesToFile(messages) {
    try {
        if (!botMessagesPath) return false;
        fs.writeFileSync(botMessagesPath, JSON.stringify(messages, null, 2), 'utf8');
        console.log('[Main Process] Bot messages saved to file');
        return true;
    } catch (error) {
        console.error('[Main Process] Error saving bot messages to file:', error);
        return false;
    }
}

// Normalize bot message for cache
function normalizeBotMessage(msg) {
    const normalized = {
        id: msg.id,
        name: msg.name,
        commands: Array.isArray(msg.commands) ? msg.commands.map(cmd => cmd.toLowerCase()) : [msg.command].filter(Boolean).map(cmd => cmd.toLowerCase()),
        command: msg.command, // Keep for backward compatibility
        message: msg.message,
        enabled: msg.enabled,
        category: msg.category || 'REGULAR',
        silent: msg.silent !== undefined ? msg.silent : false,
        respondAllChats: msg.respondAllChats !== undefined ? msg.respondAllChats : true,
        allowNonCampers: msg.allowNonCampers !== undefined ? msg.allowNonCampers : false,
        action: msg.action || null,
        // Cooldown properties
        cooldown: msg.cooldown !== undefined ? msg.cooldown : DEFAULT_COOLDOWN_SECONDS,
        cooldownEnabled: msg.cooldownEnabled !== undefined ? msg.cooldownEnabled : false,
        cooldownType: msg.cooldownType || 'per-user',
        undeletable: msg.undeletable !== undefined ? msg.undeletable : false
    };
    
    // !who command specific properties
    if (msg.id === 'who') {
        normalized.userLineFormat = msg.userLineFormat || '{icon} {username}';
        normalized.userSeparator = msg.userSeparator || ' • ';
        normalized.stateIcons = msg.stateIcons || { JOINED: '🔥', ACTIVE: '🔥', SLEEPY: '😴', AFK: '💤', LURK: '👁️' };
        normalized.stateFilters = msg.stateFilters || { JOINED: true, ACTIVE: true, SLEEPY: true, AFK: true, LURK: true };
    }
    
    return normalized;
}

// Broadcast bot messages update to all windows
function broadcastBotMessagesUpdate() {
    const windows = [widgetWindow, dashboardWindow, chatPopoutWindow];
    for (const win of windows) {
        if (win && !win.isDestroyed()) {
            win.webContents.send('bot-messages-update', botMessagesCache);
        }
    }
}

// IPC handlers for bot messages - registered in registerBotMessageIPCHandlers()
// These must be registered after app.whenReady() because ipcMain is not available at module load time
let botMessageIPCHandlersRegistered = false;

function registerBotMessageIPCHandlers() {
    if (botMessageIPCHandlersRegistered) return;
    botMessageIPCHandlersRegistered = true;
    
    ipcMain.handle('get-bot-messages', () => {
        return botMessagesCache;
    });

    // New: Save bot messages (replaces localStorage-based approach)
    ipcMain.handle('save-bot-messages', (event, messages) => {
        console.log('[Main Process] Saving bot messages:', messages.length, 'messages');
        botMessagesCache = messages.map(normalizeBotMessage);
        saveBotMessagesToFile(botMessagesCache);
        broadcastBotMessagesUpdate();
        console.log('[Main Process] Bot messages saved and broadcast');
        return { success: true };
    });

    // Legacy: Keep for backward compatibility during migration
    ipcMain.on('bot-messages-updated', (event, messages) => {
        console.log('[Main Process] Bot messages updated (legacy):', messages);
        botMessagesCache = messages.map(normalizeBotMessage);
        saveBotMessagesToFile(botMessagesCache);
        console.log('[Main Process] Updated bot messages cache');
    });
    
    console.log('[Main] Bot message IPC handlers registered');
}

// Function to sync configurable commands from settings to cache
function syncConfigurableCommands() {
    const settings = loadSettings();
    if (!settings) return;

    // Update join commands
    const joinEntry = botMessagesCache.find(msg => msg.id === 'join');
    if (joinEntry) {
        const joinCommands = Array.isArray(settings.commands) ? settings.commands : [(settings.command || '!join')];
        joinEntry.commands = joinCommands.map(cmd => cmd.toLowerCase().trim()).filter(cmd => cmd);
    }

    // Update AFK commands
    const afkEntry = botMessagesCache.find(msg => msg.id === 'afk');
    if (afkEntry) {
        const afkCommands = Array.isArray(settings.afkCommands) ? settings.afkCommands : ['!afk'];
        afkEntry.commands = afkCommands.map(cmd => cmd.toLowerCase().trim()).filter(cmd => cmd);
    }

    // Update LURK commands
    const lurkEntry = botMessagesCache.find(msg => msg.id === 'lurk');
    if (lurkEntry) {
        const lurkCommands = Array.isArray(settings.lurkCommands) ? settings.lurkCommands : ['!lurk'];
        lurkEntry.commands = lurkCommands.map(cmd => cmd.toLowerCase().trim()).filter(cmd => cmd);
    }
}

ipcMain.on('initialize-bot-messages', (event, messages) => {
    console.log('[Main Process] Initializing bot messages:', messages);
    
    // First, try to load from file (persistent storage)
    const savedMessages = loadBotMessagesFromFile();
    if (savedMessages && savedMessages.length > 0) {
        console.log('[Main Process] Loaded bot messages from file');
        // Ensure all default commands are present (in case user accidentally deleted one)
        const normalizedSaved = savedMessages.map(normalizeBotMessage);
        botMessagesCache = ensureDefaultCommands(normalizedSaved);
        // Save back if any defaults were restored
        if (botMessagesCache.length > normalizedSaved.length) {
            saveBotMessagesToFile(botMessagesCache);
        }
    } else {
        // Use provided messages (from dashboard localStorage migration)
        botMessagesCache = messages.map(normalizeBotMessage);
        // Save to file for future loads
        saveBotMessagesToFile(botMessagesCache);
    }
    
    console.log('[Main Process] Initialized bot messages cache:', botMessagesCache.length, 'messages');

    // Sync configurable commands from settings after loading bot messages
    syncConfigurableCommands();
});

// Helper function to get bot messages
function getBotMessages() {
    return botMessagesCache;
}

async function sayInChannel(text, speaker = 'bot', useMe = false) {
    let msg = String(text || '').trim();
    if (!msg) return false;
    
    // If useMe is true, prefix with /me for action-style messages
    if (useMe && !msg.startsWith('/me ')) {
        msg = '/me ' + msg;
    }
    
    const ch = twitchConfig.channelName ? '#' + twitchConfig.channelName.replace(/^#/, '') : null;
    if (!ch) return false;
    
    // If speaker is 'main', try main client first, then bot
    // If speaker is 'bot', try bot client first, then main
    if (speaker === 'main') {
        // Try main client first
        try {
            if (twitchClient && isTwitchConnected) {
                await twitchClient.say(ch, msg);
                return true;
            }
        } catch (e) { /* ignore */ }
        // Fall back to bot client
        try {
            if (twitchChatClient && isTwitchChatConnected) {
                await twitchChatClient.say(ch, msg);
                return true;
            }
        } catch (e) { /* ignore */ }
    } else {
        // Try bot client first (default behavior)
        try {
            if (twitchChatClient && isTwitchChatConnected) {
                await twitchChatClient.say(ch, msg);
                return true;
            }
        } catch (e) { /* ignore */ }
        // Fall back to main client
        try {
            if (twitchClient && isTwitchConnected) {
                await twitchClient.say(ch, msg);
                return true;
            }
        } catch (e) { /* ignore */ }
    }
    return false;
}

// Function to send a configurable bot message
async function sendBotMessage(messageId, username = '') {
    const messages = getBotMessages();
    const msgConfig = messages.find(msg => msg.id === messageId);

    if (!msgConfig || !msgConfig.enabled) {
        return; // Message disabled or not found
    }

    let message = msgConfig.message;
    if (username) {
        message = message.replace('{username}', username);
    }

    await sayInChannel(message);
}

async function triggerSpinInWidget(userId, username) {
    try {
        await executeInWidget(`
            const w = window.widget || window.campfireWidget;
            if (!w || !Array.isArray(w.users)) return;
            const u = w.users.find(x => String(x.userId || '') === String(userId));
            if (!u) return;
            const el = document.getElementById(u.id);
            if (!el) return;
            el.classList.remove('entering', 'swivel');
            void el.offsetWidth; // restart animation
            el.classList.add('swivel');
            // Animation is 1.5s for 3 full spins, add buffer for cleanup
            setTimeout(() => { try { el.classList.remove('swivel'); } catch (e) {} }, 1600);
        `, { userId: String(userId || '') });
    } catch (e) { /* ignore */ }
}

async function triggerDanceInWidget(userId, username) {
    try {
        await executeInWidget(`
            const w = window.widget || window.campfireWidget;
            if (!w || !Array.isArray(w.users)) return;
            const u = w.users.find(x => String(x.userId || '') === String(userId));
            if (!u) return;
            const el = document.getElementById(u.id);
            if (!el) return;
            
            // Add dancing class for CSS animation
            el.classList.remove('dancing');
            void el.offsetWidth; // Force reflow
            el.classList.add('dancing');
            
            // Also do the shuffle movement around the circle
            let steps = 0;
            const maxSteps = 12; // More steps for longer dance
            const dir = Math.random() < 0.5 ? 1 : -1;
            const tick = () => {
                if (!w || !u) return;
                const d = (steps % 2 === 0) ? dir : -dir;
                try { w.moveUser(u.username, d, 10); } catch (e) {} // Larger steps (10 degrees)
                steps++;
                if (steps >= maxSteps) {
                    try { w.setUserMoving(u.id, false); } catch (e) {}
                    // Remove dancing class after animation
                    setTimeout(() => {
                        try { el.classList.remove('dancing'); } catch (e) {}
                    }, 200);
                    return;
                }
                setTimeout(tick, 150); // Faster tempo
            };
            try { w.setUserMoving(u.id, true); } catch (e) {}
            tick();
        `, { userId: String(userId || '') });
    } catch (e) { /* ignore */ }
}

async function triggerSparkleInWidget(userId, username) {
    try {
        await executeInWidget(`
            const w = window.widget || window.campfireWidget;
            if (!w || !Array.isArray(w.users)) {
                console.log('[Sparkle] Widget or users not found');
                return;
            }
            const u = w.users.find(x => String(x.userId || '') === String(userId));
            if (!u) {
                console.log('[Sparkle] User not found:', userId);
                return;
            }
            const el = document.getElementById(u.id);
            if (!el) {
                console.log('[Sparkle] Element not found for user:', u.id);
                return;
            }
            
            console.log('[Sparkle] Triggering sparkle for:', u.username || userId);
            
            // Add sparkling class for glow/pulse animation
            el.classList.remove('sparkling');
            void el.offsetWidth; // Force reflow
            el.classList.add('sparkling');
            
            // Create sparkle particles that swirl outward
            const rect = el.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            console.log('[Sparkle] Creating particles at:', centerX, centerY);
            
            // Create 12 sparkle particles - append to body for fixed positioning
            for (let i = 0; i < 12; i++) {
                const sparkle = document.createElement('div');
                sparkle.className = 'sparkle-particle';
                sparkle.style.left = centerX + 'px';
                sparkle.style.top = centerY + 'px';
                
                // Calculate angle and distance for this particle
                const angleRad = ((i * 30) + (Math.random() * 20 - 10)) * Math.PI / 180; // Convert to radians
                const distance = 60 + Math.random() * 40; // 60-100px outward
                const duration = 0.8 + Math.random() * 0.4; // 0.8-1.2s
                
                // Calculate end position using trigonometry
                const endX = Math.cos(angleRad) * distance;
                const endY = Math.sin(angleRad) * distance;
                
                // Set CSS custom properties for the animation end position
                sparkle.style.setProperty('--end-x', endX + 'px');
                sparkle.style.setProperty('--end-y', endY + 'px');
                sparkle.style.setProperty('--sparkle-duration', duration + 's');
                
                // Append to body since we're using position: fixed
                document.body.appendChild(sparkle);
                
                // Force reflow then add animating class to trigger animation
                void sparkle.offsetWidth;
                sparkle.classList.add('animating');
                
                // Remove after animation
                setTimeout(() => {
                    try { sparkle.remove(); } catch (e) {}
                }, duration * 1000 + 100);
            }
            
            // Remove sparkling class after animation
            setTimeout(() => {
                try { el.classList.remove('sparkling'); } catch (e) {}
            }, 2000);
        `, { userId: String(userId || '') });
    } catch (e) {
        console.error('[Sparkle] Error:', e);
    }
}

function isUserJoined(userId, username) {
    const normalizedUserId = userId ? String(userId) : null;
    if (normalizedUserId && activeUsers.has(normalizedUserId)) return true;
    const name = String(username || '').toLowerCase();
    if (!name) return false;
    for (const [, u] of activeUsers.entries()) {
        if (u && u.username && String(u.username).toLowerCase() === name) return true;
    }
    return false;
}

async function parseChatCommand(username, userId, message, tags) {
    const command = message.trim().toLowerCase();
    const settings = loadSettings();
    
    // Update user activity for ANY command (commands count as active chats for state tracking)
    // This ensures users using commands don't go AFK/SLEEPY
    if (command.startsWith('!')) {
        broadcastToWidget('userActivity', { username, userId });
        
        // Also update the main process UserManager (single source of truth)
        // This ensures auto-state transitions are based on the latest activity
        if (userManager && userId) {
            try {
                userManager.recordActivity(userId);
            } catch (error) {
                console.error(`[parseChatCommand] Failed to record activity for ${username}:`, error);
            }
        }
    }
    const joinMethod = String(settings.joinMethod || 'command').toLowerCase();
    const joinCommands = Array.isArray(settings.commands) ? settings.commands : [(settings.command || '!join')];
    const normalizedJoinCommands = joinCommands.map(cmd => cmd.toLowerCase().trim()).filter(cmd => cmd);
    const joinEmote = String(settings.emoteName || '').toLowerCase().trim();

    // Join command (configurable, supports multiple)
    if (joinMethod !== 'emote' && normalizedJoinCommands.length > 0) {
        for (const joinCmd of normalizedJoinCommands) {
            if (command === joinCmd || command.startsWith(joinCmd + ' ')) {
                await handleJoinCommand(username, userId, tags);
                return;
            }
        }
    }

    // Join via emote name (configurable)
    if (joinMethod === 'emote' && joinEmote) {
        const msgLower = String(message || '').toLowerCase();
        // Token match first, fallback to substring.
        const tokens = msgLower.split(/\s+/).filter(Boolean);
        if (tokens.includes(joinEmote) || msgLower.includes(joinEmote)) {
            await handleJoinCommand(username, userId, tags);
            return;
        }
    }

    // Leave command
    if (command === '!leave' || command === '!exit') {
        await handleLeaveCommand(username, userId);
        return;
    }

    // AFK command
    if (command === '!afk') {
        await handleAfkCommand(username, userId);
        return;
    }

    // Lurk command
    if (command === '!lurk') {
        await handleLurkCommand(username, userId);
        return;
    }
    
    // Return command (from AFK/LURK)
    if (command === '!return' || command === '!imback') {
        await handleReturnCommand(username, userId);
        return;
    }
    
    // Unified command processing from cache
    for (const cmd of botMessagesCache) {
        if (!cmd.enabled || !Array.isArray(cmd.commands) || cmd.category === 'ANNOUNCEMENT') continue;
        if (cmd.commands.some(c => command === c || command.startsWith(c + ' '))) {
            // Check cooldown before executing command
            const cooldownResult = checkCommandCooldown(cmd.id, userId, cmd);
            if (cooldownResult.onCooldown) {
                console.log(`[parseChatCommand] Command ${cmd.id} on cooldown for user ${username} (${cooldownResult.remainingSeconds}s remaining)`);
                return; // Silently ignore command on cooldown
            }
            
            if (cmd.action) {
                const actionFunc = actionFunctions[cmd.action]; // Use function map instead of eval
                if (actionFunc) {
                    // Action handlers are responsible for their own messaging
                    // Do NOT send messages here to avoid duplication
                    await actionFunc(username, userId, message, tags);
                    // Update cooldown after successful execution
                    updateCommandCooldown(cmd.id, userId, cmd);
                    return; // Action handler handles everything including messaging
                }
            }
            // Only send messages for commands WITHOUT action handlers
            if (cmd.message) {
                let msg = cmd.message.replace('{username}', username);
                if (cmd.id === 'help') {
                    // Use first join command from the array, or default to '!join'
                    const primaryJoinCmd = normalizedJoinCommands[0] || '!join';
                    msg = msg.replace('{joinMethod}', joinMethod === 'emote' ? `join by typing "${joinEmote}"` : `join with "${primaryJoinCmd}"`);
                }
                // Send to Twitch chat (unless silent)
                if (!cmd.silent) {
                    await sayInChannel(msg, 'bot', cmd.category === 'ANIMATION' || cmd.category === 'STATE' || cmd.category === 'MOVEMENT' || cmd.category === 'APPEARANCE' ? true : false);
                }
                // Send to Popout Chat (if respondAllChats/Pop Out Chat toggle is ON)
                if (cmd.respondAllChats) {
                    sendToPopoutChat({
                        username: '',
                        message: msg,
                        userId: null,
                        emotes: null,
                        allowBubble: false,
                        isAction: shouldUseItalicFormat(cmd.category),
                        displayName: '',
                        color: null,
                        commandCategory: cmd.category || null
                    });
                }
                // Always send to dashboard Internal Chat (source of truth)
                if (dashboardWindow && !dashboardWindow.isDestroyed()) {
                    dashboardWindow.webContents.send('twitchChatMessage', {
                        username: '',
                        message: msg,
                        userId: null,
                        emotes: null,
                        allowBubble: false,
                        isAction: shouldUseItalicFormat(cmd.category),
                        displayName: '',
                        color: null,
                        commandCategory: cmd.category || null,
                        isBotResponse: true
                    });
                }
                // Update cooldown after successful execution
                updateCommandCooldown(cmd.id, userId, cmd);
            }
            return;
        }
    }
}

/**
 * Gets the real Twitch ID for a user.
 *
 * PROPER ARCHITECTURE: No placeholder IDs, no migration logic.
 * - For streamer/bot: Use stored real Twitch ID from twitchConfig
 * - For viewers: Use the Twitch ID provided by Twitch IRC
 * - If no real ID available: Return null (caller must handle)
 *
 * @param {string} username - The username to look up
 * @param {string} userId - The userId provided (must be real Twitch ID)
 * @returns {string|null} The real Twitch ID, or null if not available
 */
function getRealTwitchId(username, userId) {
    const normalizedUsername = String(username).toLowerCase();
    
    // Get streamer and bot usernames from config
    const streamerUsername = (twitchConfig.channelName || twitchConfig.botUsername || '').replace(/^#/, '').toLowerCase();
    const botUsername = (twitchConfig.chatBotUsername || '').toLowerCase();
    
    // For streamer: Use stored real Twitch ID
    if (normalizedUsername === streamerUsername) {
        if (twitchConfig.streamerUserId) {
            return String(twitchConfig.streamerUserId);
        }
        console.warn(`[getRealTwitchId] Streamer ${username} has no stored Twitch ID - Twitch not connected?`);
        return null;
    }
    
    // For bot: Use stored real Twitch ID
    if (normalizedUsername === botUsername && botUsername !== streamerUsername) {
        if (twitchConfig.botUserId) {
            return String(twitchConfig.botUserId);
        }
        console.warn(`[getRealTwitchId] Bot ${username} has no stored Twitch ID - Twitch not connected?`);
        return null;
    }
    
    // For viewers: The userId must be a real Twitch ID (numeric)
    if (userId) {
        const normalizedUserId = String(userId);
        const isRealTwitchId = /^\d+$/.test(normalizedUserId);
        
        if (isRealTwitchId) {
            return normalizedUserId;
        }
        
        // Non-numeric userId is invalid - this should never happen with proper Twitch integration
        console.warn(`[getRealTwitchId] Invalid non-numeric userId "${userId}" for ${username} - this indicates a bug`);
    }
    
    // No valid Twitch ID available
    return null;
}

/**
 * Checks if Twitch is connected and real IDs are available.
 * Use this to gate features that require real Twitch IDs.
 */
function isTwitchReady() {
    return isTwitchConnected && twitchConfig.streamerUserId;
}

async function handleJoinCommand(username, userId, tags) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    const normalizedUsername = String(username).toLowerCase();
    
    // PROPER ARCHITECTURE: Require real Twitch ID for all operations
    if (!realTwitchId) {
        console.warn(`[handleJoinCommand] Cannot join ${username} - no real Twitch ID available`);
        return;
    }
    
    const normalizedUserId = realTwitchId;
    
    // Check if user is already joined - if so, they might be returning from LURK/AFK
    // Use userManager if available, fall back to activeUsers for backward compatibility
    let existingUser = userManager ? userManager.getUser(normalizedUserId) : activeUsers.get(normalizedUserId);
    
    // Extract user roles from Twitch tags (do this first, needed for both AFK return and new join)
    const badges = parseBadges(tags);
    const roles = {
        isBroadcaster: badges.broadcaster === '1',
        isMod: (tags && (tags.mod === true || tags.mod === '1')) || badges.moderator === '1',
        isVip: badges.vip === '1',
        isSubscriber: tags && (tags.subscriber === true || tags.subscriber === '1'),
        subTier: parseInt(badges.subscriber, 10) || 0, // 1, 2, 3 for sub tiers
        isFollower: false, // Would need API call to check follower status
        isBot: badges.bot === '1' // Twitch bot badge
    };
    
    if (existingUser) {
        // Check if user is in AFK or LURK state
        const isAfk = userManager
            ? (existingUser.state === USER_STATES.AFK)
            : (existingUser.userState === 'afk' || existingUser.isAfk);
        const isLurk = userManager
            ? (existingUser.state === USER_STATES.LURK)
            : (existingUser.userState === 'lurk' || existingUser.isLurking);
        const isAfkOrLurk = isAfk || isLurk;
        
        if (isAfkOrLurk) {
            // Return user from AFK/LURK
            if (userManager) {
                userManager.joinUser(normalizedUserId, { username, roles });
            } else {
                existingUser.userState = 'active';
                existingUser.state = 'ACTIVE';
                existingUser.isLurking = false;
                existingUser.isAfk = false;
            }
            
            // Also update legacy activeUsers for backward compatibility
            if (activeUsers.has(normalizedUserId)) {
                const legacyUser = activeUsers.get(normalizedUserId);
                legacyUser.userState = 'active';
                legacyUser.state = 'ACTIVE';
                legacyUser.isLurking = false;
                legacyUser.isAfk = false;
            }

            // Broadcast return from lurk/afk event to widget
            broadcastToWidget('userReturnFromLurk', { username, userId: normalizedUserId });
            
            // Send return announcement using BotMessageHelper
            if (botMessageHelper) {
                await botMessageHelper.sendBotMessage('return', { username });
            }
            
            console.log(`🔄 ${username} returned from ${isAfk ? 'AFK' : 'LURK'} via join command`);
        }
        // User already joined and active - nothing to do
        return;
    }

    // New user joining - extract data from Twitch tags
    const prefs = loadViewerPrefs();
    const p = prefs[normalizedUserId] || prefs[userId];
    const color = await getViewerColor(username, normalizedUserId) || (p && p.color) || null;
    let twitchHex = null;
    if (tags && tags.color) {
        const r = String(tags.color).replace(/^#/, '').trim();
        if (/^[0-9A-Fa-f]{6}$/.test(r)) twitchHex = '#' + r;
    }

    // Create user data object
    const userData = {
        username,
        userId: normalizedUserId,
        color: color,
        selectedSprite: (p && p.selectedSprite) || null,
        twitchColor: twitchHex,
        joinedAt: Date.now(),
        angle: Math.random() * 360,
        source: 'chat-command',
        roles: roles,
        state: USER_STATES.JOINED  // Include state for buddy list
    };
    
    // Add to UserManager if available
    if (userManager) {
        await userManager.joinUser(normalizedUserId, userData);
    }
    
    // Also add to legacy activeUsers for backward compatibility
    activeUsers.set(normalizedUserId, userData);
    
    // Emit events
    addEvent('userJoin', userData);
    broadcastToWidget('userJoin', userData);
    
    // Send join announcement using BotMessageHelper
    if (botMessageHelper) {
        await botMessageHelper.sendBotMessage('join', { username });
    }
    
    console.log(`🔥 ${username} joined via !join command (roles: ${JSON.stringify(roles)})`);
}

async function handleLeaveCommand(username, userId) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleLeaveCommand] Cannot process leave for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    
    // Check if user exists using userManager or activeUsers
    const userExists = userManager
        ? userManager.hasUser(normalizedUserId)
        : activeUsers.has(normalizedUserId);
    
    if (!userExists) {
        return;
    }
    
    // Remove from UserManager if available
    if (userManager) {
        userManager.leaveUser(normalizedUserId);
    }
    
    // Also remove from legacy activeUsers for backward compatibility
    activeUsers.delete(normalizedUserId);
    
    // Emit events
    addEvent('userLeave', { username, userId: normalizedUserId });
    broadcastToWidget('userLeave', { username, userId: normalizedUserId });
    
    // Send leave announcement using BotMessageHelper
    if (botMessageHelper) {
        await botMessageHelper.sendBotMessage('leave', { username });
    }
    
    console.log(`👋 ${username} left via !leave command`);
}

async function handleAfkCommand(username, userId) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleAfkCommand] Cannot process AFK for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    
    // Check if user is joined using userManager or activeUsers
    const isJoined = userManager
        ? userManager.hasUser(normalizedUserId) && userManager.getUser(normalizedUserId).hasJoined
        : activeUsers.has(normalizedUserId);
    
    // Check if non-campers are allowed
    const allowNonCampers = botMessageHelper
        ? botMessageHelper.allowsNonCampers('afk')
        : (botMessagesCache.find(msg => msg.id === 'afk')?.allowNonCampers || false);

    if (!isJoined && !allowNonCampers) {
        return; // Command not allowed for non-joined users
    }

    // For non-joined users, just send the announcement without changing state
    if (!isJoined) {
        if (botMessageHelper) {
            await botMessageHelper.sendBotMessage('afk', { username });
        }
        return;
    }
    
    // Update user state using UserManager if available
    if (userManager) {
        userManager.setUserAfk(normalizedUserId, true); // true = manual AFK
    }
    
    // Also update legacy activeUsers for backward compatibility
    const user = activeUsers.get(normalizedUserId);
    if (user) {
        user.userState = 'afk';
        user.state = 'AFK';
        user.isAfk = true;
        user.isLurking = false; // Clear lurking flag if set
    }

    // Broadcast AFK state to widget
    broadcastToWidget('userAfk', { username, userId: normalizedUserId });
    
    // Send AFK announcement using BotMessageHelper
    if (botMessageHelper) {
        await botMessageHelper.sendBotMessage('afk', { username });
    }
    
    console.log(`💤 ${username} went AFK`);
}

async function handleLurkCommand(username, userId) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleLurkCommand] Cannot process LURK for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    
    // Check if user is joined using userManager or activeUsers
    const isJoined = userManager
        ? userManager.hasUser(normalizedUserId) && userManager.getUser(normalizedUserId).hasJoined
        : activeUsers.has(normalizedUserId);
    
    // Check if non-campers are allowed
    const allowNonCampers = botMessageHelper
        ? botMessageHelper.allowsNonCampers('lurk')
        : (botMessagesCache.find(msg => msg.id === 'lurk')?.allowNonCampers || false);

    if (!isJoined && !allowNonCampers) {
        return; // Command not allowed for non-joined users
    }

    // For non-joined users, just send the announcement without changing state
    if (!isJoined) {
        if (botMessageHelper) {
            await botMessageHelper.sendBotMessage('lurk', { username });
        }
        return;
    }
    
    // Update user state using UserManager if available
    if (userManager) {
        userManager.setUserLurk(normalizedUserId);
    }
    
    // Also update legacy activeUsers for backward compatibility
    const user = activeUsers.get(normalizedUserId);
    if (user) {
        user.userState = 'lurk';
        user.state = 'LURK';
        user.isLurking = true;
        user.isAfk = false; // Clear AFK flag if set
    }

    // Broadcast LURK state to widget
    broadcastToWidget('userLurk', { username, userId: normalizedUserId });
    
    // Send LURK announcement using BotMessageHelper
    if (botMessageHelper) {
        await botMessageHelper.sendBotMessage('lurk', { username });
    }
    
    console.log(`👁️ ${username} is now lurking`);
}

async function handleReturnCommand(username, userId) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleReturnCommand] Cannot process RETURN for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    
    // Check if user is joined using userManager or activeUsers
    const isJoined = userManager
        ? userManager.hasUser(normalizedUserId) && userManager.getUser(normalizedUserId).hasJoined
        : activeUsers.has(normalizedUserId);
    
    if (!isJoined) {
        return; // User not joined - can't return if not in campfire
    }
    
    // Check if user is actually in LURK or AFK state
    const user = userManager
        ? userManager.getUser(normalizedUserId)
        : activeUsers.get(normalizedUserId);
    
    const currentState = user?.userState || user?.state || 'active';
    const isLurkOrAfk = currentState === 'lurk' || currentState === 'LURK' || 
                        currentState === 'afk' || currentState === 'AFK' ||
                        user?.isLurking || user?.isAfk;
    
    if (!isLurkOrAfk) {
        // User is not in LURK or AFK state - nothing to return from
        console.log(`[handleReturnCommand] ${username} is not in LURK/AFK state, ignoring return command`);
        return;
    }
    
    // Update user state using UserManager if available
    if (userManager) {
        userManager.updateUser(normalizedUserId, {
            userState: 'active',
            state: 'ACTIVE',
            isLurking: false,
            isAfk: false,
            lastActivity: Date.now()
        });
    }
    
    // Also update legacy activeUsers for backward compatibility
    if (activeUsers.has(normalizedUserId)) {
        const u = activeUsers.get(normalizedUserId);
        u.userState = 'active';
        u.state = 'ACTIVE';
        u.isLurking = false;
        u.isAfk = false;
        u.lastActivity = Date.now();
    }

    // Broadcast RETURN state to widget
    broadcastToWidget('userReturnFromLurk', { username, userId: normalizedUserId });
    
    // Send RETURN announcement using BotMessageHelper (only if state filter allows)
    if (botMessageHelper) {
        // Get the return command config to check state filters
        const returnCmd = botMessagesCache.find(cmd => cmd.id === 'return');
        const returnFromStates = returnCmd?.returnFromStates || { AFK: true, SLEEPY: false, LURK: true };
        
        // Check if we should announce based on the state the user is returning from
        const stateKey = currentState.toUpperCase();
        if (returnFromStates[stateKey] !== false) {
            await botMessageHelper.sendBotMessage('return', { username });
        } else {
            console.log(`[handleReturnCommand] Skipping announcement for ${username} returning from ${currentState} (filtered)`);
        }
    }
    
    console.log(`🔙 ${username} has returned from ${currentState.toUpperCase()}`);
}

function handleMoveCommand(username, userId, direction, degrees) {
    const normalizedUserId = String(userId);
    // direction: 1 = clockwise, -1 = counter-clockwise
    // degrees: amount to move (0-360)
    
    // Check if user exists using userManager or activeUsers
    const userExists = userManager
        ? userManager.hasUser(normalizedUserId) && userManager.getUser(normalizedUserId).hasJoined
        : activeUsers.has(normalizedUserId);
    
    if (!userExists) {
        return; // User not joined
    }
    
    // Get current angle from userManager or activeUsers
    const user = userManager
        ? userManager.getUser(normalizedUserId)
        : activeUsers.get(normalizedUserId);
    const currentAngle = user.angle || 0;
    
    // Calculate new angle (clockwise = +, counter-clockwise = -)
    let newAngle = currentAngle + (direction * degrees);
    
    // Normalize to 0-360
    newAngle = ((newAngle % 360) + 360) % 360;
    
    // Update angle in UserManager if available
    if (userManager) {
        userManager.updateUser(normalizedUserId, { angle: newAngle });
    }
    
    // Also update legacy activeUsers for backward compatibility
    if (activeUsers.has(normalizedUserId)) {
        const legacyUser = activeUsers.get(normalizedUserId);
        legacyUser.angle = newAngle;
        activeUsers.set(normalizedUserId, legacyUser);
    }
    
    addEvent('viewerMovement', {
        username,
        userId: normalizedUserId,
        angle: newAngle,
        direction,
        degrees
    });
    
    broadcastToWidget('viewerMovement', {
        username,
        userId: normalizedUserId,
        angle: newAngle,
        direction,
        degrees,
        speed: degrees
    });
    
    console.log(`🔄 ${username} moved ${direction > 0 ? 'clockwise' : 'counter-clockwise'} ${degrees}° to ${newAngle}°`);
}

function handleSpriteCommand(username, userId, spriteName) {
    if (!userId) return;
    const normalizedUserId = String(userId);
    const settings = loadSettings() || {};
    const rpgSprites = Array.isArray(settings.rpgSprites) ? settings.rpgSprites : [];
    const want = String(spriteName || '').toLowerCase().trim();
    if (!want) return;

    // Find matching RPG sprite object by name (preferred) or by filename.
    let selected = null;
    for (const s of rpgSprites) {
        if (!s) continue;
        const n = String(s.name || '').toLowerCase().trim();
        const f = String(s.filename || '').toLowerCase().trim();
        if (n === want || f === want || n.replace(/\s+/g, '') === want.replace(/\s+/g, '')) {
            selected = s;
            break;
        }
    }

    // If user passed a direct data url, allow it.
    if (!selected && /^data:image\//i.test(spriteName)) {
        selected = { name: 'custom', data: spriteName };
    }
    if (!selected) return;

    // Persist to UserPreferencesStore if available, otherwise use legacy file
    if (userPreferencesStore) {
        userPreferencesStore.set(normalizedUserId, { username, selectedSprite: selected });
    } else {
        const prefs = loadViewerPrefs();
        prefs[normalizedUserId] = { ...(prefs[normalizedUserId] || {}), username, selectedSprite: selected };
        saveViewerPrefsFile(prefs);
    }

    // Apply immediately if user is currently joined
    // Update UserManager if available
    if (userManager && userManager.hasUser(normalizedUserId)) {
        const user = userManager.getUser(normalizedUserId);
        if (user) {
            user.selectedSprite = selected;
        }
    }
    
    // Also update legacy activeUsers for backward compatibility
    if (activeUsers.has(normalizedUserId)) {
        const user = activeUsers.get(normalizedUserId);
        user.selectedSprite = selected;
        activeUsers.set(normalizedUserId, user);
    }
    
    addEvent('viewerSpriteChange', {
        username,
        userId: normalizedUserId,
        sprite: selected
    });
    
    broadcastToWidget('viewerSpriteChange', {
        username,
        userId: normalizedUserId,
        sprite: selected
    });
    
    console.log(`🎨 ${username} changed sprite to ${(selected && selected.name) || 'sprite'}`);
}

function handleSpriteCycleCommand(username, userId, delta) {
    if (!userId) return;
    const normalizedUserId = String(userId);
    const settings = loadSettings() || {};
    const spriteMode = String(settings.spriteMode || '').toLowerCase();
    // Only meaningful for RPG mode.
    if (spriteMode !== 'rpg-characters') return;
    const rpgSprites = Array.isArray(settings.rpgSprites) ? settings.rpgSprites : [];
    if (!rpgSprites.length) return;

    const prefs = loadViewerPrefs();
    const current = prefs[normalizedUserId] && prefs[normalizedUserId].selectedSprite ? prefs[normalizedUserId].selectedSprite : null;

    const currentData = current && typeof current === 'object' ? current.data : (typeof current === 'string' ? current : null);
    const idx = currentData ? rpgSprites.findIndex(s => s && s.data === currentData) : -1;
    const base = idx >= 0 ? idx : 0;
    const next = (base + (delta > 0 ? 1 : -1) + rpgSprites.length) % rpgSprites.length;
    const selected = rpgSprites[next];
    if (!selected) return;

    prefs[normalizedUserId] = { ...(prefs[normalizedUserId] || {}), username, selectedSprite: selected };
    saveViewerPrefsFile(prefs);

    if (activeUsers.has(normalizedUserId)) {
        const user = activeUsers.get(normalizedUserId);
        user.selectedSprite = selected;
        activeUsers.set(normalizedUserId, user);
    }

    addEvent('viewerSpriteChange', { username, userId: normalizedUserId, sprite: selected });
    broadcastToWidget('viewerSpriteChange', { username, userId: normalizedUserId, sprite: selected });
    console.log(`🎞️ ${username} sprite ${delta > 0 ? 'next' : 'back'} -> ${(selected && selected.name) || 'sprite'}`);
}

function handleColorCommand(username, userId, color) {
    // Parse color (hex, named color, etc.)
    const parsedColor = parseColor(color);
    if (!parsedColor) {
        return; // Invalid color
    }

    if (!userId) return;
    const normalizedUserId = String(userId);

    // Persist to viewer prefs (so it survives restarts).
    const prefs = loadViewerPrefs();
    prefs[normalizedUserId] = { ...(prefs[normalizedUserId] || {}), username, color: parsedColor };
    saveViewerPrefsFile(prefs);

    // Apply immediately if user is currently joined.
    if (activeUsers.has(normalizedUserId)) {
        const user = activeUsers.get(normalizedUserId);
        user.color = parsedColor;
        activeUsers.set(normalizedUserId, user);
    }
    
    addEvent('viewerColorChange', {
        username,
        userId: normalizedUserId,
        color: parsedColor
    });
    
    broadcastToWidget('viewerColorChange', {
        username,
        userId: normalizedUserId,
        color: parsedColor
    });
    
    console.log(`🎨 ${username} changed color to ${parsedColor}`);
}

// Action wrapper functions for unified command handling
function handleCwCommand(username, userId, message, tags) {
    const match = message.match(/!cw(?:\s+(\d+))?/);
    const degrees = match && match[1] ? parseInt(match[1]) : 17;
    handleMoveCommand(username, userId, 1, degrees);
}

function handleCcwCommand(username, userId, message, tags) {
    const match = message.match(/!ccw(?:\s+(\d+))?/);
    const degrees = match && match[1] ? parseInt(match[1]) : 17;
    handleMoveCommand(username, userId, -1, degrees);
}

function handleSpriteCommandAction(username, userId, message, tags) {
    const spriteName = message.replace(/!changesprite\s+|!sprite\s+/, '').trim();
    handleSpriteCommand(username, userId, spriteName);
}

function handleColorCommandAction(username, userId, message, tags) {
    const color = message.replace(/!changecolor\s+|!color\s+/, '').trim();
    handleColorCommand(username, userId, color);
}

function handleNextCommand(username, userId, message, tags) {
    handleSpriteCycleCommand(username, userId, 1);
}

function handleBackCommand(username, userId, message, tags) {
    handleSpriteCycleCommand(username, userId, -1);
}

function handleRandomCommand(username, userId, message, tags) {
    const settings = loadSettings();
    const spriteMode = String((settings && settings.spriteMode) || '').toLowerCase();
    if (spriteMode === 'rpg-characters') {
        const rpg = Array.isArray(settings.rpgSprites) ? settings.rpgSprites : [];
        if (rpg.length && userId) {
            const pick = rpg[Math.floor(Math.random() * rpg.length)];
            handleSpriteCommand(username, userId, pick?.name || pick?.filename || '');
        }
    } else {
        const rand = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
        handleColorCommand(username, userId, `#${rand()}${rand()}${rand()}`);
    }
}

async function handleResetCommand(username, userId, message, tags) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleResetCommand] Cannot process reset for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    const prefs = loadViewerPrefs();
    if (prefs[normalizedUserId]) {
        delete prefs[normalizedUserId].selectedSprite;
        delete prefs[normalizedUserId].color;
        delete prefs[normalizedUserId].still;
        saveViewerPrefsFile(prefs);
    }
    // Update userManager if available
    if (userManager && userManager.hasUser(normalizedUserId)) {
        userManager.updateUser(normalizedUserId, { selectedSprite: null, color: null, still: false });
    }
    // Also update legacy activeUsers for backward compatibility
    if (activeUsers.has(normalizedUserId)) {
        const u = activeUsers.get(normalizedUserId);
        u.selectedSprite = null;
        u.color = null;
        u.still = false;
        activeUsers.set(normalizedUserId, u);
    }
    broadcastToWidget('viewerSpriteChange', { username, userId: normalizedUserId, sprite: null });
    broadcastToWidget('viewerColorChange', { username, userId: normalizedUserId, color: null });
}

async function handleStillCommand(username, userId, message, tags) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleStillCommand] Cannot process still for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    // Check if user is joined OR if non-campers are allowed
    const isJoined = userManager
        ? userManager.hasUser(normalizedUserId)
        : activeUsers.has(normalizedUserId);
    const botMsg = botMessagesCache.find(msg => msg.id === 'still');
    const allowNonCampers = botMsg && botMsg.allowNonCampers;

    if (!isJoined && !allowNonCampers) {
        return; // Command not allowed for non-joined users
    }

    // For joined users, change their movement state
    if (isJoined) {
        const prefs = loadViewerPrefs();
        prefs[normalizedUserId] = { ...(prefs[normalizedUserId] || {}), username, still: true, roaming: false, wander: false };
        saveViewerPrefsFile(prefs);
        // Update userManager if available
        if (userManager && userManager.hasUser(normalizedUserId)) {
            userManager.updateUser(normalizedUserId, { still: true, roaming: false, wander: false });
        }
        // Also update legacy activeUsers for backward compatibility
        if (activeUsers.has(normalizedUserId)) {
            const u = activeUsers.get(normalizedUserId);
            u.still = true;
            u.roaming = false;
            u.wander = false;
            activeUsers.set(normalizedUserId, u);
        }
        try {
            executeInWidget(`
                window.postMessage({ type: 'memberMovement', userId: '${normalizedUserId}', still: true, roaming: false, wander: false }, '*');
            `);
        } catch (e) { /* ignore */ }
    }

    // Send message to all destinations (following handleSpinCommand pattern)
    const msg = (botMsg ? botMsg.message : '{username} is now still.').replace('{username}', username);
    if (botMsg && !botMsg.silent) {
        await sayInChannel(msg, 'bot', true);
    }
    // Send to Popout Chat (if respondAllChats/Pop Out Chat toggle is ON)
    if (botMsg && botMsg.respondAllChats) {
        sendToPopoutChat({
            username: '',
            message: msg,
            userId: null,
            emotes: null,
            allowBubble: false,
            isAction: true,
            displayName: '',
            color: null,
            commandCategory: 'MOVEMENT'
        });
    }
    // Always send to dashboard Internal Chat
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: msg,
            userId: null,
            isAction: true,
            commandCategory: 'MOVEMENT',
            isBotResponse: true
        });
    }
    
    console.log(`🧍 ${username} is now still`);
}

async function handleRoamCommand(username, userId, message, tags) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleRoamCommand] Cannot process roam for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    // Check if user is joined OR if non-campers are allowed
    const isJoined = userManager
        ? userManager.hasUser(normalizedUserId)
        : activeUsers.has(normalizedUserId);
    const botMsg = botMessagesCache.find(msg => msg.id === 'roam');
    const allowNonCampers = botMsg && botMsg.allowNonCampers;

    if (!isJoined && !allowNonCampers) {
        return; // Command not allowed for non-joined users
    }

    // For joined users, change their movement state
    if (isJoined) {
        const prefs = loadViewerPrefs();
        prefs[normalizedUserId] = { ...(prefs[normalizedUserId] || {}), username, still: false, roaming: true, wander: false };
        saveViewerPrefsFile(prefs);
        // Update userManager if available
        if (userManager && userManager.hasUser(normalizedUserId)) {
            userManager.updateUser(normalizedUserId, { still: false, roaming: true, wander: false });
        }
        // Also update legacy activeUsers for backward compatibility
        if (activeUsers.has(normalizedUserId)) {
            const u = activeUsers.get(normalizedUserId);
            u.still = false;
            u.roaming = true;
            u.wander = false;
            activeUsers.set(normalizedUserId, u);
        }
        try {
            executeInWidget(`
                window.postMessage({ type: 'memberMovement', userId: '${normalizedUserId}', still: false, roaming: true, wander: false }, '*');
            `);
        } catch (e) { /* ignore */ }
    }

    // Send message to all destinations (following handleSpinCommand pattern)
    const msg = (botMsg ? botMsg.message : '{username} is now roaming.').replace('{username}', username);
    if (botMsg && !botMsg.silent) {
        await sayInChannel(msg, 'bot', true);
    }
    // Send to Popout Chat (if respondAllChats/Pop Out Chat toggle is ON)
    if (botMsg && botMsg.respondAllChats) {
        sendToPopoutChat({
            username: '',
            message: msg,
            userId: null,
            emotes: null,
            allowBubble: false,
            isAction: true,
            displayName: '',
            color: null,
            commandCategory: 'MOVEMENT'
        });
    }
    // Always send to dashboard Internal Chat
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: msg,
            userId: null,
            isAction: true,
            commandCategory: 'MOVEMENT',
            isBotResponse: true
        });
    }
    
    console.log(`🚶 ${username} is now roaming`);
}

async function handleWanderCommand(username, userId, message, tags) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleWanderCommand] Cannot process wander for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    // Check if user is joined OR if non-campers are allowed
    const isJoined = userManager
        ? userManager.hasUser(normalizedUserId)
        : activeUsers.has(normalizedUserId);
    const botMsg = botMessagesCache.find(msg => msg.id === 'wander');
    const allowNonCampers = botMsg && botMsg.allowNonCampers;

    if (!isJoined && !allowNonCampers) {
        return; // Command not allowed for non-joined users
    }

    // For joined users, change their movement state
    if (isJoined) {
        const prefs = loadViewerPrefs();
        prefs[normalizedUserId] = { ...(prefs[normalizedUserId] || {}), username, still: false, roaming: false, wander: true };
        saveViewerPrefsFile(prefs);
        // Update userManager if available
        if (userManager && userManager.hasUser(normalizedUserId)) {
            userManager.updateUser(normalizedUserId, { still: false, roaming: false, wander: true });
        }
        // Also update legacy activeUsers for backward compatibility
        if (activeUsers.has(normalizedUserId)) {
            const u = activeUsers.get(normalizedUserId);
            u.still = false;
            u.roaming = false;
            u.wander = true;
            activeUsers.set(normalizedUserId, u);
        }
        try {
            executeInWidget(`
                window.postMessage({ type: 'memberMovement', userId: '${normalizedUserId}', still: false, roaming: false, wander: true }, '*');
            `);
        } catch (e) { /* ignore */ }
    }

    // Send message to all destinations (following handleSpinCommand pattern)
    const msg = (botMsg ? botMsg.message : '{username} is now wandering.').replace('{username}', username);
    if (botMsg && !botMsg.silent) {
        await sayInChannel(msg, 'bot', true);
    }
    // Send to Popout Chat (if respondAllChats/Pop Out Chat toggle is ON)
    if (botMsg && botMsg.respondAllChats) {
        sendToPopoutChat({
            username: '',
            message: msg,
            userId: null,
            emotes: null,
            allowBubble: false,
            isAction: true,
            displayName: '',
            color: null,
            commandCategory: 'MOVEMENT'
        });
    }
    // Always send to dashboard Internal Chat
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: msg,
            userId: null,
            isAction: true,
            commandCategory: 'MOVEMENT',
            isBotResponse: true
        });
    }
    
    console.log(`🌲 ${username} is now wandering`);
}

async function handleSpinCommand(username, userId, message, tags) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleSpinCommand] Cannot process spin for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    const isJoined = isUserJoined(realTwitchId, username);
    const botMsg = botMessagesCache.find(msg => msg.id === 'spin');
    const allowNonCampers = botMsg && botMsg.allowNonCampers;
    
    // Check if user is allowed to use this command
    if (!isJoined && !allowNonCampers) return;
    
    // Only trigger animation if user is joined
    if (isJoined) {
        await triggerSpinInWidget(userId, username);
    }
    
    const msg = (botMsg ? botMsg.message : '{username} spins!').replace('{username}', username);
    if (botMsg && !botMsg.silent) {
        await sayInChannel(msg, 'bot', true);
    }
    // Send to Popout Chat (if respondAllChats/Pop Out Chat toggle is ON)
    if (botMsg && botMsg.respondAllChats) {
        sendToPopoutChat({
            username: '',
            message: msg,
            userId: null,
            emotes: null,
            allowBubble: false,
            isAction: true,
            displayName: '',
            color: null,
            commandCategory: 'ANIMATION'
        });
    }
    // Always send to dashboard Internal Chat
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: msg,
            userId: null,
            isAction: true,
            commandCategory: 'ANIMATION',
            isBotResponse: true
        });
    }
}

async function handleDanceCommand(username, userId, message, tags) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleDanceCommand] Cannot process dance for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    const isJoined = isUserJoined(realTwitchId, username);
    const botMsg = botMessagesCache.find(msg => msg.id === 'dance');
    const allowNonCampers = botMsg && botMsg.allowNonCampers;
    
    // Check if user is allowed to use this command
    if (!isJoined && !allowNonCampers) return;
    
    // Only trigger animation if user is joined
    if (isJoined) {
        await triggerDanceInWidget(userId, username);
    }
    
    const msg = (botMsg ? botMsg.message : '{username} dances!').replace('{username}', username);
    if (botMsg && !botMsg.silent) {
        await sayInChannel(msg, 'bot', true);
    }
    // Send to Popout Chat (if respondAllChats/Pop Out Chat toggle is ON)
    if (botMsg && botMsg.respondAllChats) {
        sendToPopoutChat({
            username: '',
            message: msg,
            userId: null,
            emotes: null,
            allowBubble: false,
            isAction: true,
            displayName: '',
            color: null,
            commandCategory: 'ANIMATION'
        });
    }
    // Always send to dashboard Internal Chat
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: msg,
            userId: null,
            isAction: true,
            commandCategory: 'ANIMATION',
            isBotResponse: true
        });
    }
}

async function handleSparkleCommand(username, userId, message, tags) {
    // Get the real Twitch ID - no placeholders allowed
    const realTwitchId = getRealTwitchId(username, userId);
    if (!realTwitchId) {
        console.warn(`[handleSparkleCommand] Cannot process sparkle for ${username} - no real Twitch ID available`);
        return;
    }
    const normalizedUserId = realTwitchId;
    const isJoined = isUserJoined(realTwitchId, username);
    const botMsg = botMessagesCache.find(msg => msg.id === 'sparkle');
    const allowNonCampers = botMsg && botMsg.allowNonCampers;
    
    // Check if user is allowed to use this command
    if (!isJoined && !allowNonCampers) return;
    
    // Only trigger animation if user is joined
    if (isJoined) {
        await triggerSparkleInWidget(userId, username);
    }
    
    const msg = (botMsg ? botMsg.message : '{username} sparkles! ✨').replace('{username}', username);
    if (botMsg && !botMsg.silent) {
        await sayInChannel(msg, 'bot', true);
    }
    // Send to Popout Chat (if respondAllChats/Pop Out Chat toggle is ON)
    if (botMsg && botMsg.respondAllChats) {
        sendToPopoutChat({
            username: '',
            message: msg,
            userId: null,
            emotes: null,
            allowBubble: false,
            isAction: true,
            displayName: '',
            color: null,
            commandCategory: 'ANIMATION'
        });
    }
    // Always send to dashboard Internal Chat
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: msg,
            userId: null,
            isAction: true,
            commandCategory: 'ANIMATION',
            isBotResponse: true
        });
    }
}

/**
 * Handle the !who command - lists users around the campfire with their statuses
 * @param {string} username - The username who triggered the command
 * @param {string} userId - The user ID who triggered the command
 * @param {string} message - The full message
 * @param {Object} tags - Twitch IRC tags
 */
async function handleWhoCommand(username, userId, message, tags) {
    // Get the !who command configuration from cache
    const whoCmd = botMessagesCache.find(cmd => cmd.id === 'who');
    if (!whoCmd || !whoCmd.enabled) {
        console.log('[handleWhoCommand] !who command is disabled');
        return;
    }
    
    // Get all joined users from userManager (preferred) or activeUsers (fallback)
    let joinedUsers = [];
    
    if (userManager) {
        // Use userManager - the authoritative source
        const allUsers = userManager.getAllUsers();
        joinedUsers = allUsers.filter(user => {
            // Filter to only users who have joined the campfire (not IN_CHAT)
            const state = user.state || user._state || 'IN_CHAT';
            return state !== 'IN_CHAT';
        });
        console.log(`[handleWhoCommand] Found ${joinedUsers.length} joined users from userManager (total: ${allUsers.length})`);
    } else {
        // Fallback to activeUsers
        joinedUsers = Array.from(activeUsers.values()).filter(user => {
            // Check various state properties
            const state = user.state || user.userState || user._state;
            return state && state !== 'IN_CHAT';
        });
        console.log(`[handleWhoCommand] Found ${joinedUsers.length} joined users from activeUsers (fallback)`);
    }
    
    if (joinedUsers.length === 0) {
        const emptyMsg = '🔥 No one is around the campfire yet. Use !join to join!';
        
        // Send to Twitch chat
        if (!whoCmd.silent) {
            await sayInChannel(emptyMsg, 'bot', true);
        }
        
        // Send to Popout Chat
        if (whoCmd.respondAllChats) {
            sendToPopoutChat({
                username: '',
                message: emptyMsg,
                userId: null,
                emotes: null,
                allowBubble: false,
                isAction: true,
                displayName: '',
                color: null,
                commandCategory: 'INFO'
            });
        }
        
        // Send to dashboard
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('twitchChatMessage', {
                username: '',
                message: emptyMsg,
                userId: null,
                isAction: true,
                commandCategory: 'INFO',
                isBotResponse: true
            });
        }
        return;
    }
    
    // Build the user list with status icons
    // Get customizable state icons from command config (or use defaults)
    const defaultStateIcons = {
        'JOINED': '🔥',
        'ACTIVE': '🔥',
        'SLEEPY': '😴',
        'AFK': '💤',
        'LURK': '👁️',
        'BOT': '🤖'
    };
    // Merge with defaults to ensure all states have icons
    const stateIcons = { ...defaultStateIcons, ...(whoCmd.stateIcons || {}) };
    
    console.log('[handleWhoCommand] State icons:', JSON.stringify(stateIcons));
    
    // Get state filters from command config (which states to include)
    const defaultStateFilters = { JOINED: true, ACTIVE: true, SLEEPY: true, AFK: true, LURK: true };
    const stateFilters = whoCmd.stateFilters || defaultStateFilters;
    
    // Helper to get user state (handles both User class and plain objects)
    const getUserState = (user) => {
        // User class has state getter that returns _state
        if (typeof user.state === 'string') return user.state;
        if (typeof user._state === 'string') return user._state;
        if (typeof user.userState === 'string') return user.userState.toUpperCase();
        return 'ACTIVE';
    };
    
    // Filter users based on state filters
    const filteredUsers = joinedUsers.filter(user => {
        const state = getUserState(user);
        return stateFilters[state] !== false; // Include if not explicitly false
    });
    
    if (filteredUsers.length === 0) {
        const emptyMsg = '🔥 No one matching the filter is around the campfire.';
        
        // Send to Twitch chat
        if (!whoCmd.silent) {
            await sayInChannel(emptyMsg, 'bot', true);
        }
        
        // Send to Popout Chat
        if (whoCmd.respondAllChats) {
            sendToPopoutChat({
                username: '',
                message: emptyMsg,
                userId: null,
                emotes: null,
                allowBubble: false,
                isAction: true,
                displayName: '',
                color: null,
                commandCategory: 'INFO'
            });
        }
        
        // Send to dashboard
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('twitchChatMessage', {
                username: '',
                message: emptyMsg,
                userId: null,
                isAction: true,
                commandCategory: 'INFO',
                isBotResponse: true
            });
        }
        return;
    }
    
    // Get the user line format from command config (customizable by streamer)
    // Supports placeholders: {icon}, {username}, {state}
    const userLineFormat = whoCmd.userLineFormat || '{icon} {username}';
    
    // Get the separator from command config (for inline display)
    const userSeparator = whoCmd.userSeparator || ' • ';
    
    // Sort users by state priority: ACTIVE -> SLEEPY -> LURK -> AFK -> BOTS
    const statePriority = {
        'ACTIVE': 1,
        'JOINED': 1,  // JOINED is same as ACTIVE for display purposes
        'SLEEPY': 2,
        'LURK': 3,
        'AFK': 4
    };
    
    // Helper to check if user is a bot (configured bot account or has bot badge)
    const isBotUser = (user) => {
        // Check if this is the configured CHAT BOT account (separate bot speaker)
        // Note: chatBotUsername is the separate bot account for sending messages,
        // while botUsername is the main Twitch connection account (streamer)
        const botUsername = twitchConfig?.chatBotUsername?.toLowerCase();
        if (botUsername && user.username?.toLowerCase() === botUsername) {
            return true;
        }
        // Check for bot badge in user roles/tags
        if (user.roles?.isBot || user.tags?.badges?.bot === '1' || user.tags?.badges?.verified === '1') {
            return true;
        }
        return false;
    };
    
    // Sort filtered users by priority (bots last)
    const sortedUsers = [...filteredUsers].sort((a, b) => {
        const aIsBot = isBotUser(a);
        const bIsBot = isBotUser(b);
        
        // Bots always go to the end
        if (aIsBot && !bIsBot) return 1;
        if (!aIsBot && bIsBot) return -1;
        
        // Both bots or both non-bots: sort by state priority
        const aState = getUserState(a);
        const bState = getUserState(b);
        const aPriority = statePriority[aState] || 5;
        const bPriority = statePriority[bState] || 5;
        
        return aPriority - bPriority;
    });
    
    // Format: each user with status icon
    const userLines = sortedUsers.map(user => {
        const state = getUserState(user);
        const isBot = isBotUser(user);
        
        // Use BOT icon if user is a bot, otherwise use their state icon
        const icon = isBot 
            ? (stateIcons['BOT'] || '🤖') 
            : (stateIcons[state] || stateIcons['ACTIVE'] || '🔥');
        const displayName = user.displayName || user.username;
        
        // Debug logging
        console.log(`[handleWhoCommand] User: ${displayName}, State: ${state}, IsBot: ${isBot}, Icon: ${icon}`);
        
        // Apply the customizable format
        return userLineFormat
            .replace('{icon}', icon)
            .replace('{username}', displayName)
            .replace('{state}', state.toLowerCase());
    });
    
    // Get the header message from command config (customizable by streamer)
    const headerMsg = whoCmd.message || '🔥 Around the campfire:';
    
    // Build full message - header + users inline with separator
    // For Twitch chat, we need to be mindful of message length limits (500 chars)
    const fullMessage = headerMsg + ' ' + userLines.join(userSeparator);
    
    // If message is too long for Twitch, truncate and add count
    const MAX_TWITCH_LENGTH = 450;
    let twitchMessage = fullMessage;
    if (twitchMessage.length > MAX_TWITCH_LENGTH) {
        // Show count instead of full list for Twitch
        const countByState = {};
        filteredUsers.forEach(user => {
            const state = getUserState(user);
            countByState[state] = (countByState[state] || 0) + 1;
        });
        
        const stateCounts = [];
        if (countByState['ACTIVE'] || countByState['JOINED']) {
            stateCounts.push(`${(countByState['ACTIVE'] || 0) + (countByState['JOINED'] || 0)} active`);
        }
        if (countByState['SLEEPY']) stateCounts.push(`${countByState['SLEEPY']} sleepy`);
        if (countByState['AFK']) stateCounts.push(`${countByState['AFK']} AFK`);
        if (countByState['LURK']) stateCounts.push(`${countByState['LURK']} lurking`);
        
        twitchMessage = `🔥 ${filteredUsers.length} campers: ${stateCounts.join(', ')}`;
    }
    
    // Send to Twitch chat
    if (!whoCmd.silent) {
        await sayInChannel(twitchMessage, 'bot', true);
    }
    
    // Send to Popout Chat (full message with line breaks)
    if (whoCmd.respondAllChats) {
        sendToPopoutChat({
            username: '',
            message: fullMessage,
            userId: null,
            emotes: null,
            allowBubble: false,
            isAction: true,
            displayName: '',
            color: null,
            commandCategory: 'INFO'
        });
    }
    
    // Send to dashboard (full message)
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: fullMessage,
            userId: null,
            isAction: true,
            commandCategory: 'INFO',
            isBotResponse: true
        });
    }
    
    console.log(`[handleWhoCommand] Listed ${filteredUsers.length} users around the campfire (${joinedUsers.length} total joined)`);
}

function parseColor(colorInput) {
    // Handle hex colors
    if (colorInput.startsWith('#')) {
        return colorInput;
    }
    
    // Handle named colors (basic set)
    const namedColors = {
        'red': '#ff0000',
        'blue': '#0000ff',
        'green': '#00ff00',
        'yellow': '#ffff00',
        'purple': '#800080',
        'orange': '#ffa500',
        'pink': '#ffc0cb',
        'white': '#ffffff',
        'black': '#000000',
        'cyan': '#00ffff',
        'magenta': '#ff00ff',
        'lime': '#00ff00',
        'navy': '#000080',
        'maroon': '#800000',
        'olive': '#808000',
        'teal': '#008080',
        'silver': '#c0c0c0',
        'gray': '#808080',
        'grey': '#808080'
    };
    
    const lowerColor = colorInput.toLowerCase();
    if (namedColors[lowerColor]) {
        return namedColors[lowerColor];
    }
    
    // Try to parse as hex without #
    if (/^[0-9a-f]{6}$/i.test(colorInput)) {
        return '#' + colorInput;
    }
    
    return null; // Invalid color
}

/**
 * Handle the !duel command - two users duel, random winner
 * @param {string} username - The username who triggered the command
 * @param {string} userId - The user ID who triggered the command
 * @param {string} message - The full message (e.g., "!duel @targetuser")
 * @param {Object} tags - Twitch IRC tags
 */
async function handleDuelCommand(username, userId, message, tags) {
    // Get the !duel command configuration from cache
    const duelCmd = botMessagesCache.find(cmd => cmd.id === 'duel');
    if (!duelCmd || !duelCmd.enabled) {
        console.log('[handleDuelCommand] !duel command is disabled');
        return;
    }
    
    // Check cooldown
    const cooldownCheck = checkCommandCooldown('duel', userId, duelCmd);
    if (cooldownCheck.onCooldown) {
        console.log(`[handleDuelCommand] ${username} is on cooldown (${cooldownCheck.remainingSeconds}s remaining)`);
        return;
    }
    
    // Extract target user from message (e.g., "!duel @username" or "!duel username")
    const targetMatch = message.match(/@?(\w+)/g);
    let targetUsername = null;
    
    if (targetMatch && targetMatch.length > 1) {
        // First match is the command itself (!duel), second is the target
        targetUsername = targetMatch[1];
    }
    
    if (!targetUsername) {
        console.log(`[handleDuelCommand] No target specified by ${username}`);
        const errorMsg = `@${username} You need to specify who to duel! Usage: !duel @username`;
        if (!duelCmd.silent) {
            await sayInChannel(errorMsg, 'bot', false);
        }
        return;
    }
    
    // Prevent dueling yourself
    if (targetUsername.toLowerCase() === username.toLowerCase()) {
        const selfMsg = `@${username} You can't duel yourself!`;
        if (!duelCmd.silent) {
            await sayInChannel(selfMsg, 'bot', false);
        }
        return;
    }
    
    // Determine winner randomly (50/50 chance)
    const challengerWins = Math.random() < 0.5;
    const winner = challengerWins ? username : targetUsername;
    const loser = challengerWins ? targetUsername : username;
    
    // Build response message
    const responseTemplate = duelCmd.message || '{winner} defeats {loser} in a duel! ⚔️';
    const responseMsg = responseTemplate
        .replace('{winner}', winner)
        .replace('{loser}', loser)
        .replace('{challenger}', username)
        .replace('{target}', targetUsername);
    
    // Update cooldown
    updateCommandCooldown('duel', userId, duelCmd);
    
    // Send to Twitch chat
    if (!duelCmd.silent) {
        await sayInChannel(responseMsg, 'bot', true);
    }
    
    // Send to Popout Chat
    if (duelCmd.respondAllChats) {
        sendToPopoutChat({
            username: '',
            message: responseMsg,
            userId: null,
            emotes: null,
            allowBubble: false,
            isAction: true,
            displayName: '',
            color: null,
            commandCategory: 'GAME'
        });
    }
    
    // Always send to dashboard Internal Chat
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: responseMsg,
            userId: null,
            isAction: true,
            commandCategory: 'GAME',
            isBotResponse: true
        });
    }
    
    console.log(`[handleDuelCommand] ${username} challenged ${targetUsername}, ${winner} won`);
}

/**
 * Handle the !roll command - roll a random number
 * @param {string} username - The username who triggered the command
 * @param {string} userId - The user ID who triggered the command
 * @param {string} message - The full message (e.g., "!roll 100" or "!roll")
 * @param {Object} tags - Twitch IRC tags
 */
async function handleRollCommand(username, userId, message, tags) {
    // Get the !roll command configuration from cache
    const rollCmd = botMessagesCache.find(cmd => cmd.id === 'roll');
    if (!rollCmd || !rollCmd.enabled) {
        console.log('[handleRollCommand] !roll command is disabled');
        return;
    }
    
    // Check cooldown
    const cooldownCheck = checkCommandCooldown('roll', userId, rollCmd);
    if (cooldownCheck.onCooldown) {
        console.log(`[handleRollCommand] ${username} is on cooldown (${cooldownCheck.remainingSeconds}s remaining)`);
        return;
    }
    
    // Parse max value from message (default 100)
    const match = message.match(/!roll\s*(\d+)?/);
    const maxValue = match && match[1] ? parseInt(match[1], 10) : 100;
    
    // Validate max value
    if (maxValue < 1 || maxValue > 1000000) {
        const errorMsg = `@${username} Please use a number between 1 and 1,000,000!`;
        if (!rollCmd.silent) {
            await sayInChannel(errorMsg, 'bot', false);
        }
        return;
    }
    
    // Generate random roll
    const roll = Math.floor(Math.random() * maxValue) + 1;
    
    // Build response message
    const responseTemplate = rollCmd.message || '{username} rolls {roll} (1-{max}) 🎲';
    const responseMsg = responseTemplate
        .replace('{username}', username)
        .replace('{roll}', roll)
        .replace('{max}', maxValue);
    
    // Update cooldown
    updateCommandCooldown('roll', userId, rollCmd);
    
    // Send to Twitch chat
    if (!rollCmd.silent) {
        await sayInChannel(responseMsg, 'bot', true);
    }
    
    // Send to Popout Chat
    if (rollCmd.respondAllChats) {
        sendToPopoutChat({
            username: '',
            message: responseMsg,
            userId: null,
            emotes: null,
            allowBubble: false,
            isAction: true,
            displayName: '',
            color: null,
            commandCategory: 'GAME'
        });
    }
    
    // Always send to dashboard Internal Chat
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: responseMsg,
            userId: null,
            isAction: true,
            commandCategory: 'GAME',
            isBotResponse: true
        });
    }
    
    console.log(`[handleRollCommand] ${username} rolled ${roll} (1-${maxValue})`);
}

async function getViewerColor(username, userId) {
    // First, try to get color from widget's localStorage (most up-to-date)
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        try {
            const widgetColors = await executeInWidget(`
                try {
                    const saved = window.localStorage.getItem('allViewerColors');
                    if (saved) {
                        const viewerColors = JSON.parse(saved);
                        if (userId && viewerColors[userId]) return viewerColors[userId].color;
                        for (const key in viewerColors) {
                            const user = viewerColors[key];
                            if (user && (user.username === username || user.displayName === username))
                                return user.color;
                        }
                    }
                } catch (e) { console.error('Error reading colors from widget:', e); }
                return null;
            `, { userId: userId || '', username: username || '' });
            if (widgetColors) {
                return widgetColors;
            }
        } catch (e) {
            console.error('[Main Process] Error getting color from widget:', e);
        }
    }
    
    // Fallback: viewer-prefs.json (saved from Viewer Dashboard)
    try {
        const prefs = loadViewerPrefs();
        if (prefs[userId] && prefs[userId].color) return prefs[userId].color;
    } catch (e) { /* ignore */ }

    // Fallback: viewer-colors.json (legacy)
    try {
        if (fs.existsSync(path.join(userDataPath, 'viewer-colors.json'))) {
            const colors = JSON.parse(fs.readFileSync(path.join(userDataPath, 'viewer-colors.json'), 'utf8'));
            if (colors[userId]) return colors[userId];
        }
    } catch (e) { /* ignore */ }
    
    // Generate hex from username hash (last resort; widget's adjustColor expects hex)
    let hash = 0;
    const n = String(username || '');
    for (let i = 0; i < n.length; i++) {
        hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360) / 360;
    const s = 0.7;
    const l = 0.6;
    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    const toHex = (x) => { const h = Math.max(0, Math.min(255, Math.round(x))).toString(16); return h.length === 1 ? '0' + h : h; };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ============================================
// EVENT SYSTEM
// ============================================

function addEvent(type, data) {
    const event = {
        id: ++lastEventId,
        type,
        data,
        timestamp: Date.now()
    };
    
    events.push(event);
    
    // Keep only last 100 events
    if (events.length > 100) {
        events.shift();
    }

    // Keep Live Preview in sync with the widget (Visual Display is source of truth)
    if (type === 'userJoin' || type === 'userLeave' || type === 'userKick') {
        scheduleDashboardPreviewSync();
        scheduleWidgetFullStateSync();
    }
}

function broadcastToWidget(channel, data) {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send(channel, data);
    }
    // Also send chat messages to the chat popout window (for regular user messages)
    // Bot responses are handled separately via sendToPopoutChat
    if (channel === 'chatMessage') {
        // Check if this message should be shown in popout chat
        // (_shouldShowInPopout is false for commands with silent: true)
        const shouldShowInPopout = data._shouldShowInPopout !== false;
        
        // Only proceed if we should show in popout chat
        if (!shouldShowInPopout) {
            return; // Skip popout chat for silent commands
        }
        
        // Add isCamper flag for grey non-campers feature
        const enhancedData = { ...data, timestamp: Date.now() };
        // Remove internal flag before sending
        delete enhancedData._shouldShowInPopout;
        
        if (data.userId) {
            enhancedData.isCamper = activeUsers.has(String(data.userId));
        } else if (data.username) {
            // Check by username if no userId
            const userEntry = Array.from(activeUsers.values()).find(u =>
                u.username && u.username.toLowerCase() === data.username.toLowerCase()
            );
            enhancedData.isCamper = !!userEntry;
        } else {
            enhancedData.isCamper = true; // Bot messages are always "campers"
        }
        
        // Add to chat buffer for persistence
        addToChatBuffer(enhancedData);
        
        // Send to popout if open
        if (chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
            chatPopoutWindow.webContents.send(channel, enhancedData);
        }
    }
    
    // Send user-related events to buddy list window for real-time updates
    const userChannels = ['userJoin', 'userLeave', 'userStateChange', 'userKick', 'userActive', 'userAway', 'userSleepy'];
    if (userChannels.includes(channel) && buddyListWindow && !buddyListWindow.isDestroyed()) {
        buddyListWindow.webContents.send(channel, data);
    }
}

/**
 * Add a message to the chat buffer for persistence
 * @param {Object} messageData - The message data to buffer
 */
function addToChatBuffer(messageData) {
    chatMessageBuffer.push(messageData);
    
    // Trim buffer if it exceeds max size
    if (chatMessageBuffer.length > CHAT_BUFFER_MAX_SIZE) {
        chatMessageBuffer.shift();
    }
}

/**
 * Get chat history from the buffer
 * @returns {Array} Array of buffered chat messages
 */
function getChatHistory() {
    return [...chatMessageBuffer];
}

/**
 * Send a message directly to the popout chat window
 * Used for bot responses that respect the respondAllChats (Pop Out Chat) toggle
 * @param {Object} data - Message data
 * @param {string} data.message - The message text
 * @param {string} data.username - Username (empty for bot messages)
 * @param {string} data.commandCategory - Category for italic formatting (STATE, ANIMATION, MOVEMENT, APPEARANCE)
 * @param {boolean} data.isAction - Whether to display as action/italic
 */
function sendToPopoutChat(data) {
    // Add command category for special formatting
    const enhancedData = {
        ...data,
        timestamp: Date.now(),
        isCamper: true, // Bot messages are always treated as "camper" messages
        commandCategory: data.commandCategory || null
    };
    
    // Always buffer bot messages for persistence (even if popout is closed)
    addToChatBuffer(enhancedData);
    
    // Send to popout if open
    if (chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
        chatPopoutWindow.webContents.send('chatMessage', enhancedData);
    }
}

/**
 * Command categories that should be displayed in italics without bot name prefix
 */
const ITALIC_COMMAND_CATEGORIES = ['STATE', 'ANIMATION', 'MOVEMENT', 'APPEARANCE'];

/**
 * Check if a command category should use italic formatting
 */
function shouldUseItalicFormat(category) {
    return ITALIC_COMMAND_CATEGORIES.includes(category);
}

/**
 * Execute JS in the WIDGET window. The widget loads widget.html directly (no iframe).
 * State is on window.widget / window.campfireWidget and window.localStorage.
 * @param {string} jsBody - JavaScript to run. Has access to window, localStorage.
 * @param {Object} [injectedVars] - Optional { key: value } to inject as const. Values are JSON.stringify'd for safety.
 */
async function executeInWidget(jsBody, injectedVars = null) {
    if (!widgetWindow || widgetWindow.isDestroyed()) return null;
    const inj = injectedVars && Object.keys(injectedVars).length
        ? Object.entries(injectedVars).map(([k, v]) => `const ${k} = ${JSON.stringify(v)};`).join(' ')
        : '';
    const wrapped = `
        (function() {
            ${inj}
            return (function() { ${jsBody} })();
        })();
    `;
    return await widgetWindow.webContents.executeJavaScript(wrapped);
}

let dashboardSyncTimeout = null;
async function syncDashboardPreviewFromWidget() {
    if (!dashboardWindow || dashboardWindow.isDestroyed()) return;
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    try {
        const widgetUsers = await executeInWidget(`
            const widget = window.widget || window.campfireWidget;
            if (widget && widget.users && Array.isArray(widget.users)) {
                return widget.users.map(u => {
                    if (!u || !u.username) return null;
                    return {
                        username: u.username || '',
                        userId: u.userId || (u.username ? u.username.toLowerCase() : ''),
                        color: u.color || null,
                        selectedSprite: u.selectedSprite || null,
                        angle: u.angle || 0
                    };
                }).filter(Boolean);
            }
            return [];
        `);
        dashboardWindow.webContents.send('sync-full-state', widgetUsers || []);
    } catch (error) {
        console.error('[Main Process] Error syncing preview from widget:', error);
    }
}

function scheduleDashboardPreviewSync() {
    if (!dashboardWindow || dashboardWindow.isDestroyed()) return;
    if (dashboardSyncTimeout) clearTimeout(dashboardSyncTimeout);
    dashboardSyncTimeout = setTimeout(() => {
        dashboardSyncTimeout = null;
        syncDashboardPreviewFromWidget();
    }, 100);
}

let widgetSyncTimeout = null;
function buildActiveUsersList() {
    // Use userManager if available, fall back to activeUsers
    const users = userManager ? userManager.getAllUsers() : Array.from(activeUsers.values());
    return users.map(user => {
        // For User objects from UserManager, use the sprite getter
        // For legacy objects from activeUsers, use selectedSprite
        const sprite = user.sprite || user.selectedSprite || null;
        return {
            username: user.username || '',
            userId: user.userId || (user.username ? user.username.toLowerCase() : ''),
            color: user.color || null,
            selectedSprite: sprite,
            twitchColor: user.twitchColor || null,
            angle: user.angle || 0,
            joinedAt: user.joinedAt || Date.now(),
            state: user.state || user.userState || 'joined', // Include state for dashboard sync
            source: user.source || 'unknown',
            roles: user.roles || null
        };
    });
}

function syncWidgetFullStateFromMain() {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    const users = buildActiveUsersList();
    broadcastToWidget('sync-full-state', users);
}

function scheduleWidgetFullStateSync() {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    if (widgetSyncTimeout) clearTimeout(widgetSyncTimeout);
    widgetSyncTimeout = setTimeout(() => {
        widgetSyncTimeout = null;
        syncWidgetFullStateFromMain();
    }, 100);
}

function updatePotentialMembersList() {
    // Throttle: avoid spamming large payloads on every chat message (helps Windows performance).
    if (updatePotentialMembersList._timer) return;
    updatePotentialMembersList._timer = setTimeout(() => {
        updatePotentialMembersList._timer = null;
        updatePotentialMembersListNow();
    }, 500);
}

function updatePotentialMembersListNow() {
    // Ensure the connected main account is always visible/active in Members list.
    try {
        const mainLogin = String(twitchConfig.botUsername || '').trim();
        if (mainLogin) {
            const key = mainLogin.toLowerCase();
            const existing = allChatters.get(key) || {};
            // Keep it "active" indefinitely so it never shows as inactive/not-in-chat.
            const foreverActiveTs = Date.now() + (365 * 24 * 60 * 60 * 1000); // +1 year
            
            // CRITICAL FIX: Only use existing.userId if it's a real Twitch ID (numeric)
            // Don't fall back to username as userId - this causes identity conflicts
            const existingUserId = existing.userId;
            const isRealTwitchId = existingUserId && /^\d+$/.test(String(existingUserId));
            
            allChatters.set(key, {
                ...(existing || {}),
                username: existing.username || mainLogin,
                // Preserve real Twitch userId if we have one, otherwise keep null (not username!)
                userId: isRealTwitchId ? existingUserId : (existing.userId || null),
                joinedAt: existing.joinedAt || Date.now(),
                lastMessage: foreverActiveTs,
                // Mark broadcaster so join/bubble allowlists treat it as always allowed
                tags: { ...(existing.tags || {}), badges: { ...((existing.tags && existing.tags.badges) || {}), broadcaster: '1' } }
            });
        }
    } catch (e) { /* ignore */ }

    const chatters = Array.from(allChatters.values());
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('potentialMembersUpdate', chatters);
    }
    if (membersWindow && !membersWindow.isDestroyed()) {
        membersWindow.webContents.send('potentialMembersUpdate', chatters);
    }
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('potentialMembersUpdate', chatters);
    }
    if (buddyListWindow && !buddyListWindow.isDestroyed()) {
        buddyListWindow.webContents.send('potentialMembersUpdate', chatters);
    }
}

// ============================================
// SETTINGS MANAGEMENT
// ============================================

function loadSettings() {
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading settings:', e);
    }
    return {};
}

function saveSettings(settings) {
    try {
        const prev = loadSettings() || {};
        const prevTransparent = String(prev.widgetBackground || 'black').toLowerCase() === 'transparent';
        const nextTransparent = String(settings.widgetBackground || 'black').toLowerCase() === 'transparent';
        const prevFrame = prev.useNativeFrame !== false;
        const nextFrame = settings.useNativeFrame !== false;

        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        // Sync configurable commands to cache
        syncConfigurableCommands();
        // If the setting requires changing BrowserWindow creation flags (frame/transparent),
        // recreate the widget window to apply it.
        const needsRecreate = (prevTransparent !== nextTransparent) || (prevFrame !== nextFrame);
        if (needsRecreate) {
            recreateWidgetWindow({ settings });
        } else {
            broadcastToWidget('settingsUpdate', settings);
        }
        // Keep dashboard window in sync too (so Quick Settings + Dashboard mirror each other).
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('settingsUpdate', settings);
        }
    } catch (e) {
        console.error('Error saving settings:', e);
    }
}

function recreateWidgetWindow({ settings } = {}) {
    try {
        const existing = widgetWindow && !widgetWindow.isDestroyed() ? widgetWindow : null;
        const bounds = existing ? existing.getBounds() : null;

        const afterCreate = () => {
            createWidgetWindow();
            // Recreate complete: re-enable normal close behavior
            isRecreatingWidgetWindow = false;
            if (bounds && widgetWindow && !widgetWindow.isDestroyed()) {
                try { widgetWindow.setBounds(bounds); } catch (e) { /* ignore */ }
            }
            if (widgetWindow && !widgetWindow.isDestroyed()) {
                widgetWindow.webContents.once('did-finish-load', () => {
                    if (settings) {
                        try { broadcastToWidget('settingsUpdate', settings); } catch (e) { /* ignore */ }
                    }
                    try { scheduleWidgetFullStateSync(); } catch (e) { /* ignore */ }
                    try { updatePotentialMembersListNow(); } catch (e) { /* ignore */ }
                });
            }
        };

        if (existing) {
            isRecreatingWidgetWindow = true;
            existing.once('closed', afterCreate);
            existing.close();
        } else {
            afterCreate();
        }
    } catch (e) {
        console.error('[Main] recreateWidgetWindow error:', e);
        // Fall back: at least try to apply settings to the current window.
        try { broadcastToWidget('settingsUpdate', settings); } catch (e2) { /* ignore */ }
    }
}

function loadWindowDimensions() {
    const dimsPath = path.join(userDataPath, 'window-dimensions.json');
    console.log('[loadWindowDimensions] Loading from:', dimsPath);
    try {
        if (fs.existsSync(dimsPath)) {
            const data = JSON.parse(fs.readFileSync(dimsPath, 'utf8'));
            console.log('[loadWindowDimensions] Loaded:', data);
            return data;
        } else {
            console.log('[loadWindowDimensions] File does not exist, using defaults');
        }
    } catch (e) {
        console.error('[loadWindowDimensions] Error loading:', e);
    }
    return { width: 1920, height: 1080, locked: true };
}

function saveWindowDimensions() {
    const dimsPath = path.join(userDataPath, 'window-dimensions.json');
    console.log('[saveWindowDimensions] Saving to:', dimsPath, 'Data:', windowDimensions);
    try {
        fs.writeFileSync(dimsPath, JSON.stringify(windowDimensions, null, 2));
        console.log('[saveWindowDimensions] Saved successfully');
    } catch (e) {
        console.error('[saveWindowDimensions] Error saving:', e);
    }
}

// ============================================
// IPC HANDLERS
// ============================================

// Window management
ipcMain.handle('open-dashboard', (event, tab) => {
    console.log('[Main] open-dashboard IPC called with tab:', tab);
    createDashboardWindow(tab);
    return { success: true };
});

ipcMain.handle('open-members-window', () => {
    createMembersWindow();
    return { success: true };
});

ipcMain.handle('open-chat-popout', () => {
    createChatPopoutWindow();
    return { success: true };
});

// Get chat history for popout persistence
ipcMain.handle('get-chat-history', () => {
    return getChatHistory();
});

ipcMain.handle('bring-chat-popout-to-front', () => {
    if (chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
        chatPopoutWindow.show();
        chatPopoutWindow.focus();
        chatPopoutWindow.moveTop();
        return { success: true };
    }
    return { success: false, error: 'Chat popout window not open' };
});

// Bring widget window to front (used by chat popout "Front" button)
ipcMain.handle('bring-widget-to-front', () => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.show();
        widgetWindow.focus();
        widgetWindow.moveTop();
        widgetWindow.setAlwaysOnTop(true);
        // Reset always on top after a brief moment so it doesn't stay pinned
        setTimeout(() => {
            if (widgetWindow && !widgetWindow.isDestroyed()) {
                widgetWindow.setAlwaysOnTop(false);
            }
        }, 100);
        return { success: true };
    }
    return { success: false, error: 'Widget window not open' };
});

// Buddy List handlers
ipcMain.handle('open-buddy-list', () => {
    createBuddyListWindow();
    return { success: true };
});

ipcMain.handle('bring-buddy-list-to-front', () => {
    if (buddyListWindow && !buddyListWindow.isDestroyed()) {
        buddyListWindow.show();
        buddyListWindow.focus();
        buddyListWindow.moveTop();
        return { success: true };
    }
    return { success: false, error: 'Buddy list window not open' };
});

// ============================================
// SNAP CONTROL HANDLERS
// ============================================

ipcMain.handle('get-window-snap-status', () => {
    return {
        chatSnappedTo: chatPopoutWindow?.snappedTo || null,
        chatSnappedFrom: chatPopoutWindow?.snappedFrom || null,
        chatIsSnapped: chatPopoutWindow?.isSnapped || false,
        buddySnappedTo: buddyListWindow?.snappedTo || null,
        buddySnappedFrom: buddyListWindow?.snappedFrom || null,
        buddyIsSnapped: buddyListWindow?.isSnapped || false,
        bothSnapped: (chatPopoutWindow?.isSnapped && buddyListWindow?.isSnapped) || false
    };
});

ipcMain.handle('set-snap-enabled', (event, enabled) => {
    // Store snap preference (could be used to temporarily disable snapping)
    console.log('[Snap] Snap enabled:', enabled);
    return { success: true };
});

ipcMain.handle('unsnap-all-windows', () => {
    // Unsnap Chat
    if (chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
        chatPopoutWindow.snappedTo = null;
        chatPopoutWindow.snappedFrom = null;
        chatPopoutWindow.isSnapped = false;
    }
    // Unsnap Buddy List
    if (buddyListWindow && !buddyListWindow.isDestroyed()) {
        buddyListWindow.snappedTo = null;
        buddyListWindow.snappedFrom = null;
        buddyListWindow.isSnapped = false;
    }
    console.log('[Snap] All windows unsnapped');
    return { success: true };
});

// Detach Buddy List from Chat (when user clicks Detach button)
ipcMain.handle('detach-buddy-list', () => {
    console.log('[Snap] Detaching buddy list...');
    
    // Unsnap both windows
    if (chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
        chatPopoutWindow.snappedTo = null;
        chatPopoutWindow.snappedFrom = null;
        chatPopoutWindow.isSnapped = false;
    }
    if (buddyListWindow && !buddyListWindow.isDestroyed()) {
        // Store current dimensions before detaching
        const bounds = buddyListWindow.getBounds();
        
        // Move buddy list slightly to the left to show it's detached
        buddyListWindow.setPosition(bounds.x - 20, bounds.y);
        
        // Restore original height when detaching
        if (buddyListWindow.originalHeight) {
            buddyListWindow.setSize(bounds.width, buddyListWindow.originalHeight);
            console.log(`[Snap] Restored buddy list to original height: ${buddyListWindow.originalHeight}px`);
        }
        
        buddyListWindow.snappedTo = null;
        buddyListWindow.snappedFrom = null;
        buddyListWindow.isSnapped = false;
    }
    
    // Notify renderer processes of snap state change
    notifySnapStateChanged(null);
    
    console.log('[Snap] Buddy list detached');
    return { success: true };
});

// Helper function to notify all windows of snap state changes
function notifySnapStateChanged(snapState) {
    const status = {
        bothSnapped: snapState !== null,
        snapState: snapState
    };
    
    // Send to Chat Popout window
    if (chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
        chatPopoutWindow.webContents.send('window-snap-changed', status);
    }
    
    // Send to Buddy List window
    if (buddyListWindow && !buddyListWindow.isDestroyed()) {
        buddyListWindow.webContents.send('window-snap-changed', status);
    }
}

// Sync window dimensions when attached (for synchronized height)
ipcMain.handle('sync-window-dimensions', (event, { targetWindow, height }) => {
    if (targetWindow === 'buddy' && chatPopoutWindow && !chatPopoutWindow.isDestroyed()) {
        // Buddy list height changed - sync with chat
        const chatBounds = chatPopoutWindow.getBounds();
        // Don't resize chat, just inform buddy list of chat height
        return { height: chatBounds.height };
    }
    if (targetWindow === 'chat' && buddyListWindow && !buddyListWindow.isDestroyed()) {
        // Chat height changed - sync buddy list height
        const buddyBounds = buddyListWindow.getBounds();
        // Resize buddy list to match chat height
        buddyListWindow.setSize(buddyBounds.width, height);
        return { success: true };
    }
    return { success: false };
});

ipcMain.handle('minimize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win && !win.isDestroyed()) {
        win.minimize();
        return { success: true };
    }
    return { success: false, error: 'No focused window' };
});

ipcMain.handle('maximize-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win && !win.isDestroyed()) {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
        return { success: true };
    }
    return { success: false, error: 'No focused window' };
});

ipcMain.handle('close-window', () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win && !win.isDestroyed()) {
        win.close();
        return { success: true };
    }
    return { success: false, error: 'No focused window' };
});

ipcMain.handle('open-settings-modal', () => {
    // Create a separate settings window instead of opening dashboard
    createSettingsWindow();
    return { success: true };
});

ipcMain.handle('open-member-dashboard', (event, userId, username, mode = 'streamer') => {
    createMemberDashboardWindow(userId, username, mode);
    return { success: true };
});

ipcMain.handle('save-viewer-prefs', async (event, opts) => {
    const { userId, username, color, selectedSprite } = opts || {};
    if (!userId) return { success: false, error: 'userId required' };
    const u = activeUsers.get(userId);
    const uname = username || (u && u.username);
    if (u) {
        if (color !== undefined) { u.color = color; broadcastToWidget('viewerColorChange', { userId, username: uname, color }); }
        if (selectedSprite !== undefined) { u.selectedSprite = selectedSprite; broadcastToWidget('viewerSpriteChange', { userId, username: uname, sprite: selectedSprite }); }
    }
    const prefs = loadViewerPrefs();
    prefs[userId] = { ...(prefs[userId] || {}), username: uname };
    if (color !== undefined) prefs[userId].color = color;
    if (selectedSprite !== undefined) prefs[userId].selectedSprite = selectedSprite;
    saveViewerPrefsFile(prefs);
    return { success: true };
});

ipcMain.handle('get-window-dimensions', () => {
    // Return the STORED dimensions, not the actual window size
    // The actual window size may differ due to Electron quirks (focus, frame changes, etc.)
    // We only update stored dimensions when the user explicitly resizes via the resize handler
    // or when they apply new dimensions via set-window-dimensions
    return windowDimensions;
});

ipcMain.handle('set-window-dimensions', (event, dimensions) => {
    windowDimensions = { ...windowDimensions, ...dimensions };
    saveWindowDimensions();
    
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        // Use setBounds to set outer window dimensions (preserves position)
        const currentBounds = widgetWindow.getBounds();
        widgetWindow.setBounds({
            x: currentBounds.x,
            y: currentBounds.y,
            width: windowDimensions.width,
            height: windowDimensions.height
        });
        widgetWindow.setResizable(!windowDimensions.locked);
    }
    
    return { success: true };
});

// Flag to prevent resize handler from saving during lock toggle
let isTogglingLock = false;

ipcMain.handle('toggle-window-lock', () => {
    // Set flag to prevent resize handler from saving wrong dimensions
    isTogglingLock = true;

    // Toggle the lock state
    windowDimensions.locked = !windowDimensions.locked;

    if (widgetWindow && !widgetWindow.isDestroyed()) {
        // Change resizable state
        widgetWindow.setResizable(!windowDimensions.locked);
        
        // ALWAYS force the window to the stored dimensions using setBounds
        // This ensures consistency regardless of any Electron quirks (focus, frame changes, etc.)
        const currentBounds = widgetWindow.getBounds();
        console.log(`[toggle-window-lock] Forcing dimensions to stored values: ${windowDimensions.width}x${windowDimensions.height}`);
        widgetWindow.setBounds({
            x: currentBounds.x,
            y: currentBounds.y,
            width: windowDimensions.width,
            height: windowDimensions.height
        });
    }

    // Save the lock state (dimensions are already correct)
    saveWindowDimensions();

    // Clear flag after a short delay to allow any pending resize events to be ignored
    setTimeout(() => {
        isTogglingLock = false;
    }, 100);

    return { locked: windowDimensions.locked };
});

// Settings
ipcMain.handle('get-settings', () => {
    return loadSettings();
});

ipcMain.handle('save-settings', (event, settings) => {
    saveSettings(settings);
    return { success: true };
});

ipcMain.handle('update-audio-settings', (event, audioSettings) => {
    // Send audio settings update to widget immediately
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('settingsUpdate', { audioSettings });
    }
    // Also update dashboard if it's not the sender
    if (dashboardWindow && !dashboardWindow.isDestroyed() && event.sender !== dashboardWindow.webContents) {
        dashboardWindow.webContents.send('settingsUpdate', { audioSettings });
    }
    return { success: true };
});

// Twitch
ipcMain.handle('get-twitch-config', () => {
    return { ...twitchConfig, accessToken: twitchConfig.accessToken || twitchConfig.oauthToken || '' };
});

ipcMain.handle('get-third-party-emotes', () => {
    return thirdPartyEmotesCache || { channel: null, emotes: {}, updatedAt: Date.now() };
});

// ============================================
// TWITCH EMOTE FETCHING FOR POPOUT CHAT
// ============================================

// Cache for Twitch emotes
let twitchEmotesCache = {
    global: null,
    channel: null,
    user: null,
    lastFetch: {}
};

const EMOTE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch global Twitch emotes
async function fetchGlobalEmotes() {
    const now = Date.now();
    if (twitchEmotesCache.global && (now - (twitchEmotesCache.lastFetch.global || 0)) < EMOTE_CACHE_TTL) {
        return twitchEmotesCache.global;
    }
    
    try {
        const token = twitchConfig.accessToken || twitchConfig.oauthToken;
        const clientId = twitchConfig.clientId;
        
        if (!token || !clientId) {
            console.log('[Emotes] No token or client ID for global emotes');
            return [];
        }
        
        const response = await fetch('https://api.twitch.tv/helix/chat/emotes/global', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': clientId
            }
        });
        
        if (!response.ok) {
            console.error('[Emotes] Failed to fetch global emotes:', response.status);
            return [];
        }
        
        const data = await response.json();
        const emotes = (data.data || []).map(e => ({
            id: e.id,
            name: e.name,
            url: e.images.url_2x || e.images.url_1x
        }));
        
        twitchEmotesCache.global = emotes;
        twitchEmotesCache.lastFetch.global = now;
        console.log(`[Emotes] Fetched ${emotes.length} global emotes`);
        return emotes;
    } catch (error) {
        console.error('[Emotes] Error fetching global emotes:', error);
        return [];
    }
}

// Fetch channel emotes (subscriber emotes)
async function fetchChannelEmotes() {
    const now = Date.now();
    if (twitchEmotesCache.channel && (now - (twitchEmotesCache.lastFetch.channel || 0)) < EMOTE_CACHE_TTL) {
        return twitchEmotesCache.channel;
    }
    
    try {
        const token = twitchConfig.accessToken || twitchConfig.oauthToken;
        const clientId = twitchConfig.clientId;
        const broadcasterId = twitchConfig.userId;
        
        if (!token || !clientId || !broadcasterId) {
            console.log('[Emotes] No token, client ID, or broadcaster ID for channel emotes');
            return [];
        }
        
        const response = await fetch(`https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${broadcasterId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': clientId
            }
        });
        
        if (!response.ok) {
            console.error('[Emotes] Failed to fetch channel emotes:', response.status);
            return [];
        }
        
        const data = await response.json();
        const emotes = (data.data || []).map(e => ({
            id: e.id,
            name: e.name,
            url: e.images.url_2x || e.images.url_1x,
            tier: e.tier
        }));
        
        twitchEmotesCache.channel = emotes;
        twitchEmotesCache.lastFetch.channel = now;
        console.log(`[Emotes] Fetched ${emotes.length} channel emotes`);
        return emotes;
    } catch (error) {
        console.error('[Emotes] Error fetching channel emotes:', error);
        return [];
    }
}

// Fetch user emotes (emotes the authenticated user can use)
async function fetchUserEmotes() {
    const now = Date.now();
    if (twitchEmotesCache.user && (now - (twitchEmotesCache.lastFetch.user || 0)) < EMOTE_CACHE_TTL) {
        return twitchEmotesCache.user;
    }
    
    try {
        const token = twitchConfig.accessToken || twitchConfig.oauthToken;
        const clientId = twitchConfig.clientId;
        const userId = twitchConfig.userId;
        
        if (!token || !clientId || !userId) {
            console.log('[Emotes] No token, client ID, or user ID for user emotes');
            return [];
        }
        
        // This endpoint requires user:read:emotes scope
        const response = await fetch(`https://api.twitch.tv/helix/chat/emotes/user?user_id=${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Client-Id': clientId
            }
        });
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.log('[Emotes] User emotes require user:read:emotes scope');
            } else {
                console.error('[Emotes] Failed to fetch user emotes:', response.status);
            }
            return [];
        }
        
        const data = await response.json();
        const emotes = (data.data || []).map(e => ({
            id: e.id,
            name: e.name,
            url: e.images.url_2x || e.images.url_1x,
            emote_type: e.emote_type,
            owner_id: e.owner_id
        }));
        
        twitchEmotesCache.user = emotes;
        twitchEmotesCache.lastFetch.user = now;
        console.log(`[Emotes] Fetched ${emotes.length} user emotes`);
        return emotes;
    } catch (error) {
        console.error('[Emotes] Error fetching user emotes:', error);
        return [];
    }
}

// IPC handler for getting Twitch emotes
ipcMain.handle('get-twitch-emotes', async (event, type) => {
    switch (type) {
        case 'global':
            return await fetchGlobalEmotes();
        case 'channel':
            return await fetchChannelEmotes();
        case 'user':
            return await fetchUserEmotes();
        default:
            console.warn('[Emotes] Unknown emote type:', type);
            return [];
    }
});

// ============================================
// END TWITCH EMOTE FETCHING
// ============================================

ipcMain.handle('save-twitch-config', (event, config) => {
    twitchConfig = config;
    saveTwitchConfig();
    connectTwitch(); // Reconnect with new config
    return { success: true };
});

ipcMain.handle('get-twitch-status', () => {
    const chatBotUsername = (twitchConfig.chatBotUsername || '').trim();
    const chatBotTokenRaw = (twitchConfig.chatBotAccessToken || '').trim();
    const useSeparateChatBot =
        !!chatBotUsername &&
        !!chatBotTokenRaw &&
        chatBotUsername.toLowerCase() !== String(twitchConfig.botUsername || '').toLowerCase();

    // "Chat bot connected" should reflect the account that will actually SEND messages.
    const effectiveChatBotConnected = useSeparateChatBot ? isTwitchChatConnected : isTwitchConnected;
    const effectiveChatBotUsername = useSeparateChatBot ? (lastSeparateChatBotUsername || chatBotUsername || null) : (twitchConfig.botUsername || null);

    return {
        connected: isTwitchConnected,
        chatBotEnabled: useSeparateChatBot,
        chatBotConnected: effectiveChatBotConnected,
        chatBotUsername: effectiveChatBotUsername,
        autoJoinedStreamerBot: hasAutoJoinedStreamerBot
    };
});

// ============================================
// AUDIO FILE STORAGE (File-based for large files)
// ============================================

// Get audio files directory
function getAudioFilesDir() {
    const audioDir = path.join(userDataPath, 'audio-files');
    if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
    }
    return audioDir;
}

// Save audio file to disk
ipcMain.handle('save-audio-file', async (event, { audioType, fileName, fileData }) => {
    try {
        const audioDir = getAudioFilesDir();
        // Create a safe filename
        const ext = path.extname(fileName) || '.mp3';
        const safeFileName = `${audioType}${ext}`;
        const filePath = path.join(audioDir, safeFileName);
        
        // fileData is a base64 data URL, extract the base64 part
        const base64Data = fileData.replace(/^data:audio\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        fs.writeFileSync(filePath, buffer);
        console.log(`Audio file saved: ${filePath} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
        
        return { success: true, filePath, fileName };
    } catch (err) {
        console.error('Failed to save audio file:', err);
        return { success: false, error: err.message };
    }
});

// Load audio file from disk
ipcMain.handle('load-audio-file', async (event, audioType) => {
    try {
        const audioDir = getAudioFilesDir();
        // Find the file with any extension
        const files = fs.readdirSync(audioDir);
        const audioFile = files.find(f => f.startsWith(audioType + '.'));
        
        if (!audioFile) {
            return { success: false, error: 'File not found' };
        }
        
        const filePath = path.join(audioDir, audioFile);
        const buffer = fs.readFileSync(filePath);
        
        // Determine MIME type from extension
        const ext = path.extname(audioFile).toLowerCase();
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac',
            '.flac': 'audio/flac',
            '.webm': 'audio/webm'
        };
        const mimeType = mimeTypes[ext] || 'audio/mpeg';
        
        // Convert to base64 data URL
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        
        return { success: true, fileData: dataUrl, fileName: audioFile };
    } catch (err) {
        console.error('Failed to load audio file:', err);
        return { success: false, error: err.message };
    }
});

// Delete audio file from disk
ipcMain.handle('delete-audio-file', async (event, audioType) => {
    try {
        const audioDir = getAudioFilesDir();
        const files = fs.readdirSync(audioDir);
        const audioFile = files.find(f => f.startsWith(audioType + '.'));
        
        if (audioFile) {
            fs.unlinkSync(path.join(audioDir, audioFile));
            console.log(`Audio file deleted: ${audioType}`);
        }
        
        return { success: true };
    } catch (err) {
        console.error('Failed to delete audio file:', err);
        return { success: false, error: err.message };
    }
});

// ============================================
// AUDIO PLAYBACK CONTROL (via Widget Window)
// ============================================

// Control audio playback in the widget window
ipcMain.handle('control-audio', async (event, { action, audioType, volume }) => {
    // Send audio control command to widget window
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send('audioControl', { action, audioType, volume });
        return { success: true };
    }
    return { success: false, error: 'Widget window not available' };
});

// Get audio playback status from widget
ipcMain.handle('get-audio-status', async () => {
    // This will be handled by the widget responding via IPC
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ music: { playing: false }, ambience: { playing: false } });
            }, 1000);
            
            ipcMain.once('audio-status-response', (event, status) => {
                clearTimeout(timeout);
                resolve(status);
            });
            
            widgetWindow.webContents.send('getAudioStatus');
        });
    }
    return { music: { playing: false }, ambience: { playing: false } };
});

// Generate Twitch OAuth token via Twitch's authorize page
// Use a standalone window (no parent/modal) so it never appears "inside" the widget or Settings.
ipcMain.handle('generate-twitch-token', async (event, accountType) => {
    return new Promise((resolve, reject) => {
        const authWindow = new BrowserWindow({
            width: 500,
            height: 700,
            show: false,
            center: true,
            modal: false,
            parent: undefined,
            webPreferences: { nodeIntegration: false, contextIsolation: true }
        });
        const port = parseInt(process.env.OAUTH_CALLBACK_PORT, 10) || 3010;
        const redirectUri = `http://localhost:${port}/twitch-callback`;
        const clientId = process.env.TWITCH_CLIENT_ID || 'kimne78kx3ncx6brgo4mv6wki5h1ko';
        const callbackHtml = '<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;"><p>Authorization complete. You can close this window.</p></body></html>';
        const server = http.createServer((req, res) => {
            if (req.url && req.url.startsWith('/twitch-callback')) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(callbackHtml);
            } else {
                res.writeHead(404);
                res.end();
            }
        });
        server.listen(port, '127.0.0.1', () => {
            const scopes = 'chat:read chat:edit';
            const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}&force_verify=true`;
            let resolved = false;
            const finish = (err, result) => {
                if (resolved) return;
                resolved = true;
                try { server.close(); } catch (e) {}
                try { if (!authWindow.isDestroyed()) authWindow.close(); } catch (e) {}
                if (err) reject(err);
                else resolve(result);
            };
            authWindow.webContents.on('did-navigate', (e, url) => {
                if (url.startsWith(redirectUri)) {
                    const u = new URL(url);
                    const params = new URLSearchParams((u.hash || '').substring(1));
                    const tok = params.get('access_token');
                    const err = params.get('error');
                    const errDesc = params.get('error_description');
                    if (err) finish(new Error(`OAuth: ${err} - ${errDesc || ''}`));
                    else if (tok) finish(null, { token: tok });
                    else finish(new Error('No access token in redirect'));
                }
            });
            authWindow.webContents.on('will-navigate', (e, url) => {
                if (url.startsWith(redirectUri)) {
                    e.preventDefault();
                    const u = new URL(url);
                    const params = new URLSearchParams((u.hash || '').substring(1));
                    const tok = params.get('access_token');
                    const err = params.get('error');
                    const errDesc = params.get('error_description');
                    if (err) finish(new Error(`OAuth: ${err} - ${errDesc || ''}`));
                    else if (tok) finish(null, { token: tok });
                    else finish(new Error('No access token in redirect'));
                }
            });
            authWindow.on('closed', () => {
                if (!resolved) finish(new Error('OAuth window closed'));
            });
            authWindow.loadURL(authUrl);
            authWindow.show();
        });
        server.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                try { if (!authWindow.isDestroyed()) authWindow.close(); } catch (e) {}
                const msg = (err && err.code === 'EADDRINUSE')
                    ? `OAuth callback port ${port} is in use. Set OAUTH_CALLBACK_PORT to a free port (e.g. 3011) and add http://localhost:<that port>/twitch-callback to your Twitch app's Redirect URLs.`
                    : (err && err.message) || 'OAuth server error';
                reject(new Error(msg));
            }
        });
    });
});

ipcMain.handle('send-chat-message', async (event, message, speaker = 'main') => {
    if (typeof message !== 'string' || !message.trim()) return { ok: false, error: 'Empty message' };
    const trimmedMessage = message.trim();
    
    try {
        // Check if this is a command (starts with !)
        const isCommand = trimmedMessage.startsWith('!');

        let shouldSendToTwitch = true;

        // For commands, check if they should be silent (not sent to Twitch)
        // NOTE: We no longer process commands locally here - they will be processed
        // when the message comes back through Twitch IRC. This prevents duplicate processing.
        // For commands from main speaker (streamer), process locally to ensure correct user context
        if (isCommand && speaker === 'main') {
            shouldSendToTwitch = false; // Don't send to Twitch to avoid double processing
            // Process locally with streamer's context
            const streamerUsername = (twitchConfig.channelName || '').replace(/^#/, '').toLowerCase();
            if (streamerUsername) {
                // CRITICAL FIX: Always use the real Twitch userId for consistency
                // This ensures PopOut Chat and Twitch IRC messages use the same identity
                let streamerUserId = null;
                
                // FIRST: Check twitchConfig.streamerUserId (fetched when Twitch connected)
                // This is the most reliable source - the real Twitch ID from Helix API
                if (twitchConfig.streamerUserId) {
                    streamerUserId = String(twitchConfig.streamerUserId);
                    console.log(`[send-chat-message] Using stored streamer Twitch ID: ${streamerUserId}`);
                }
                
                // Second: check allChatters for the real Twitch userId
                if (!streamerUserId) {
                    const chatterEntry = allChatters.get(streamerUsername);
                    if (chatterEntry && chatterEntry.userId) {
                        streamerUserId = String(chatterEntry.userId);
                        console.log(`[send-chat-message] Found streamer userId from allChatters: ${streamerUserId}`);
                    }
                }
                
                // Third: check userManager (if available)
                if (!streamerUserId && userManager) {
                    const userByName = userManager.getUserByUsername(streamerUsername);
                    if (userByName && userByName.userId) {
                        streamerUserId = String(userByName.userId);
                        console.log(`[send-chat-message] Found streamer userId from userManager: ${streamerUserId}`);
                    }
                }
                
                // Last resort: check activeUsers by username
                if (!streamerUserId) {
                    for (const [id, u] of activeUsers.entries()) {
                        if (u.username && u.username.toLowerCase() === streamerUsername) {
                            streamerUserId = String(id);
                            console.log(`[send-chat-message] Found streamer userId from activeUsers: ${streamerUserId}`);
                            break;
                        }
                    }
                }
                
                if (streamerUserId) {
                    // Process the command locally with correct user context
                    const mockTags = {
                        username: streamerUsername,
                        'display-name': streamerUsername,
                        'user-id': streamerUserId,
                        badges: { broadcaster: '1' },
                        mod: true,
                        subscriber: true
                    };
                    parseChatCommand(streamerUsername, streamerUserId, trimmedMessage, mockTags).catch(e => {
                        console.error('[send-chat-message] Error processing local command:', e);
                    });
                } else {
                    // If streamer not found anywhere, send to Twitch as fallback
                    // This will ensure the user gets created with the correct Twitch userId
                    console.log(`[send-chat-message] Streamer ${streamerUsername} not found, sending to Twitch`);
                    shouldSendToTwitch = true;
                }
            }
        }
        // For silent commands from bot speaker, process locally
        else if (isCommand && speaker === 'bot') {
            const cmd = botMessagesCache.find(c => c.enabled && c.commands.some(cmd => trimmedMessage.toLowerCase() === cmd || trimmedMessage.toLowerCase().startsWith(cmd + ' ')));
            if (cmd && cmd.silent) {
                shouldSendToTwitch = false;
                // For silent bot commands, we could process locally but for now just skip
            }
        }

        // Send to Twitch only if not silent
        if (shouldSendToTwitch) {
            const ok = await sayInChannel(trimmedMessage, speaker);
            
            // Record activity for main speaker (streamer) after sending message
            // This ensures Popout Chat messages update activity even before Twitch echo
            if (ok && speaker === 'main') {
                const streamerUsername = (twitchConfig.channelName || '').replace(/^#/, '').toLowerCase();
                const streamerUserId = twitchConfig.streamerUserId;
                
                if (streamerUserId && userManager) {
                    try {
                        userManager.recordActivity(streamerUserId);
                        broadcastToWidget('userActivity', { 
                            username: streamerUsername, 
                            userId: streamerUserId 
                        });
                        console.log(`[send-chat-message] Recorded activity for streamer: ${streamerUsername}`);
                    } catch (error) {
                        console.error(`[send-chat-message] Failed to record activity for streamer:`, error);
                    }
                }
            }
            
            return ok ? { ok: true } : { ok: false, error: 'Not connected to Twitch' };
        } else {
            // For silent commands processed locally, activity is recorded in parseChatCommand
            return { ok: true, silent: true };
        }
    } catch (e) {
        return { ok: false, error: (e && e.message) || 'Send failed' };
    }
});

ipcMain.handle('disconnect-twitch', async () => {
    if (twitchClient) {
        twitchClient.disconnect();
        twitchClient = null;
        isTwitchConnected = false;
        broadcastToWidget('twitchDisconnected', { connected: false });
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('twitchDisconnected', { connected: false });
        }
    }
    return { success: true };
});

// Users/Members
ipcMain.handle('get-active-users', () => {
    // Use UserManager if available, fall back to activeUsers
    if (userManager) {
        return userManager.getJoinedUsers().map(user => user.toJSON());
    }
    return Array.from(activeUsers.values());
});

ipcMain.handle('get-potential-members', () => {
    return Array.from(allChatters.values());
});

// Get chatters list for @ mention autocomplete in popout chat
ipcMain.handle('get-chatters-list', () => {
    // Return sorted list of usernames for autocomplete
    const chatters = Array.from(allChatters.values());
    return chatters
        .filter(c => c && c.username)
        .map(c => ({
            username: c.username,
            userId: c.userId,
            isBroadcaster: c.isBroadcaster || false,
            isMod: c.isMod || false,
            isVip: c.isVip || false,
            isSubscriber: c.isSubscriber || false,
            isBot: c.isBot || false
        }))
        .sort((a, b) => a.username.localeCompare(b.username));
});

// Handle state updates from widget (auto-state transitions)
ipcMain.on('widget-user-state-update', (event, { userId, newState, oldState }) => {
    if (!userManager) {
        console.warn('[Main] UserManager not initialized, cannot update user state');
        return;
    }

    const user = userManager.getUser(userId);
    if (!user) {
        console.warn(`[Main] Cannot update state for unknown user: ${userId}`);
        return;
    }

    // Normalize state to uppercase to match USER_STATES constants
    const normalizedNewState = newState.toUpperCase();
    const normalizedOldState = oldState ? oldState.toUpperCase() : oldState;

    // Only update if state actually changed
    if (user.state !== normalizedNewState) {
        console.log(`[Main] Widget reported state change for ${user.username}: ${normalizedOldState} -> ${normalizedNewState}`);
        user.state = normalizedNewState;
        // Emit event for auto-state announcements
        userManager.emit('user:stateChanged', user, normalizedOldState, normalizedNewState);
    }
});

ipcMain.handle('add-to-chatters', (event, username, userData) => {
    // Add a user to the chatters list (for showing as "In Chat" in dashboard)
    const key = username.toLowerCase();
    allChatters.set(key, {
        username,
        userId: userData.userId || key,
        isBroadcaster: userData.isBroadcaster || false,
        isMod: userData.isMod || false,
        isBot: userData.isBot || false,
        joinedAt: userData.joinedAt || Date.now()
    });
    updatePotentialMembersList();
    console.log(`[Main] Added ${username} to chatters list`);
});

// Refresh chatters from Twitch API
ipcMain.handle('refresh-chatters', async () => {
    return await refreshChattersFromAPI();
});

// Sync user activity from widget to main process (bidirectional activity tracking)
ipcMain.handle('sync-user-activity', (event, userId) => {
    if (!userId) {
        console.warn('[sync-user-activity] No userId provided');
        return { success: false, error: 'No userId provided' };
    }
    
    if (!userManager) {
        console.warn('[sync-user-activity] UserManager not initialized');
        return { success: false, error: 'UserManager not initialized' };
    }
    
    try {
        const user = userManager.recordActivity(userId);
        if (user) {
            console.log(`[sync-user-activity] Recorded activity for user: ${user.username} (${userId})`);
            return { success: true, userId: userId };
        } else {
            console.warn(`[sync-user-activity] User not found: ${userId}`);
            return { success: false, error: 'User not found' };
        }
    } catch (error) {
        console.error(`[sync-user-activity] Error recording activity for ${userId}:`, error);
        return { success: false, error: error.message };
    }
});

// Widget's actual display users (including restored from localStorage) for Members list + restored icon
ipcMain.handle('get-widget-display-users', async () => {
    try {
        const list = await executeInWidget(`
            const w = window.widget || window.campfireWidget;
            if (w && Array.isArray(w.users)) {
                return w.users.map(u => !u || !u.username ? null : {
                    username: u.username || '',
                    userId: u.userId || (u.username ? u.username.toLowerCase() : ''),
                    color: u.color || null,
                    selectedSprite: u.selectedSprite || null,
                    angle: u.angle || 0,
                    state: u.state || 'JOINED',
                    isLurking: u.isLurking || false,
                    lastActivity: u.lastActivity || 0,
                    persisted: u.persisted || false
                }).filter(Boolean);
            }
            return [];
        `);
        return list || [];
    } catch (e) {
        return [];
    }
});

ipcMain.handle('get-viewer-prefs', (event, userId) => {
    const prefs = loadViewerPrefs();
    return userId ? (prefs[userId] || null) : prefs;
});

ipcMain.handle('kick-member', (event, userId) => {
    const normalizedId = String(userId);
    
    // Try UserManager first (single source of truth)
    if (userManager && userManager.hasUser(normalizedId)) {
        const user = userManager.getUser(normalizedId);
        userManager.leaveUser(normalizedId);
        // Also remove from legacy activeUsers for backward compatibility
        activeUsers.delete(normalizedId);
        // Note: UserManagerBridge already forwards the 'user:removed' event to widget,
        // so we don't need to manually broadcast here to avoid duplicate events
        return { success: true };
    }
    
    // Fall back to activeUsers (only if UserManager doesn't have the user)
    if (activeUsers.has(normalizedId)) {
        const user = activeUsers.get(normalizedId);
        activeUsers.delete(normalizedId);
        // Manual broadcast only needed when UserManager wasn't used
        addEvent('userKick', { username: user.username, userId: normalizedId });
        broadcastToWidget('userLeave', { username: user.username, userId: normalizedId });
        return { success: true };
    }
    return { success: false, error: 'User not found' };
});

function isTestUser(userId, username) {
    const id = String(userId || '').toLowerCase();
    const name = String(username || '');
    if (/^testuser\d*$/.test(id)) return true;
    if (/^TestUser\d*$/i.test(name)) return true;
    return false;
}

function normalizeJoinId(userId, username) {
    const id = String(userId || '').trim();
    if (id) return id;
    const name = String(username || '').trim();
    return name ? name.toLowerCase() : '';
}

function activeHasUser(userId, username) {
    const id = String(userId || '').trim();
    const name = String(username || '').toLowerCase().trim();
    
    // Try UserManager first
    if (userManager) {
        if (id && userManager.hasUser(id)) return true;
        if (name) {
            const user = userManager.getUserByUsername(name);
            if (user) return true;
        }
    }
    
    // Fall back to activeUsers
    if (id && activeUsers.has(id)) return true;
    if (name) {
        for (const [, u] of activeUsers.entries()) {
            if (u && u.username && String(u.username).toLowerCase() === name) return true;
        }
    }
    return false;
}

async function executeGetWidgetDisplayUsersLite() {
    try {
        const list = await executeInWidget(`
            const w = window.widget || window.campfireWidget;
            if (w && Array.isArray(w.users)) {
                return w.users.map(u => !u || !u.username ? null : {
                    username: u.username || '',
                    userId: u.userId || (u.username ? u.username.toLowerCase() : '')
                }).filter(Boolean);
            }
            return [];
        `);
        return Array.isArray(list) ? list : [];
    } catch (e) {
        return [];
    }
}

async function bulkKickUsers(users) {
    const results = [];
    for (const raw of (users || [])) {
        const username = raw && raw.username ? String(raw.username) : '';
        const userId = normalizeJoinId(raw && raw.userId, username);
        if (!username || !userId) continue;
        if (isTestUser(userId, username)) continue;

        // Remove from UserManager first (single source of truth)
        let removedFromManager = false;
        if (userManager) {
            if (userManager.hasUser(userId)) {
                userManager.leaveUser(userId);
                removedFromManager = true;
            } else {
                // Try by username if userId not found
                const userByName = userManager.getUserByUsername(username);
                if (userByName) {
                    userManager.leaveUser(userByName.userId);
                    removedFromManager = true;
                }
            }
        }

        // Also remove from legacy activeUsers for backward compatibility during transition
        let removedFromLegacy = false;
        if (activeUsers.has(userId)) {
            activeUsers.delete(userId);
            removedFromLegacy = true;
        } else {
            for (const [id, u] of activeUsers.entries()) {
                if (u && u.username && String(u.username).toLowerCase() === username.toLowerCase()) {
                    activeUsers.delete(id);
                    removedFromLegacy = true;
                    break;
                }
            }
        }

        // Only broadcast if UserManager didn't already handle it (to avoid duplicate events)
        // UserManagerBridge forwards events from UserManager, so we only need manual broadcast
        // if UserManager wasn't used or didn't find the user
        if (!removedFromManager) {
            addEvent('userKick', { username, userId });
            broadcastToWidget('userLeave', { username, userId });
        }
        
        results.push({ username, userId, success: true, removedFromMain: removedFromManager || removedFromLegacy });
    }
    return results;
}

ipcMain.handle('kick-all-users', async () => {
    // Kick everyone currently in the campfire (excluding test users)
    // Use UserManager as the primary source of truth
    let targets = [];
    if (userManager) {
        targets = userManager.getJoinedUsers()
            .filter(u => !isTestUser(u.userId, u.username))
            .map(u => ({ username: u.username, userId: u.userId }));
    }
    // Fallback to widget users or legacy activeUsers if UserManager is empty
    if (targets.length === 0) {
        const widgetUsers = (widgetWindow && !widgetWindow.isDestroyed()) ? await executeGetWidgetDisplayUsersLite() : [];
        targets = widgetUsers.length > 0 ? widgetUsers : Array.from(activeUsers.values()).map(u => ({ username: u.username, userId: u.userId }));
    }
    const results = await bulkKickUsers(targets);
    if (membersWindow && !membersWindow.isDestroyed()) membersWindow.webContents.send('refresh-members');
    if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.webContents.send('refresh-members');
    return { success: true, results };
});

function findAvailableAngle(existingAngles, minSeparation = 20) {
    // existingAngles: array of numbers (degrees 0-360)
    // minSeparation: minimum degrees between users (±minSeparation/2)
    const occupiedRanges = [];
    for (const angle of existingAngles) {
        const start = (angle - minSeparation/2 + 360) % 360;
        const end = (angle + minSeparation/2) % 360;
        occupiedRanges.push({ start, end });
    }

    // Try random angles until we find one not in occupied ranges
    for (let attempts = 0; attempts < 100; attempts++) {
        const candidate = Math.random() * 360;
        let isAvailable = true;

        for (const range of occupiedRanges) {
            if (range.start <= range.end) {
                // Normal range
                if (candidate >= range.start && candidate <= range.end) {
                    isAvailable = false;
                    break;
                }
            } else {
                // Range wraps around 0
                if (candidate >= range.start || candidate <= range.end) {
                    isAvailable = false;
                    break;
                }
            }
        }

        if (isAvailable) {
            return candidate;
        }
    }

    // Fallback: just use random if no spot found
    return Math.random() * 360;
}

async function bulkJoinUsers({ mode = 'controlled', delayMs = 80 } = {}) {
    const settings = loadSettings();
    const enforceRules = mode !== 'chaos';
    const maxUsers = parseInt(settings.maxUsers, 10) || 20;
    const results = [];

    // Get existing angles for collision detection - prefer UserManager as source of truth
    let existingAngles = [];
    if (userManager) {
        existingAngles = userManager.getJoinedUsers()
            .map(u => u.angle)
            .filter(a => typeof a === 'number');
    } else {
        existingAngles = Array.from(activeUsers.values())
            .map(u => u.angle)
            .filter(a => typeof a === 'number');
    }

    // Ensure widget is ready (avoids spiky failures)
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        const widgetReady = await waitForWidget(15, 200);
        if (!widgetReady) {
            return { success: false, error: 'Widget not initialized' };
        }
    }

    const widgetUsers = (widgetWindow && !widgetWindow.isDestroyed()) ? await executeGetWidgetDisplayUsersLite() : [];
    const inCampfireKeys = new Set();
    widgetUsers.forEach(u => {
        if (u && u.userId) inCampfireKeys.add(String(u.userId));
        if (u && u.username) inCampfireKeys.add(String(u.username).toLowerCase());
    });
    
    // Also check UserManager for already-joined users
    if (userManager) {
        for (const u of userManager.getJoinedUsers()) {
            if (u && u.userId) inCampfireKeys.add(String(u.userId));
            if (u && u.username) inCampfireKeys.add(String(u.username).toLowerCase());
        }
    }
    // Legacy fallback
    for (const [, u] of activeUsers.entries()) {
        if (u && u.userId) inCampfireKeys.add(String(u.userId));
        if (u && u.username) inCampfireKeys.add(String(u.username).toLowerCase());
    }

    const chatters = Array.from(allChatters.values())
        .filter(c => c && c.username && !isTestUser(c.userId, c.username))
        .sort((a, b) => (b.lastMessage || 0) - (a.lastMessage || 0));

    // Get current joined count from UserManager (source of truth)
    const getCurrentJoinedCount = () => {
        if (userManager) {
            return userManager.joinedCount;
        }
        return activeUsers.size;
    };

    for (const c of chatters) {
        const username = String(c.username || '');
        const userId = normalizeJoinId(c.userId, username);
        if (!username || !userId) continue;
        if (inCampfireKeys.has(userId) || inCampfireKeys.has(username.toLowerCase())) continue;

        // Respect maxUsers - use UserManager count as source of truth
        if (getCurrentJoinedCount() >= maxUsers) {
            results.push({ username, userId, success: false, skipped: true, reason: 'maxUsers' });
            continue;
        }

        if (enforceRules) {
            const tags = c.tags || null;
            if (!tags) {
                results.push({ username, userId, success: false, skipped: true, reason: 'no-tags' });
                continue;
            }
            if (!canUserJoin(tags, settings)) {
                results.push({ username, userId, success: false, skipped: true, reason: 'restricted' });
                continue;
            }
        }

        if (activeHasUser(userId, username)) {
            results.push({ username, userId, success: false, skipped: true, reason: 'already-joined' });
            continue;
        }

        const prefs = loadViewerPrefs();
        const p = prefs[userId];
        const color = await getViewerColor(username, userId) || (p && p.color) || null;
        const angle = findAvailableAngle(existingAngles, 30); // 30 degrees separation (±15)
        
        const userData = {
            username,
            userId,
            color,
            selectedSprite: (p && p.selectedSprite) || null,
            twitchColor: c.color || null,
            joinedAt: Date.now(),
            angle,
            source: enforceRules ? 'bulk-controlled' : 'bulk-chaos',
            state: USER_STATES.JOINED  // Include state for buddy list
        };

        // Use UserManager as primary (single source of truth)
        let addedToManager = false;
        if (userManager) {
            try {
                await userManager.joinUser(userId, {
                    username,
                    twitchColor: c.color || null,
                    angle,
                    source: userData.source,
                    roles: c.tags ? {
                        broadcaster: c.tags.badges && c.tags.badges.broadcaster,
                        moderator: c.tags.mod,
                        vip: c.tags.badges && c.tags.badges.vip,
                        subscriber: c.tags.subscriber
                    } : null
                });
                addedToManager = true;
                // Mark as in campfire to prevent re-adding
                inCampfireKeys.add(userId);
                inCampfireKeys.add(username.toLowerCase());
            } catch (err) {
                console.error(`[bulkJoinUsers] Error adding ${username} to UserManager:`, err);
            }
        }

        // Also add to legacy activeUsers for backward compatibility during transition
        activeUsers.set(userId, userData);
        
        // Only broadcast manually if UserManager didn't handle it
        // (UserManagerBridge forwards events from UserManager)
        if (!addedToManager) {
            addEvent('userJoin', userData);
            broadcastToWidget('userJoin', userData);
        }
        
        results.push({ username, userId, success: true });

        // Update existing angles for next user
        existingAngles.push(angle);

        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return { success: true, results };
}

ipcMain.handle('join-all-users', async (event, opts) => {
    const mode = (opts && opts.mode === 'chaos') ? 'chaos' : 'controlled';
    const out = await bulkJoinUsers({ mode, delayMs: 80 });
    if (membersWindow && !membersWindow.isDestroyed()) membersWindow.webContents.send('refresh-members');
    if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.webContents.send('refresh-members');
    return out;
});

// Get widget users (from main process activeUsers - source of truth for who is in the widget)
ipcMain.handle('get-widget-users', async () => {
    try {
        return buildActiveUsersList();
    } catch (error) {
        console.error('[Main Process] Error getting widget users:', error);
        return [];
    }
});

ipcMain.handle('join-member', async (event, userId, username, options = {}) => {
    // Normalize userId to string for consistent Map key handling
    const normalizedUserId = String(userId);
    
    if (activeUsers.has(normalizedUserId)) {
        return { success: false, error: 'User already joined' };
    }
    const prefs = loadViewerPrefs();
    const p = prefs[normalizedUserId] || prefs[userId]; // Check both normalized and original
    const chatter = Array.from(allChatters.values()).find(c =>
        String(c.userId || '') === normalizedUserId || (String(c.username || '').toLowerCase() === String(username || '').toLowerCase())
    );
    const color = await getViewerColor(username, normalizedUserId) || (p && p.color) || null;
    
    // Get roles from chatter data or options
    const roles = {
        isBroadcaster: (chatter && chatter.isBroadcaster) || (options && options.isBroadcaster) || false,
        isMod: (chatter && chatter.isMod) || (options && options.isMod) || false,
        isVip: (chatter && chatter.isVip) || false,
        isSubscriber: (chatter && chatter.isSubscriber) || false,
        isBot: (chatter && chatter.isBot) || (options && options.isBot) || false
    };
    
    const user = {
        username,
        userId: normalizedUserId, // Store normalized userId
        color,
        selectedSprite: (p && p.selectedSprite) || null,
        twitchColor: (chatter && chatter.color) || null,
        joinedAt: Date.now(),
        angle: Math.random() * 360,
        source: (options && options.source) || 'manual',
        roles: roles,
        state: USER_STATES.JOINED  // Include state for buddy list
    };
    activeUsers.set(normalizedUserId, user);
    addEvent('userJoin', user);
    
    // Only broadcast to widget if not from startup (startup already added user to widget)
    if (user.source !== 'startup') {
        broadcastToWidget('userJoin', user);
    }
    
    if (membersWindow && !membersWindow.isDestroyed()) membersWindow.webContents.send('refresh-members');
    if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.webContents.send('refresh-members');
    console.log(`[join-member] User ${username} (${normalizedUserId}) joined via IPC, source: ${user.source}`);
    return { success: true };
});

// Simulate a !join command for a user (used during startup for streamer and bot)
ipcMain.handle('simulate-join-command', async (event, username, userId) => {
    try {
        // Check if Twitch is connected
        if (!twitchClient || !isTwitchConnected) {
            console.log(`[simulate-join-command] Twitch not connected yet, deferring join for ${username}`);
            return { success: false, error: 'Twitch client not connected' };
        }
        
        // Try to fetch the user's actual data from Twitch API
        let userInfo = null;
        try {
            userInfo = await twitchClient.api.users.getUserByName(username);
        } catch (apiError) {
            console.warn(`[simulate-join-command] Could not fetch Twitch data for ${username}:`, apiError.message);
        }
        
        // Get pre-fetched chat color for streamer/bot accounts
        let chatColor = null;
        const lowerUsername = username.toLowerCase();
        if (twitchConfig.streamerUsername && lowerUsername === twitchConfig.streamerUsername.toLowerCase()) {
            chatColor = twitchConfig.streamerChatColor;
        } else if (twitchConfig.botUsername && lowerUsername === twitchConfig.botUsername.toLowerCase()) {
            chatColor = twitchConfig.botChatColor;
        }
        
        // Create tags based on the actual user data or fallback to provided data
        const tags = {
            'user-id': userInfo?.id || userId || username,
            'username': userInfo?.login || username,
            'display-name': userInfo?.displayName || username,
            'badges': userInfo?.isBroadcaster ? 'broadcaster/1' : (userInfo?.isMod ? 'moderator/1' : ''),
            'mod': userInfo?.isMod ? '1' : '0',
            'color': chatColor || null  // Use pre-fetched color from Helix API
        };
        
        // Call parseChatCommand to simulate the !join command
        await parseChatCommand(username, tags['user-id'], '!join', tags);
        
        console.log(`[simulate-join-command] Successfully simulated !join for ${username} with color: ${chatColor || 'none'}`);
        return { success: true };
    } catch (e) {
        console.error(`[simulate-join-command] Error simulating !join for ${username}:`, e);
        return { success: false, error: e.message };
    }
});

// Join all test users
ipcMain.handle('join-all-test-users', async () => {
    console.log('[Main Process] join-all-test-users called');
    const testUsers = ['TestUser1', 'TestUser2', 'TestUser3'];
    const results = [];
    
    // Ensure widget is ready before adding any users
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        const widgetReady = await waitForWidget(15, 200);
        if (!widgetReady) {
            console.error('[Main Process] Widget not ready for test users');
            return { success: false, error: 'Widget not initialized' };
        }
    }
    
    for (const username of testUsers) {
        const userId = username.toLowerCase();
        
        // Check if already joined in UserManager (source of truth) or legacy activeUsers
        const alreadyInManager = userManager && userManager.hasUser(userId);
        const alreadyInLegacy = activeUsers.has(userId);
        
        if (alreadyInManager || alreadyInLegacy) {
            results.push({ username, success: false, error: 'Already joined' });
            continue;
        }
        
        const color = await getViewerColor(username, userId);
        const angle = Math.random() * 360;
        const userData = {
            username,
            userId,
            color: color,
            selectedSprite: null,
            joinedAt: Date.now(),
            angle,
            source: 'test-users-toggle'
        };
        
        // Use UserManager as primary (single source of truth)
        let addedToManager = false;
        if (userManager) {
            try {
                await userManager.joinUser(userId, {
                    username,
                    angle,
                    source: 'test-users-toggle'
                });
                addedToManager = true;
                console.log('[Main Process] Added test user to UserManager:', username);
            } catch (err) {
                console.error(`[Main Process] Error adding test user ${username} to UserManager:`, err);
            }
        }
        
        // Also add to legacy activeUsers for backward compatibility
        activeUsers.set(userId, userData);
        
        // Only broadcast manually if UserManager didn't handle it
        if (!addedToManager) {
            addEvent('userJoin', userData);
            broadcastToWidget('userJoin', userData);
            console.log('[Main Process] Added test user to activeUsers (legacy):', username);
        }
        
        results.push({ username, success: true });
    }
    
    // Update Members window if open
    if (membersWindow && !membersWindow.isDestroyed()) {
        membersWindow.webContents.send('refresh-members');
    }
    
    console.log('[Main Process] join-all-test-users completed:', results);
    return { success: true, results };
});

// Kick all test users
ipcMain.handle('kick-all-test-users', async () => {
    console.log('[Main Process] kick-all-test-users called');
    const testUsers = ['TestUser1', 'TestUser2', 'TestUser3'];
    const results = [];
    
    for (const username of testUsers) {
        const userId = username.toLowerCase();
        
        // Remove from UserManager first (single source of truth)
        let removedFromManager = false;
        if (userManager && userManager.hasUser(userId)) {
            userManager.leaveUser(userId);
            removedFromManager = true;
            console.log('[Main Process] Removed test user from UserManager:', username);
        }
        
        // Also remove from legacy activeUsers for backward compatibility
        let removedFromLegacy = false;
        if (activeUsers.has(userId)) {
            const user = activeUsers.get(userId);
            activeUsers.delete(userId);
            removedFromLegacy = true;
            
            // Only broadcast manually if UserManager didn't handle it
            if (!removedFromManager) {
                addEvent('userKick', { username: user.username, userId });
                broadcastToWidget('userLeave', { username: user.username, userId });
            }
        }
        
        results.push({ username, success: true, removedFromManager, removedFromLegacy });
    }
    
    // Update Members window if open
    if (membersWindow && !membersWindow.isDestroyed()) {
        membersWindow.webContents.send('refresh-members');
    }
    
    console.log('[Main Process] kick-all-test-users completed:', results);
    return { success: true, results };
});

// Wait for widget to be initialized
async function waitForWidget(maxRetries = 15, delay = 200) {
    if (!widgetWindow || widgetWindow.isDestroyed()) {
        return false;
    }
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Since widget.html is loaded directly (not in iframe), check window.widget directly
            const isReady = await widgetWindow.webContents.executeJavaScript(`
                (function() {
                    const widget = window.widget || window.campfireWidget;
                    return !!(widget && widget.addUser && Array.isArray(widget.users));
                })()
            `);
            if (isReady) {
                console.log('[Main Process] Widget is ready after', i + 1, 'attempts');
                return true;
            }
        } catch (e) {
            console.log('[Main Process] Widget not ready yet, attempt', i + 1, 'error:', e.message);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    console.error('[Main Process] Widget not ready after', maxRetries, 'attempts');
    return false;
}

// Add single test user to widget (for individual toggle)
ipcMain.handle('add-test-user-to-widget', async (event, userId, username) => {
    console.log('[Main Process] add-test-user-to-widget called:', userId, username);
    
    if (!widgetWindow || widgetWindow.isDestroyed()) {
        return { success: false, error: 'Widget window not available' };
    }
    
    try {
        const color = await getViewerColor(username, userId);
        
        // Also add to activeUsers if not already there
        if (!activeUsers.has(userId)) {
            const user = {
                username,
                userId,
                color: color,
                selectedSprite: null,
                joinedAt: Date.now(),
                angle: Math.random() * 360,
                source: 'test-users-toggle',
                state: USER_STATES.JOINED  // Include state for buddy list
            };
            activeUsers.set(userId, user);
            addEvent('userJoin', user);
            broadcastToWidget('userJoin', user);
        }
        
        // Update Members window if open
        if (membersWindow && !membersWindow.isDestroyed()) {
            membersWindow.webContents.send('refresh-members');
        }
        
        return { success: true };
    } catch (err) {
        console.error('[Main Process] Error adding test user to widget:', err);
        return { success: false, error: err.message };
    }
});

// Remove single test user from widget (for individual toggle)
ipcMain.handle('remove-test-user-from-widget', async (event, userId, username) => {
    console.log('[Main Process] remove-test-user-from-widget called:', userId, username);
    
    if (!widgetWindow || widgetWindow.isDestroyed()) {
        return { success: false, error: 'Widget window not available' };
    }
    
    try {
        // Also remove from activeUsers
        if (activeUsers.has(userId)) {
            const user = activeUsers.get(userId);
            activeUsers.delete(userId);
            addEvent('userKick', { username: user.username, userId });
            broadcastToWidget('userLeave', { username: user.username, userId });
        }
        
        // Update Members window if open
        if (membersWindow && !membersWindow.isDestroyed()) {
            membersWindow.webContents.send('refresh-members');
        }
        
        // Update Dashboard window if open (refresh members list)
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            dashboardWindow.webContents.send('refresh-members');
        }
        
        return { success: true };
    } catch (err) {
        console.error('[Main Process] Error removing test user from widget:', err);
        return { success: false, error: err.message };
    }
});

// Events (for widget polling)
ipcMain.handle('get-events', (event, sinceId) => {
    const since = parseInt(sinceId) || 0;
    const newEvents = events.filter(e => e.id > since);
    return {
        events: newEvents,
        lastEventId: lastEventId
    };
});

// Sprite path management (keep existing handlers)
ipcMain.handle('get-sprite-path', async () => {
    const customPath = getCustomSpritePath();
    const defaultPath = getDefaultSpritePath();
    const effectivePath = getEffectiveSpritePath();
    
    return {
        customPath: customPath,
        defaultPath: defaultPath,
        effectivePath: effectivePath,
        isCustom: customPath !== null
    };
});

ipcMain.handle('set-sprite-path', async (event) => {
    const targetWindow = widgetWindow || dashboardWindow;
    if (!targetWindow) {
        return { success: false, error: 'No window available' };
    }
    
    try {
        const result = await dialog.showOpenDialog(targetWindow, {
            properties: ['openDirectory'],
            title: 'Select Default Sprites Folder',
            message: 'Select the folder containing your default sprites (should contain a "defaults" subfolder)'
        });
        
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }
        
        const selectedPath = result.filePaths[0];
        const defaultsPath = path.join(selectedPath, 'defaults');
        
        if (!fs.existsSync(defaultsPath)) {
            return {
                success: false,
                error: 'Selected folder does not contain a "defaults" subfolder. Please select the correct sprites folder.'
            };
        }
        
        const configPath = path.join(userDataPath, 'sprite-path.json');
        const config = { customPath: selectedPath };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        broadcastToWidget('sprite-path-changed', { path: selectedPath });
        
        return { success: true, path: selectedPath };
    } catch (error) {
        console.error('Error setting sprite path:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('reset-sprite-path', async () => {
    try {
        const configPath = path.join(userDataPath, 'sprite-path.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
        
        const defaultPath = getDefaultSpritePath();
        broadcastToWidget('sprite-path-changed', { path: defaultPath });
        
        return { success: true, path: defaultPath };
    } catch (error) {
        console.error('Error resetting sprite path:', error);
        return { success: false, error: error.message };
    }
});

// Auto-updater (keep existing handlers)
ipcMain.handle('check-for-updates', async () => {
    try {
        const isPrivateRepo = false;
        const githubToken = process.env.GH_TOKEN || null;
        
        const feedConfig = {
            provider: 'github',
            owner: 'jaredheafth',
            repo: 'offlineclub_widget_Campfire',
            private: isPrivateRepo
        };
        
        if (isPrivateRepo && githubToken) {
            feedConfig.token = githubToken;
        }
        
        autoUpdater.setFeedURL(feedConfig);
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
        console.error('Error checking for updates:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        console.error('Error downloading update:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('install-update', async () => {
    try {
        console.log('🔄 Preparing to install update...');
        // Use the same full shutdown path as the END button / closing the Visual Display,
        // so we don't leave invisible background processes that block NSIS replacement.
        shutdownEntireApp({ reason: 'install-update', forUpdate: true }).catch(() => {
            try { autoUpdater.quitAndInstall(false, true); } catch (e) { /* ignore */ }
            try { app.exit(0); } catch (e2) { /* ignore */ }
        });
        return { success: true };
    } catch (error) {
        console.error('Error installing update:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-app-version', () => {
    return { version: app.getVersion() };
});

ipcMain.handle('shutdown-app', async () => {
    console.log('🛑 Shutting down application...');
    shutdownEntireApp({ reason: 'shutdown-app' }).catch(() => {
        try { app.exit(0); } catch (e) { /* ignore */ }
    });
    return { success: true };
});

// ============================================
// AUTO-UPDATER CONFIGURATION
// ============================================

/**
 * Initialize auto-updater after app is ready.
 * This must be called inside app.whenReady() because electron-updater
 * requires the app to be ready before it can access app.getVersion().
 */
function initializeAutoUpdater() {
    // Lazy load electron-updater to avoid "Cannot read properties of undefined (reading 'getVersion')" error
    autoUpdater = require('electron-updater').autoUpdater;
    
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    // IMPORTANT (Windows):
    // - Leaving verifySignature at its default (true) helps avoid "unsigned updater" heuristics.
    // - We also avoid background update checks on Windows; updates are manual via the Dashboard button.
    //
    // NOTE: On some Windows systems, electron-updater refuses to apply NSIS updates unless the installer is code-signed.
    // If you are not code-signing yet, allow unsigned updates so the updater can function.
    if (process.platform === 'win32') {
        autoUpdater.verifySignature = false;
    }

    autoUpdater.on('before-quit-for-update', () => {
        isQuittingForUpdate = true;
    });

    autoUpdater.on('checking-for-update', () => {
        console.log('Checking for updates...');
        if (widgetWindow) {
            widgetWindow.webContents.send('update-status', { status: 'checking' });
        }
        if (dashboardWindow) {
            dashboardWindow.webContents.send('update-status', { status: 'checking' });
        }
    });

    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version);
        if (widgetWindow) {
            widgetWindow.webContents.send('update-status', {
                status: 'available',
                version: info.version,
                releaseDate: info.releaseDate
            });
        }
        if (dashboardWindow) {
            dashboardWindow.webContents.send('update-status', {
                status: 'available',
                version: info.version,
                releaseDate: info.releaseDate
            });
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('No update available');
        if (widgetWindow) {
            widgetWindow.webContents.send('update-status', {
                status: 'not-available',
                version: app.getVersion()
            });
        }
        if (dashboardWindow) {
            dashboardWindow.webContents.send('update-status', {
                status: 'not-available',
                version: app.getVersion()
            });
        }
    });

    autoUpdater.on('error', (err) => {
        console.error('Update error:', err);
        if (widgetWindow) {
            widgetWindow.webContents.send('update-status', {
                status: 'error',
                error: err.message
            });
        }
        if (dashboardWindow) {
            dashboardWindow.webContents.send('update-status', {
                status: 'error',
                error: err.message
            });
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        if (widgetWindow) {
            widgetWindow.webContents.send('update-progress', progressObj);
        }
        if (dashboardWindow) {
            dashboardWindow.webContents.send('update-progress', progressObj);
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info.version);
        if (widgetWindow) {
            widgetWindow.webContents.send('update-status', {
                status: 'downloaded',
                version: info.version
            });
        }
        if (dashboardWindow) {
            dashboardWindow.webContents.send('update-status', {
                status: 'downloaded',
                version: info.version
            });
        }
    });
    
    console.log('[Main] Auto-updater initialized');
}

// ============================================
// TRAY MENU
// ============================================

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    const fallbackIcon = path.join(__dirname, 'assets', 'icon.png');
    const icon = fs.existsSync(iconPath) ? iconPath : (fs.existsSync(fallbackIcon) ? fallbackIcon : null);
    
    if (!icon) {
        console.warn('Tray icon not found, skipping tray creation');
        return;
    }
    
    tray = new Tray(icon);
    
    updateTrayMenu();
    
    tray.on('click', () => {
        if (widgetWindow) {
            widgetWindow.show();
        } else {
            createWidgetWindow();
        }
    });
}

function updateTrayMenu() {
    if (!tray) return;
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: isTwitchConnected ? '🟢 Twitch Connected' : '🔴 Twitch Disconnected',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Open Widget',
            click: () => {
                if (widgetWindow) {
                    widgetWindow.show();
                } else {
                    createWidgetWindow();
                }
            }
        },
        {
            label: 'Open Dashboard',
            click: () => {
                createDashboardWindow();
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: async () => {
                if (twitchClient) {
                    twitchClient.disconnect();
                }
                app.quit();
            }
        }
    ]);
    
    tray.setContextMenu(contextMenu);
    tray.setToolTip('Campfire Widget');
}

// ============================================
// APP INITIALIZATION
// ============================================

// Register protocol scheme before app is ready
app.setAsDefaultProtocolClient('campfire-widget');
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'campfire-sprites',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true
        }
    }
]);

app.whenReady().then(() => {
    // Load modular state management system (lazy load to avoid circular dependency issues)
    const stateModules = require('./src/main');
    UserManager = stateModules.UserManager;
    UserPreferencesStore = stateModules.UserPreferencesStore;
    UserIPCHandlers = stateModules.UserIPCHandlers;
    UserManagerBridge = stateModules.UserManagerBridge;
    BotMessageHelper = stateModules.BotMessageHelper;
    IPC_CHANNELS = stateModules.IPC_CHANNELS;
    USER_STATES = stateModules.USER_STATES;
    console.log('[Main] State management modules loaded');
    
    // Initialize paths
    userDataPath = app.getPath('userData');
    settingsPath = path.join(userDataPath, 'campfire-widget-settings.json');
    viewerPrefsPath = path.join(userDataPath, 'viewer-prefs.json');
    botMessagesPath = path.join(userDataPath, 'bot-messages.json');
    
    // Load bot messages from file if they exist, ensuring defaults are present
    const savedBotMessages = loadBotMessagesFromFile();
    if (savedBotMessages && savedBotMessages.length > 0) {
        // Ensure all default commands are present (in case user accidentally deleted one)
        botMessagesCache = ensureDefaultCommands(savedBotMessages);
        // Save back if any defaults were restored
        if (botMessagesCache.length > savedBotMessages.length) {
            saveBotMessagesToFile(botMessagesCache);
        }
        console.log('[Main] Loaded', botMessagesCache.length, 'bot messages from file');
    } else {
        // No saved messages, use defaults
        botMessagesCache = getDefaultBotMessages();
        saveBotMessagesToFile(botMessagesCache);
        console.log('[Main] Initialized', botMessagesCache.length, 'default bot messages');
    }

    // ============================================
    // INITIALIZE NEW STATE MANAGEMENT SYSTEM
    // ============================================
    
    // 1. Create preferences store (persistent user data)
    userPreferencesStore = new UserPreferencesStore(userDataPath);
    console.log('[Main] UserPreferencesStore initialized');
    
    // 2. Create user manager (session state - single source of truth)
    userManager = new UserManager({
        preferencesStore: userPreferencesStore
    });
    console.log('[Main] UserManager initialized');
    
    // 3. Create backward-compatible bridge (allows gradual migration)
    // This provides Map-like interface while using UserManager internally
    userManagerBridge = new UserManagerBridge(userManager, {
        broadcastToWidget: (event, data) => {
            if (widgetWindow && !widgetWindow.isDestroyed()) {
                widgetWindow.webContents.send(event, data);
            }
        },
        addEvent: (type, data) => {
            events.push({ id: ++lastEventId, type, data, timestamp: Date.now() });
            if (events.length > 100) events.shift();
        },
        loadViewerPrefs,
        saveViewerPrefsFile
    });
    console.log('[Main] UserManagerBridge initialized');
    
    // 4. Import legacy preferences if they exist
    const legacyPrefs = loadViewerPrefs();
    if (Object.keys(legacyPrefs).length > 0) {
        userManagerBridge.importLegacyPreferences(legacyPrefs)
            .then(count => {
                if (count > 0) {
                    console.log(`[Main] Imported ${count} legacy user preferences`);
                }
            })
            .catch(err => {
                console.error('[Main] Error importing legacy preferences:', err);
            });
    }
    
    // ============================================
    // END STATE MANAGEMENT INITIALIZATION
    // ============================================

    // Register custom protocol handler
    registerSpriteProtocol();

    // Load Twitch config
    loadTwitchConfig();

    // Initialize streamer/bot accounts in chatters (so dashboard shows them as "In Chat" immediately)
    initializeStreamerBotChatters();

    // Initialize auto-updater (must be done after app is ready)
    initializeAutoUpdater();

    // Set up auto-updater feed config (Windows: do not auto-check in background)
    const isPrivateRepo = false;
    const githubToken = process.env.GH_TOKEN || null;
    const feedConfig = {
        provider: 'github',
        owner: 'jaredheafth',
        repo: 'offlineclub_widget_Campfire',
        private: isPrivateRepo
    };
    if (isPrivateRepo && githubToken) {
        feedConfig.token = githubToken;
    }
    try {
        autoUpdater.setFeedURL(feedConfig);
    } catch (e) {
        console.warn('[Updater] setFeedURL failed:', e && e.message);
    }
    
    // Create windows
    createWidgetWindow();
    createTray();
    
    // Register bot message IPC handlers (must be after app.whenReady)
    registerBotMessageIPCHandlers();
    
    // Initialize User IPC handlers (after windows are created)
    // This registers IPC handlers for user operations and forwards events to renderers
    userIPCHandlers = new UserIPCHandlers(userManager, {
        widget: widgetWindow,
        dashboard: dashboardWindow,
        members: membersWindow,
        chatPopout: chatPopoutWindow,
        buddyList: buddyListWindow
    });
    userIPCHandlers.register();
    console.log('[Main] UserIPCHandlers registered');
    
    // Initialize Bot Message Helper (for centralized bot message sending)
    botMessageHelper = new BotMessageHelper({
        sayInChannel: sayInChannel,
        sendToPopoutChat: sendToPopoutChat,
        getDashboardWindow: () => dashboardWindow,
        getBotMessagesCache: () => botMessagesCache
    });
    console.log('[Main] BotMessageHelper initialized');
    
    // Listen for auto-return events (user chatted while in SLEEPY/AFK state)
    userManager.on('user:autoReturn', async (user, previousState) => {
        console.log(`[Main] Auto-return detected for ${user.username} from ${previousState}`);
        try {
            await botMessageHelper.sendBotMessage('auto-return', {
                username: user.username
            }, {
                commandCategory: 'AUTO_STATE'
            });
        } catch (error) {
            console.error('[Main] Error sending auto-return message:', error);
        }
    });
    console.log('[Main] Auto-return event listener registered');

    // Listen for auto-state transitions (SLEEPY, AFK from inactivity)
    userManager.on('user:stateChanged', async (user, oldState, newState) => {
        // Normalize states to uppercase for comparison
        const normalizedNewState = newState.toUpperCase();
        const normalizedOldState = oldState ? oldState.toUpperCase() : oldState;

        // Only process auto-transitions (not manual commands)
        // Manual commands are handled by their respective command handlers

        // Check for SLEEPY transition (auto-triggered from inactivity)
        if (normalizedNewState === 'SLEEPY' && (normalizedOldState === 'ACTIVE' || normalizedOldState === 'JOINED')) {
            console.log(`[Main] Auto-sleepy detected for ${user.username}`);
            try {
                await botMessageHelper.sendBotMessage('sleepy', {
                    username: user.username
                }, {
                    commandCategory: 'AUTO_STATE'
                });
            } catch (error) {
                console.error('[Main] Error sending sleepy message:', error);
            }
        }
        // Check for AFK transition (auto-triggered from inactivity)
        // Note: manual AFK is handled by the !afk command handler
        else if (normalizedNewState === 'AFK' && normalizedOldState !== 'AFK') {
            // Determine if this was an auto-transition or manual
            // Auto-transitions come from SLEEPY or ACTIVE via widget state updates
            // Manual AFK comes from setUserAfk which sets manualAfk flag
            const isAutoTransition = (normalizedOldState === 'SLEEPY' || normalizedOldState === 'ACTIVE' || normalizedOldState === 'JOINED') && !user.manualAfk;

            if (isAutoTransition) {
                console.log(`[Main] Auto-afk detected for ${user.username}`);
                try {
                    await botMessageHelper.sendBotMessage('auto-afk', {
                        username: user.username
                    }, {
                        commandCategory: 'AUTO_STATE'
                    });
                } catch (error) {
                    console.error('[Main] Error sending auto-afk message:', error);
                }
            }
        }
    });
    console.log('[Main] Auto-state transition listener registered');
    
    // Connect to Twitch
    console.log('[Main] About to call connectTwitch() on startup');
    connectTwitch();
    
    // Background update checks can trigger AV/Defender heuristics for unsigned Electron apps.
    // Keep updates manual on Windows (Dashboard "Check for Updates" button).
    const shouldBackgroundCheckUpdates = app.isPackaged && process.platform !== 'win32';
    if (shouldBackgroundCheckUpdates) {
        // Check for updates shortly after startup
        setTimeout(() => {
            autoUpdater.checkForUpdates().catch(err => {
                console.error('Error checking for updates on startup:', err);
            });
        }, 5000);

        // Periodic update checks
        setInterval(() => {
            autoUpdater.checkForUpdates().catch(err => {
                console.error('Error checking for updates:', err);
            });
        }, 4 * 60 * 60 * 1000); // 4 hours
    } else {
        console.log('[Updater] Background update checks disabled on this platform/build.');
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWidgetWindow();
    }
});

app.on('window-all-closed', () => {
    // Best practice for this app: never keep an invisible background process.
    // If all windows are closed, quit (dashboard-only close won't trigger this).
    if (!isQuittingApp && !isQuittingForUpdate) {
        app.quit();
    }
});

app.on('before-quit', async (event) => {
    // Disconnect Twitch before quit
    if (isQuittingForUpdate || isQuittingApp) {
        // Don't block quitting during updater installs or explicit shutdown paths
        try { twitchClient?.disconnect(); } catch (e) { /* ignore */ }
        try { twitchChatClient?.disconnect(); } catch (e) { /* ignore */ }
        // Flush user preferences to disk
        try { userPreferencesStore?.flush(); } catch (e) { /* ignore */ }
        return;
    }
    if (twitchClient || twitchChatClient || userPreferencesStore) {
        event.preventDefault();
        try { twitchClient?.disconnect(); } catch (e) { /* ignore */ }
        try { twitchChatClient?.disconnect(); } catch (e) { /* ignore */ }
        // Flush user preferences to disk before quitting
        try { await userPreferencesStore?.flush(); } catch (e) { /* ignore */ }
        twitchClient = null;
        twitchChatClient = null;
        isTwitchConnected = false;
        isTwitchChatConnected = false;
        setTimeout(() => {
            app.quit();
        }, 500);
    }
});
