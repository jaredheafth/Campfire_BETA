/**
 * Campfire Widget - Local Chat Server (LEGACY/DEPRECATED)
 * 
 * ⚠️ WARNING: This is a legacy/optional server for browser-based hosting.
 * 
 * RECOMMENDED: Use the Desktop Application instead!
 * - Download the installer from GitHub releases (Windows .exe or macOS .dmg)
 * - It includes everything you need: widget, dashboard, Twitch connection
 * - One-click install, automatic updates, system tray integration
 * - See: desktop-app/ folder and BUILD_INSTRUCTIONS.md
 * 
 * This standalone server is only recommended if you want to:
 * - Host the widget on your own web server
 * - Use it with StreamLabs or other OBS plugins
 * - Run it on non-Windows/macOS platforms
 * 
 * To use this legacy server:
 * 1. npm install express tmi.js
 * 2. Get OAuth token from https://twitchtokengenerator.com/ (scope: chat:read)
 * 3. Update the config below with your Twitch credentials
 * 4. Run: node server.js
 */

const express = require('express');
const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { execSync } = require('child_process');

const app = express();
// Railway sets PORT automatically, fallback to 3000 for local dev
const PORT = process.env.PORT || 3000;

// Handle Electron app.asar path resolution
// Priority: 1) Custom path from Electron, 2) Unpacked path, 3) Asar path, 4) Dev path
let appDir = __dirname;
let spritesDir;

console.log('🔍 Path resolution debug:');
console.log('  __dirname:', __dirname);
console.log('  ELECTRON_IS_DEV:', process.env.ELECTRON_IS_DEV);
console.log('  CUSTOM_SPRITE_PATH:', process.env.CUSTOM_SPRITE_PATH);

// Priority 1: Check for custom path from Electron main process
if (process.env.CUSTOM_SPRITE_PATH && fs.existsSync(process.env.CUSTOM_SPRITE_PATH)) {
    spritesDir = process.env.CUSTOM_SPRITE_PATH;
    console.log('✅ Using custom sprite path from Electron:', spritesDir);
} else if (process.env.ELECTRON_IS_DEV !== '1' && __dirname.includes('.asar')) {
    // Priority 2: We're in a packaged Electron app - check unpacked directory
    const unpackedDir = __dirname.replace('app.asar', 'app.asar.unpacked');
    const unpackedSprites = path.join(unpackedDir, 'sprites');
    
    console.log('  unpackedDir:', unpackedDir);
    console.log('  unpackedSprites:', unpackedSprites);
    console.log('  unpackedSprites exists:', fs.existsSync(unpackedSprites));
    
    // Check if unpacked sprites exist, use them if available
    if (fs.existsSync(unpackedSprites)) {
        spritesDir = unpackedSprites;
        console.log('✅ Using unpacked sprites from:', spritesDir);
    } else {
        // Priority 3: Fallback to asar path
        spritesDir = path.join(__dirname, 'sprites');
        console.log('⚠️  Unpacked sprites not found, using asar path:', spritesDir);
        console.log('⚠️  Attempting to check if sprites exist in asar path...');
        if (fs.existsSync(spritesDir)) {
            console.log('✅ Sprites found in asar path:', spritesDir);
        } else {
            console.error('❌ Sprites NOT found in asar path:', spritesDir);
        }
    }
} else {
    // Priority 4: Development path
    spritesDir = path.join(__dirname, 'sprites');
    console.log('  Using development path:', spritesDir);
    if (fs.existsSync(spritesDir)) {
        console.log('✅ Sprites directory exists:', spritesDir);
    } else {
        console.error('❌ Sprites directory NOT found:', spritesDir);
    }
}

// Verify sprites directory structure
if (fs.existsSync(spritesDir)) {
    const defaultsPath = path.join(spritesDir, 'defaults');
    console.log('  Checking defaults directory:', defaultsPath);
    if (fs.existsSync(defaultsPath)) {
        console.log('✅ Defaults directory exists');
        const rpgPath = path.join(defaultsPath, 'rpg-characters');
        if (fs.existsSync(rpgPath)) {
            const rpgFiles = fs.readdirSync(rpgPath).filter(f => f.endsWith('.gif'));
            console.log(`  Found ${rpgFiles.length} RPG sprite files`);
        }
    } else {
        console.error('❌ Defaults directory NOT found:', defaultsPath);
    }
}

// ============================================
// CONFIGURATION - Supports Railway (env vars) and local dev
// ============================================
const CONFIG = {
    // Your Twitch bot username (can be your main account)
    // Railway: Set TWITCH_BOT_USERNAME environment variable
    BOT_USERNAME: process.env.TWITCH_BOT_USERNAME || 'YOUR_TWITCH_USERNAME',
    
    // Get from https://twitchtokengenerator.com/
    // Select scope: chat:read
    // Railway: Set TWITCH_OAUTH_TOKEN environment variable (include 'oauth:' prefix)
    OAUTH_TOKEN: process.env.TWITCH_OAUTH_TOKEN || 'oauth:YOUR_OAUTH_TOKEN_HERE',
    
    // Your Twitch channel name (without the #)
    // Railway: Set TWITCH_CHANNEL_NAME environment variable
    CHANNEL_NAME: process.env.TWITCH_CHANNEL_NAME || 'YOUR_CHANNEL_NAME'
};
// ============================================

// Enable CORS - supports both local dev and Railway deployment
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    process.env.RAILWAY_PUBLIC_DOMAIN,  // Railway provides this
    process.env.WIDGET_DOMAIN,  // Custom domain if set
    process.env.FRONTEND_URL  // Frontend URL if separate
].filter(Boolean);

app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Allow requests from allowed origins, or all origins in development
    if (process.env.NODE_ENV === 'production' && origin) {
        if (allowedOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
        }
    } else {
        // Development: allow all origins
        res.header('Access-Control-Allow-Origin', origin || '*');
    }
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Parse JSON bodies
app.use(express.json());

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({ 
    dest: tempDir,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Serve static files (widget.html, dashboard.html, etc.)
// Use appDir to handle both asar and unpacked files
app.use(express.static(appDir));

// Always serve sprites from spritesDir (handles both asar and unpacked paths)
// This ensures sprites are accessible at /sprites/... URLs
if (fs.existsSync(spritesDir)) {
    app.use('/sprites', express.static(spritesDir));
    console.log('✅ Serving sprites from:', spritesDir);
    console.log('✅ Sprite files will be available at: http://localhost:' + (process.env.PORT || 3000) + '/sprites/...');
    
    // Test endpoint to verify sprite files are accessible
    app.get('/test-sprites', (req, res) => {
        try {
            const defaultsPath = path.join(spritesDir, 'defaults');
            const rpgPath = path.join(defaultsPath, 'rpg-characters');
            const circlesPath = path.join(defaultsPath, 'circles');
            const morphsPath = path.join(defaultsPath, 'pixel-morphs');
            
            const result = {
                spritesDir: spritesDir,
                exists: fs.existsSync(spritesDir),
                defaultsExists: fs.existsSync(defaultsPath),
                rpgExists: fs.existsSync(rpgPath),
                circlesExists: fs.existsSync(circlesPath),
                morphsExists: fs.existsSync(morphsPath),
                rpgFiles: fs.existsSync(rpgPath) ? fs.readdirSync(rpgPath).filter(f => f.endsWith('.gif')).slice(0, 5) : [],
                circlesFiles: fs.existsSync(circlesPath) ? fs.readdirSync(circlesPath).filter(f => f.endsWith('.gif') || f.endsWith('.svg')).slice(0, 5) : [],
                morphsFiles: fs.existsSync(morphsPath) ? fs.readdirSync(morphsPath).filter(f => f.endsWith('.gif')).slice(0, 5) : []
            };
            
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
} else {
    console.error('❌ ERROR: Sprites directory does not exist:', spritesDir);
    console.error('❌ Sprite serving is disabled!');
}

// Store active users and recent events
let activeUsers = new Map();
let lastEventId = 0;
let events = [];

// Twitch IRC Client (only connect if credentials are configured)
let client = null;
if (CONFIG.BOT_USERNAME && CONFIG.BOT_USERNAME !== 'YOUR_TWITCH_USERNAME' && 
    CONFIG.OAUTH_TOKEN && CONFIG.OAUTH_TOKEN !== 'YOUR_OAUTH_TOKEN') {
    client = new tmi.Client({
        options: { 
            debug: false // Set to true for debugging
        },
        connection: {
            reconnect: true,
            secure: true
        },
        identity: {
            username: CONFIG.BOT_USERNAME,
            password: CONFIG.OAUTH_TOKEN
        },
        channels: [CONFIG.CHANNEL_NAME]
    });

    // Connect to Twitch
    client.connect().catch(console.error);
} else {
    console.log('⚠️  Twitch credentials not configured - server will run without chat integration');
    console.log('   Static files will still be served');
}

// Event handlers (only if client exists)
if (client) {
    client.on('connected', (addr, port) => {
        console.log(`✅ Connected to Twitch IRC: ${addr}:${port}`);
        console.log(`📺 Monitoring channel: #${CONFIG.CHANNEL_NAME}`);
    });

    client.on('disconnected', (reason) => {
        console.log(`❌ Disconnected from Twitch: ${reason}`);
    });

    client.on('join', (channel, username, self) => {
        if (self) {
            console.log(`✅ Joined channel: ${channel}`);
        }
    });
}

// Load settings from localStorage (set by dashboard)
function getSettings() {
    try {
        const settingsJson = fs.readFileSync(
            path.join(__dirname, 'campfire-widget-settings.json'),
            'utf8'
        );
        return JSON.parse(settingsJson);
    } catch (e) {
        // Return defaults if no settings file
        return {
            joinMethod: 'command',
            command: '!join',
            emoteName: '',
            subscriberOnly: false,
            subTier2Only: false,
            subTier3Only: false,
            vipOnly: false,
            primeOnly: false,
            bitsRequired: 0
        };
    }
}

// Check if user can join based on settings
function canUserJoin(tags, settings) {
    const isSubscriber = tags.subscriber === true;
    const subTier = tags.badges?.subscriber ? parseInt(tags.badges.subscriber.split('/')[0]) || 1 : 0;
    const isPrime = tags.badges?.premium === '1';
    const isVip = tags.badges?.vip === '1';
    const isMod = tags.mod === true;
    const isBroadcaster = tags.badges?.broadcaster === '1';
    
    // Broadcaster and mods can always join
    if (isBroadcaster || isMod) return true;
    
    // Check VIP only
    if (settings.vipOnly && !isVip) return false;
    
    // Check Prime only
    if (settings.primeOnly && !isPrime) return false;
    
    // Check subscriber requirements
    if (settings.subTier3Only && subTier < 3) return false;
    if (settings.subTier2Only && subTier < 2) return false;
    if (settings.subscriberOnly && !isSubscriber) return false;
    
    // Bits requirement would be checked separately (not in IRC tags)
    // This would need to be tracked separately if implementing
    
    return true;
}

// Handle chat messages (only if client exists)
if (client) {
    client.on('message', (channel, tags, message, self) => {
    // Ignore bot's own messages
    if (self) return;
    
    const username = tags['display-name'] || tags.username;
    const userId = tags['user-id'];
    const isSubscriber = tags.subscriber === true;
    const subTier = tags.badges?.subscriber ? parseInt(tags.badges.subscriber.split('/')[0]) || 1 : 0;
    const isMod = tags.mod === true;
    const isVip = tags.badges?.vip === '1';
    const isPrime = tags.badges?.premium === '1';
    const isBroadcaster = tags.badges?.broadcaster === '1';
    
    console.log(`💬 [${channel}] ${username}: ${message}`);
    
    // Load current settings
    const settings = getSettings();
    
    // Check for join (command or emote)
    let shouldJoin = false;
    const messageLower = message.toLowerCase().trim();
    
    if (settings.joinMethod === 'emote' && settings.emoteName) {
        // Check if message contains the emote name
        // Note: In real implementation, you'd check for actual emote usage
        // For now, we'll check if the emote name appears in the message
        if (messageLower.includes(settings.emoteName.toLowerCase())) {
            shouldJoin = true;
        }
    } else {
        // Check for command
        const command = settings.command || '!join';
        if (messageLower === command.toLowerCase()) {
            shouldJoin = true;
        }
    }
    
    if (shouldJoin) {
        // Check if user can join based on permissions
        if (canUserJoin(tags, settings)) {
            // Add user to campfire
            activeUsers.set(userId, {
                username,
                userId,
                isSubscriber,
                subTier,
                isMod,
                isVip,
                isPrime,
                isBroadcaster,
                joinedAt: Date.now()
            });
            
            // Broadcast join event
            addEvent('userJoin', {
                username,
                userId,
                isSubscriber,
                subTier,
                isMod,
                isVip,
                isPrime,
                isBroadcaster
            });
            
            console.log(`🔥 ${username} joined the campfire!`);
        } else {
            console.log(`🚫 ${username} tried to join but doesn't meet requirements`);
        }
    }
    
    // Display chat message (if under 50 chars)
    if (message.length <= 50 && message.trim().length > 0) {
        addEvent('chatMessage', {
            username,
            message: message.trim(),
            userId,
            isSubscriber,
            subTier,
            isMod,
            isVip,
            isPrime,
            isBroadcaster
        });
    }
    });
}

// Handle user joins chat (even without command) - only if client exists
if (client) {
    client.on('join', (channel, username, self) => {
        if (!self && username !== CONFIG.BOT_USERNAME) {
            // Optionally auto-add users when they join chat
            // Uncomment if you want automatic joining:
            // const userId = `auto-${username}`;
            // activeUsers.set(userId, { username, userId, joinedAt: Date.now() });
            // addEvent('userJoin', { username, userId });
        }
    });

    // Handle user parts (leaves) chat
    client.on('part', (channel, username, self) => {
        if (!self && username !== CONFIG.BOT_USERNAME) {
            // Remove user from campfire when they leave Twitch chat
            let removed = false;
            for (const [userId, user] of activeUsers.entries()) {
                if (user.username && user.username.toLowerCase() === username.toLowerCase()) {
                    activeUsers.delete(userId);
                    addEvent('userLeave', {
                        username: user.username,
                        userId: userId
                    });
                    console.log(`🚪 ${user.username} left the campfire (left Twitch chat)`);
                    removed = true;
                    break;
                }
            }
        }
    });
}

// Monitor Twitch viewer list periodically (every 30 seconds)
if (client) {
    setInterval(async () => {
        try {
            // Get current chatters from Twitch API
            // Note: This requires additional API setup - for now we rely on part events
            // In the future, you could use Twitch API to get full viewer list
        } catch (e) {
            console.error('Error monitoring viewer list:', e);
        }
    }, 30000); // Check every 30 seconds
}

// Add event to queue
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

// API: Get events (widget polls this)
app.get('/api/events', (req, res) => {
    const since = parseInt(req.query.since) || 0;
    const newEvents = events.filter(e => e.id > since);
    res.json({
        events: newEvents,
        lastEventId: lastEventId
    });
});

// API: Get active users
app.get('/api/users', (req, res) => {
    res.json(Array.from(activeUsers.values()));
});

// API: Viewer joins campfire (from viewer dashboard)
app.post('/api/viewer/join', express.json(), (req, res) => {
    try {
        const { username, userId, color, selectedSprite } = req.body;
        
        if (!username || !userId) {
            return res.status(400).json({ error: 'Username and userId required' });
        }
        
        // Add user to active users
        activeUsers.set(userId, {
            username,
            userId,
            color,
            selectedSprite,
            joinedAt: Date.now(),
            source: 'viewer-dashboard'
        });
        
        // Broadcast join event
        addEvent('userJoin', {
            username,
            userId,
            color,
            selectedSprite,
            source: 'viewer-dashboard'
        });
        
        console.log(`🔥 ${username} joined from viewer dashboard!`);
        res.json({ success: true, message: 'Joined campfire' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Viewer movement (from viewer dashboard)
app.post('/api/viewer/move', express.json(), (req, res) => {
    try {
        const { username, userId, direction, speed } = req.body;
        
        if (!username || !userId || direction === undefined) {
            return res.status(400).json({ error: 'Username, userId, and direction required' });
        }
        
        // Broadcast movement event
        addEvent('viewerMovement', {
            username,
            userId,
            direction, // -1 for left, 1 for right
            speed: speed || 15
        });
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Viewer stops movement (from viewer dashboard)
app.post('/api/viewer/stop-move', express.json(), (req, res) => {
    try {
        const { username, userId } = req.body;
        
        if (!username || !userId) {
            return res.status(400).json({ error: 'Username and userId required' });
        }
        
        // Broadcast stop movement event
        addEvent('viewerStopMovement', {
            username,
            userId
        });
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Viewer leave (from viewer dashboard)
app.post('/api/viewer/leave', express.json(), (req, res) => {
    try {
        const { username, userId } = req.body;

        if (!username && !userId) {
            return res.status(400).json({ error: 'Username or userId required' });
        }

        // Remove user from active users
        if (userId && activeUsers.has(userId)) {
            activeUsers.delete(userId);
        } else {
            // Fallback: find by username
            for (const [id, user] of activeUsers.entries()) {
                if (user.username === username) {
                    activeUsers.delete(id);
                    break;
                }
            }
        }

        // Broadcast leave event
        addEvent('userLeave', {
            username,
            userId
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Viewer color/sprite update (from viewer dashboard)
app.post('/api/viewer/update', express.json(), (req, res) => {
    try {
        const { username, userId, color, selectedSprite } = req.body;

        if (!username || !userId) {
            return res.status(400).json({ error: 'Username and userId required' });
        }

        // Update active user if exists
        if (activeUsers.has(userId)) {
            const user = activeUsers.get(userId);
            if (color) user.color = color;
            if (selectedSprite !== undefined) user.selectedSprite = selectedSprite;
            activeUsers.set(userId, user);
        }

        // Broadcast color update event
        addEvent('viewerColorUpdate', {
            username,
            userId,
            color,
            selectedSprite,
            action: 'updateColor'
        });
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        connected: client ? client.readyState() === 'OPEN' : false,
        channel: CONFIG.CHANNEL_NAME,
        activeUsers: activeUsers.size,
        twitchConfigured: client !== null
    });
});

// API: Get current settings
app.get('/api/settings', (req, res) => {
    res.json(getSettings());
});

// API: Update settings (called by dashboard)
app.post('/api/settings', express.json(), (req, res) => {
    try {
        const settings = req.body;
        fs.writeFileSync(
            path.join(__dirname, 'campfire-widget-settings.json'),
            JSON.stringify(settings, null, 2)
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Check if gifsicle is installed
function checkGifsicle() {
    try {
        execSync('gifsicle --version', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

// API: Crop GIF using gifsicle
app.post('/api/crop-gif', upload.single('gif'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!checkGifsicle()) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ 
            error: 'gifsicle is not installed. Install with: brew install gifsicle (macOS) or sudo apt-get install gifsicle (Linux)' 
        });
    }
    
    const { cropTop, cropRight, cropBottom, cropLeft } = req.body;
    const top = parseInt(cropTop) || 0;
    const right = parseInt(cropRight) || 0;
    const bottom = parseInt(cropBottom) || 0;
    const left = parseInt(cropLeft) || 0;
    
    const inputPath = req.file.path;
    const outputPath = path.join(tempDir, `cropped_${Date.now()}_${req.file.originalname}`);
    
    try {
        // Get GIF dimensions
        const info = execSync(`gifsicle --info "${inputPath}"`, { encoding: 'utf8' });
        const sizeMatch = info.match(/logical screen (\d+) x (\d+)/);
        
        if (!sizeMatch) {
            throw new Error('Could not determine GIF dimensions');
        }
        
        const originalWidth = parseInt(sizeMatch[1]);
        const originalHeight = parseInt(sizeMatch[2]);
        
        const newWidth = originalWidth - left - right;
        const newHeight = originalHeight - top - bottom;
        
        if (newWidth <= 0 || newHeight <= 0) {
            throw new Error(`Crop values result in invalid dimensions: ${newWidth}x${newHeight}`);
        }
        
        // Crop using gifsicle
        const cropString = `${left},${top}+${newWidth}x${newHeight}`;
        execSync(`gifsicle --crop "${cropString}" "${inputPath}" --output "${outputPath}"`, {
            stdio: 'ignore'
        });
        
        // Read the cropped file and send it
        const croppedData = fs.readFileSync(outputPath);
        
        // Clean up temp files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Content-Disposition', `attachment; filename="cropped_${req.file.originalname}"`);
        res.send(croppedData);
        
    } catch (error) {
        // Clean up temp files on error
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🔥 Campfire Widget Server Starting...\n');
    
    // Detect if running on Railway or locally
    const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PUBLIC_DOMAIN;
    const baseUrl = isRailway 
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'your-app.railway.app'}`
        : `http://localhost:${PORT}`;
    
    console.log(`🚀 Server running on port ${PORT}`);
    if (isRailway) {
        console.log(`🌐 Public URL: ${baseUrl}`);
    }
    console.log(`📺 Widget: ${baseUrl}/widget.html`);
    console.log(`⚙️  Dashboard: ${baseUrl}/dashboard.html`);
    console.log(`👥 Viewer Dashboard: ${baseUrl}/viewer-dashboard.html`);
    console.log(`🎨 Sprite Converter: http://localhost:${PORT}/sprite-converter.html`);
    
    // Check if Twitch is configured
    if (CONFIG.BOT_USERNAME === 'YOUR_TWITCH_USERNAME' || 
        CONFIG.OAUTH_TOKEN === 'oauth:YOUR_OAUTH_TOKEN_HERE' ||
        CONFIG.CHANNEL_NAME === 'YOUR_CHANNEL_NAME') {
        console.log('\n⚠️  Twitch credentials not configured - running in file-serving mode only');
        console.log('   Static files are available, but chat integration is disabled');
        console.log('   To enable chat: Update CONFIG section in server.js\n');
    } else {
        console.log('\n✅ Twitch credentials configured - chat integration enabled\n');
    }
});

// API: Shutdown server (for localhost version)
app.post('/api/shutdown', (req, res) => {
    const forwarded = req.get('X-Forwarded-For');
    const ip = (forwarded ? forwarded.split(',')[0].trim() : null) || req.ip || (req.connection && req.connection.remoteAddress) || '';
    const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].indexOf(ip) !== -1;
    const secret = req.headers['x-shutdown-secret'] || (req.query && req.query.secret);
    const expectedSecret = process.env.SHUTDOWN_SECRET;
    const secretOk = !expectedSecret || (secret === expectedSecret);
    if (!isLocal && !secretOk) {
        return res.status(403).json({ error: 'Forbidden: /api/shutdown only allowed from localhost or with valid SHUTDOWN_SECRET' });
    }
    console.log('\n\n👋 Shutdown requested via API...');
    res.json({ success: true, message: 'Server shutting down...' });
    if (client) client.disconnect();
    setTimeout(() => { process.exit(0); }, 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...');
    if (client) {
        client.disconnect();
    }
    process.exit(0);
});
