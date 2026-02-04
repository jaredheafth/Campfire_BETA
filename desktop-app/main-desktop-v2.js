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
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const tmi = require('tmi.js');

// ============================================
// GLOBAL STATE
// ============================================
let widgetWindow;        // Primary window - the widget view (for OBS)
let dashboardWindow;     // Secondary window - streamer dashboard
let memberDashboardWindows = new Map(); // Individual viewer dashboards
let tray;
let twitchClient = null;
let isTwitchConnected = false;

// Active users and chat state
let activeUsers = new Map(); // userId -> user data
let allChatters = new Map(); // username -> user info (for potential members list)
let events = []; // Event queue for widget updates
let lastEventId = 0;

// Settings storage
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'campfire-widget-settings.json');

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

function createWidgetWindow() {
    // Load saved window dimensions
    const savedDimensions = loadWindowDimensions();
    
    widgetWindow = new BrowserWindow({
        width: savedDimensions.width,
        height: savedDimensions.height,
        minWidth: 600,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            backgroundThrottling: false // Keep animations smooth
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Campfire Widget',
        backgroundColor: '#000000',
        frame: true, // Keep frame for menu bar
        transparent: false, // Widget itself is transparent, but window has frame
        resizable: !savedDimensions.locked
    });

    // Load widget HTML
    const widgetPath = path.join(__dirname, 'server', 'widget.html');
    widgetWindow.loadFile(widgetPath);

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        widgetWindow.webContents.openDevTools();
    }

    widgetWindow.on('closed', () => {
        widgetWindow = null;
    });
    
    widgetWindow.on('resize', () => {
        if (widgetWindow && !windowDimensions.locked) {
            const bounds = widgetWindow.getBounds();

            // Enforce minimum dimensions programmatically
            const minWidth = 600;
            const minHeight = 600;
            let needsResize = false;

            if (bounds.width < minWidth) {
                bounds.width = minWidth;
                needsResize = true;
            }
            if (bounds.height < minHeight) {
                bounds.height = minHeight;
                needsResize = true;
            }

            if (needsResize) {
                widgetWindow.setBounds(bounds);
            }

            windowDimensions.width = bounds.width;
            windowDimensions.height = bounds.height;
            saveWindowDimensions();
        }
    });
}

function createDashboardWindow(tab = null) {
    if (dashboardWindow) {
        dashboardWindow.focus();
        if (tab) {
            dashboardWindow.webContents.send('switch-tab', tab);
        }
        return;
    }

    dashboardWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Campfire Widget - Dashboard',
        backgroundColor: '#1a1a1a'
    });

    const dashboardPath = path.join(__dirname, 'server', 'dashboard.html');
    dashboardWindow.loadFile(dashboardPath);

    if (process.env.NODE_ENV === 'development') {
        dashboardWindow.webContents.openDevTools();
    }

    dashboardWindow.on('closed', () => {
        dashboardWindow = null;
    });
    
    // Switch to specific tab if requested
    if (tab) {
        dashboardWindow.webContents.once('did-finish-load', () => {
            dashboardWindow.webContents.send('switch-tab', tab);
        });
    }
}

function createMemberDashboardWindow(userId, username) {
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
        query: { userId, username }
    });

    memberWindow.on('closed', () => {
        memberDashboardWindows.delete(userId);
    });

    memberDashboardWindows.set(userId, memberWindow);
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
            twitchConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading Twitch config:', e);
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

function connectTwitch() {
    if (twitchClient) {
        twitchClient.disconnect();
        twitchClient = null;
    }

    if (!twitchConfig.botUsername || !twitchConfig.oauthToken || !twitchConfig.channelName) {
        console.log('⚠️  Twitch credentials not configured');
        return;
    }

    if (twitchConfig.oauthToken && !twitchConfig.oauthToken.startsWith('oauth:')) {
        twitchConfig.oauthToken = 'oauth:' + twitchConfig.oauthToken;
    }

    twitchClient = new tmi.Client({
        options: { debug: false },
        connection: {
            reconnect: true,
            secure: true
        },
        identity: {
            username: twitchConfig.botUsername,
            password: twitchConfig.oauthToken
        },
        channels: [twitchConfig.channelName]
    });

    // Event handlers
    twitchClient.on('connected', (addr, port) => {
        console.log(`✅ Connected to Twitch IRC: ${addr}:${port}`);
        console.log(`📺 Monitoring channel: #${twitchConfig.channelName}`);
        isTwitchConnected = true;
        broadcastToWidget('twitchConnected', { connected: true });
    });

    twitchClient.on('disconnected', (reason) => {
        console.log(`❌ Disconnected from Twitch: ${reason}`);
        isTwitchConnected = false;
        broadcastToWidget('twitchDisconnected', { connected: false });
    });

    twitchClient.on('join', (channel, username, self) => {
        if (self) {
            console.log(`✅ Joined channel: ${channel}`);
        } else {
            // Track all chatters for potential members list
            allChatters.set(username.toLowerCase(), {
                username,
                joinedAt: Date.now()
            });
            updatePotentialMembersList();
        }
    });

    twitchClient.on('part', (channel, username) => {
        allChatters.delete(username.toLowerCase());
        updatePotentialMembersList();
    });

    twitchClient.on('message', (channel, tags, message, self) => {
        if (self) return;

        const username = tags['display-name'] || tags.username;
        const userId = tags['user-id'];
        
        // Track chatter
        allChatters.set(username.toLowerCase(), {
            username,
            userId,
            lastMessage: Date.now()
        });
        updatePotentialMembersList();

        // Parse chat commands
        parseChatCommand(username, userId, message, tags);
    });

    twitchClient.connect().catch(err => {
        console.error('Error connecting to Twitch:', err);
        isTwitchConnected = false;
    });
}

// ============================================
// CHAT COMMAND PARSING
// ============================================

function parseChatCommand(username, userId, message, tags) {
    const command = message.trim().toLowerCase();
    
    // Join command
    if (command === '!join' || command.startsWith('!join ')) {
        handleJoinCommand(username, userId, tags);
        return;
    }
    
    // Leave command
    if (command === '!leave' || command === '!exit') {
        handleLeaveCommand(username, userId);
        return;
    }
    
    // Clockwise movement
    if (command.startsWith('!cw')) {
        const match = command.match(/!cw(?:\s+(\d+))?/);
        const degrees = match && match[1] ? parseInt(match[1]) : 17; // Default 17 degrees
        handleMoveCommand(username, userId, 1, degrees); // 1 = clockwise
        return;
    }
    
    // Counter-clockwise movement
    if (command.startsWith('!ccw')) {
        const match = command.match(/!ccw(?:\s+(\d+))?/);
        const degrees = match && match[1] ? parseInt(match[1]) : 17; // Default 17 degrees
        handleMoveCommand(username, userId, -1, degrees); // -1 = counter-clockwise
        return;
    }
    
    // Change sprite command
    if (command.startsWith('!changesprite ') || command.startsWith('!sprite ')) {
        const spriteName = command.replace(/!changesprite\s+|!sprite\s+/, '').trim();
        handleSpriteCommand(username, userId, spriteName);
        return;
    }
    
    // Change color command
    if (command.startsWith('!changecolor ') || command.startsWith('!color ')) {
        const color = command.replace(/!changecolor\s+|!color\s+/, '').trim();
        handleColorCommand(username, userId, color);
        return;
    }
}

function handleJoinCommand(username, userId, tags) {
    // Check permissions (subscriber, prime, etc.) - implement based on settings
    // For now, allow everyone
    
    if (activeUsers.has(userId)) {
        return; // Already joined
    }
    
    const user = {
        username,
        userId,
        color: getViewerColor(username, userId),
        selectedSprite: null, // Default sprite
        joinedAt: Date.now(),
        angle: Math.random() * 360, // Random starting position
        source: 'chat-command'
    };
    
    activeUsers.set(userId, user);
    addEvent('userJoin', user);
    broadcastToWidget('userJoin', user);
    
    console.log(`🔥 ${username} joined via !join command`);
}

function handleLeaveCommand(username, userId) {
    if (!activeUsers.has(userId)) {
        return;
    }
    
    const user = activeUsers.get(userId);
    activeUsers.delete(userId);
    addEvent('userLeave', { username, userId });
    broadcastToWidget('userLeave', { username, userId });
    
    console.log(`👋 ${username} left via !leave command`);
}

function handleMoveCommand(username, userId, direction, degrees) {
    // direction: 1 = clockwise, -1 = counter-clockwise
    // degrees: amount to move (0-360)
    
    if (!activeUsers.has(userId)) {
        return; // User not joined
    }
    
    const user = activeUsers.get(userId);
    const currentAngle = user.angle || 0;
    
    // Calculate new angle (clockwise = +, counter-clockwise = -)
    let newAngle = currentAngle + (direction * degrees);
    
    // Normalize to 0-360
    newAngle = ((newAngle % 360) + 360) % 360;
    
    user.angle = newAngle;
    activeUsers.set(userId, user);
    
    addEvent('viewerMovement', {
        username,
        userId,
        angle: newAngle,
        direction,
        degrees
    });
    
    broadcastToWidget('viewerMovement', {
        username,
        userId,
        angle: newAngle
    });
    
    console.log(`🔄 ${username} moved ${direction > 0 ? 'clockwise' : 'counter-clockwise'} ${degrees}° to ${newAngle}°`);
}

function handleSpriteCommand(username, userId, spriteName) {
    if (!activeUsers.has(userId)) {
        return;
    }
    
    const user = activeUsers.get(userId);
    user.selectedSprite = spriteName;
    activeUsers.set(userId, user);
    
    addEvent('viewerSpriteChange', {
        username,
        userId,
        sprite: spriteName
    });
    
    broadcastToWidget('viewerSpriteChange', {
        username,
        userId,
        sprite: spriteName
    });
    
    console.log(`🎨 ${username} changed sprite to ${spriteName}`);
}

function handleColorCommand(username, userId, color) {
    if (!activeUsers.has(userId)) {
        return;
    }
    
    // Parse color (hex, named color, etc.)
    const parsedColor = parseColor(color);
    if (!parsedColor) {
        return; // Invalid color
    }
    
    const user = activeUsers.get(userId);
    user.color = parsedColor;
    activeUsers.set(userId, user);
    
    addEvent('viewerColorChange', {
        username,
        userId,
        color: parsedColor
    });
    
    broadcastToWidget('viewerColorChange', {
        username,
        userId,
        color: parsedColor
    });
    
    console.log(`🎨 ${username} changed color to ${parsedColor}`);
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

function getViewerColor(username, userId) {
    // Try to get saved color from userData
    const colorsPath = path.join(userDataPath, 'viewer-colors.json');
    try {
        if (fs.existsSync(colorsPath)) {
            const colors = JSON.parse(fs.readFileSync(colorsPath, 'utf8'));
            if (colors[userId]) {
                return colors[userId];
            }
        }
    } catch (e) {
        // Ignore errors
    }
    
    // Generate color from username hash
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
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
}

function broadcastToWidget(channel, data) {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.webContents.send(channel, data);
    }
}

function updatePotentialMembersList() {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        const chatters = Array.from(allChatters.values());
        dashboardWindow.webContents.send('potentialMembersUpdate', chatters);
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
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        // Broadcast to widget
        broadcastToWidget('settingsUpdate', settings);
    } catch (e) {
        console.error('Error saving settings:', e);
    }
}

function loadWindowDimensions() {
    const dimsPath = path.join(userDataPath, 'window-dimensions.json');
    try {
        if (fs.existsSync(dimsPath)) {
            return JSON.parse(fs.readFileSync(dimsPath, 'utf8'));
        }
    } catch (e) {
        // Ignore
    }
    return { width: 1920, height: 1080, locked: true };
}

function saveWindowDimensions() {
    const dimsPath = path.join(userDataPath, 'window-dimensions.json');
    try {
        fs.writeFileSync(dimsPath, JSON.stringify(windowDimensions, null, 2));
    } catch (e) {
        console.error('Error saving window dimensions:', e);
    }
}

// ============================================
// IPC HANDLERS
// ============================================

// Window management
ipcMain.handle('open-dashboard', (event, tab) => {
    createDashboardWindow(tab);
    return { success: true };
});

ipcMain.handle('open-member-dashboard', (event, userId, username) => {
    createMemberDashboardWindow(userId, username);
    return { success: true };
});

ipcMain.handle('get-window-dimensions', () => {
    return windowDimensions;
});

ipcMain.handle('set-window-dimensions', (event, dimensions) => {
    windowDimensions = { ...windowDimensions, ...dimensions };
    saveWindowDimensions();
    
    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.setSize(windowDimensions.width, windowDimensions.height);
        widgetWindow.setResizable(!windowDimensions.locked);
    }
    
    return { success: true };
});

ipcMain.handle('toggle-window-lock', () => {
    // Store current dimensions before toggling to prevent Electron auto-resize
    const currentBounds = widgetWindow && !widgetWindow.isDestroyed() ?
        widgetWindow.getBounds() : null;

    windowDimensions.locked = !windowDimensions.locked;
    saveWindowDimensions();

    if (widgetWindow && !widgetWindow.isDestroyed()) {
        widgetWindow.setResizable(!windowDimensions.locked);
        // Restore original dimensions if they changed due to resizable state change
        if (currentBounds) {
            const newBounds = widgetWindow.getBounds();
            if (newBounds.width !== currentBounds.width || newBounds.height !== currentBounds.height) {
                widgetWindow.setBounds(currentBounds);
            }
        }
    }

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

// Twitch
ipcMain.handle('get-twitch-config', () => {
    return twitchConfig;
});

ipcMain.handle('save-twitch-config', (event, config) => {
    twitchConfig = config;
    saveTwitchConfig();
    connectTwitch(); // Reconnect with new config
    return { success: true };
});

ipcMain.handle('get-twitch-status', () => {
    return { connected: isTwitchConnected };
});

// Users/Members
ipcMain.handle('get-active-users', () => {
    return Array.from(activeUsers.values());
});

ipcMain.handle('get-potential-members', () => {
    return Array.from(allChatters.values());
});

ipcMain.handle('kick-member', (event, userId) => {
    if (activeUsers.has(userId)) {
        const user = activeUsers.get(userId);
        activeUsers.delete(userId);
        addEvent('userKick', { username: user.username, userId });
        broadcastToWidget('userLeave', { username: user.username, userId });
        return { success: true };
    }
    return { success: false, error: 'User not found' };
});

ipcMain.handle('join-member', (event, userId, username) => {
    if (activeUsers.has(userId)) {
        return { success: false, error: 'User already joined' };
    }
    
    const user = {
        username,
        userId,
        color: getViewerColor(username, userId),
        selectedSprite: null,
        joinedAt: Date.now(),
        angle: Math.random() * 360,
        source: 'manual'
    };
    
    activeUsers.set(userId, user);
    addEvent('userJoin', user);
    broadcastToWidget('userJoin', user);
    
    return { success: true };
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
        
        // Disconnect Twitch
        if (twitchClient) {
            twitchClient.disconnect();
            twitchClient = null;
        }
        
        // Close all windows
        BrowserWindow.getAllWindows().forEach(win => win.destroy());
        
        // Destroy tray
        if (tray) {
            tray.destroy();
            tray = null;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('[Main] Calling quitAndInstall...');
        autoUpdater.quitAndInstall(false, true);
        
        // Fallback: ensure app quits if quitAndInstall doesn't work
        setTimeout(() => {
            console.log('[Main] Fallback: calling app.quit() after quitAndInstall...');
            app.quit();
        }, 1000);
        
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
    
    // Disconnect Twitch
    if (twitchClient) {
        twitchClient.disconnect();
        twitchClient = null;
    }
    
    // Close all windows
    BrowserWindow.getAllWindows().forEach(win => win.destroy());
    
    // Destroy tray
    if (tray) {
        tray.destroy();
        tray = null;
    }
    
    setTimeout(() => {
        app.exit(0);
    }, 1000);
    
    return { success: true };
});

// ============================================
// AUTO-UPDATER CONFIGURATION
// ============================================

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

// Disable signature verification for unsigned installers
// electron-updater v6.x uses different APIs, so we use try-catch for safety
try {
    // New API for v6.x
    if (typeof autoUpdater.disableWin32CertCheck !== 'undefined') {
        autoUpdater.disableWin32CertCheck = true;
    }
    // Legacy API for older versions
    if (typeof autoUpdater.verifySignature !== 'undefined') {
        autoUpdater.verifySignature = false;
    }
} catch (e) {
    console.warn('[Updater] Could not configure signature verification:', e.message);
}

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

// ============================================
// TRAY MENU
// ============================================

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    tray = new Tray(iconPath || path.join(__dirname, 'assets', 'icon.png'));
    
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

app.whenReady().then(() => {
    // Register custom protocol
    registerSpriteProtocol();
    
    // Load Twitch config
    loadTwitchConfig();
    
    // Set up auto-updater
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
    
    // Create windows
    createWidgetWindow();
    createTray();
    
    // Connect to Twitch
    connectTwitch();
    
    // Check for updates
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
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWidgetWindow();
    }
});

app.on('window-all-closed', () => {
    // Keep app running in tray
});

app.on('before-quit', async (event) => {
    // Disconnect Twitch before quit
    if (twitchClient) {
        event.preventDefault();
        twitchClient.disconnect();
        twitchClient = null;
        setTimeout(() => {
            app.quit();
        }, 500);
    }
});

app.setAsDefaultProtocolClient('campfire-widget');
