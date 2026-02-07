/**
 * Campfire Widget - Hosted Platform Server
 * 
 * Main server for the hosted Campfire platform.
 * Includes:
 * - Express API server
 * - WebSocket real-time communication
 * - PostgreSQL database integration
 * - Twitch OAuth authentication
 * 
 * Run with: node hosted-server.js
 */

const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

// Load environment variables
require('dotenv').config();

// Import modules
const { initializeDatabase, runMigrations, runSeeds, healthCheck } = require('./database/connection');
const { initializeWebSocket, getSocketCount, getUserCount } = require('./server/socket');
const { isConfigured: isSupabaseConfigured } = require('./server/supabase');

// Import routes (use Supabase auth if configured)
const authRoutes = process.env.SUPABASE_URL ? require('./server/routes/supabase-auth') : require('./server/routes/auth');
const { requireAuth } = require('./server/middleware/auth');
const { Campfire, User } = require('./database/models');

// ============================================
// SERVER CONFIGURATION
// ============================================

const app = express();
const server = http.createServer(app);

// Environment configuration
const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    isRailway: !!process.env.RAILWAY_ENVIRONMENT
};

// ============================================
// MIDDLEWARE
// ============================================

// Trust proxy (for Railway)
app.set('trust proxy', 1);

// CORS configuration
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
        config.frontendUrl,
        'http://localhost:3000',
        'http://localhost:8080'
    ];

    if (config.nodeEnv === 'production') {
        if (allowedOrigins.includes(origin)) {
            res.header('Access-Control-Allow-Origin', origin);
        }
    } else {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }

    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

// Cookie parser
app.use(cookieParser());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// ============================================
// STATIC FILE SERVING
// ============================================

// Serve sprites
const spritesDir = path.join(__dirname, 'sprites');
if (fs.existsSync(spritesDir)) {
    app.use('/sprites', express.static(spritesDir));
    console.log('✅ Serving sprites from:', spritesDir);
}

// Serve desktop-app server files (for embedded widget)
const desktopServerDir = path.join(__dirname, 'desktop-app/server');
if (fs.existsSync(desktopServerDir)) {
    app.use('/desktop', express.static(desktopServerDir));
    console.log('✅ Serving desktop app files from:', desktopServerDir);
}

// Serve fonts
const fontsDir = path.join(__dirname, 'fonts');
if (fs.existsSync(fontsDir)) {
    app.use('/fonts', express.static(fontsDir));
}

// Landing page - redirect to viewer dashboard
app.get('/', (req, res) => {
    res.redirect('/desktop/viewer-dashboard.html');
});

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', async (req, res) => {
    const dbHealth = await healthCheck();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: require('./package.json').version,
        environment: config.nodeEnv,
        database: dbHealth,
        websocket: {
            connections: getSocketCount(),
            users: getUserCount()
        }
    });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// User routes (authenticated)
app.get('/api/users/me', requireAuth, async (req, res) => {
    const user = await User.findById(req.userId);
    res.json(user);
});

app.put('/api/users/me', requireAuth, async (req, res) => {
    const user = await User.updateProfile(req.userId, req.body);
    res.json(user);
});

// Campfire routes (authenticated)
app.get('/api/campfires', requireAuth, async (req, res) => {
    const campfires = await Campfire.getUserCampfires(req.userId);
    res.json({ campfires });
});

app.post('/api/campfires', requireAuth, async (req, res) => {
    const { name, slug, description, tags, settings } = req.body;
    
    // Generate slug from name if not provided
    const campfireSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const campfire = await Campfire.create({
        creatorId: req.userId,
        name,
        slug: campfireSlug,
        description,
        tags: tags || [],
        settings: settings || {}
    });
    
    res.status(201).json(campfire);
});

app.get('/api/campfires/:id', requireAuth, async (req, res) => {
    const campfire = await Campfire.findById(req.params.id);
    if (!campfire) {
        return res.status(404).json({ error: 'Campfire not found' });
    }
    res.json(campfire);
});

app.put('/api/campfires/:id', requireAuth, async (req, res) => {
    const campfire = await Campfire.update(req.params.id, req.body);
    res.json(campfire);
});

// Campfire members
app.get('/api/campfires/:id/members', requireAuth, async (req, res) => {
    const members = await Campfire.getMembers(req.params.id);
    res.json({ members });
});

app.post('/api/campfires/:id/join', requireAuth, async (req, res) => {
    const member = await Campfire.addMember(req.params.id, req.userId);
    res.status(201).json(member);
});

app.post('/api/campfires/:id/leave', requireAuth, async (req, res) => {
    await Campfire.removeMember(req.params.id, req.userId);
    res.json({ success: true });
});

// Buddy routes
app.get('/api/buddies', requireAuth, async (req, res) => {
    const { Buddy } = require('./database/models');
    const buddies = await Buddy.getFriends(req.userId);
    res.json({ buddies });
});

app.get('/api/buddies/requests', requireAuth, async (req, res) => {
    const { Buddy } = require('./database/models');
    const requests = await Buddy.getPendingRequests(req.userId);
    res.json({ requests });
});

// Public campfire discovery
app.get('/api/campfires/discover', async (req, res) => {
    const { query, platform, tags, limit = 20 } = req.query;
    const results = await Campfire.searchCampfires({
        query,
        platform,
        tags: tags ? tags.split(',') : undefined,
        limit: parseInt(limit)
    });
    res.json({ campfires: results });
});

app.get('/api/campfires/featured', async (req, res) => {
    const featured = await Campfire.getFeatured(10);
    res.json({ featured });
});

// ============================================
// LEGACY API ROUTES (Backward Compatibility)
// ============================================

// Events endpoint (for existing widget.html)
app.get('/api/events', async (req, res) => {
    // This would integrate with the new WebSocket system
    res.json({ events: [], lastEventId: 0 });
});

// Health check for legacy clients
app.get('/api/healthcheck', (req, res) => {
    res.json({ status: 'ok' });
});

// ============================================
// WEB UI ROUTES
// ============================================

// Serve index.html for SPA routes
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/sprites') || req.path.startsWith('/fonts')) {
        return next();
    }
    
    // Serve static HTML if exists
    const htmlPath = path.join(__dirname, 'desktop-app/server', req.path + '.html');
    if (fs.existsSync(htmlPath)) {
        return res.sendFile(htmlPath);
    }
    
    next();
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
    console.error('[Error]', err);
    
    res.status(err.status || 500).json({
        error: err.code || 'internal_error',
        message: config.nodeEnv === 'production' 
            ? 'An unexpected error occurred' 
            : err.message
    });
});

// ============================================
// SERVER INITIALIZATION
// ============================================

async function startServer() {
    try {
        console.log('\n🔥 Campfire Widget - Hosted Platform Server\n');
        
        // Initialize database
        console.log('📦 Initializing database...');
        await initializeDatabase();
        
        // Run migrations
        console.log('🔄 Running database migrations...');
        await runMigrations();
        
        // Run seeds (optional)
        if (process.env.RUN_SEEDS === 'true') {
            console.log('🌱 Running database seeds...');
            await runSeeds();
        }
        
        // Initialize WebSocket
        console.log('🔌 Initializing WebSocket server...');
        initializeWebSocket(server);
        
        // Start HTTP server
        server.listen(config.port, '0.0.0.0', () => {
            const baseUrl = config.isRailway
                ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'your-app.railway.app'}`
                : `http://localhost:${config.port}`;
            
            console.log(`🚀 Server running on port ${config.port}`);
            if (config.isRailway) {
                console.log(`🌐 Public URL: ${baseUrl}`);
            }
            console.log(`\n📋 Endpoints:`);
            console.log(`   API: ${baseUrl}/api/*`);
            console.log(`   WebSocket: ${baseUrl}/socket.io`);
            console.log(`   Health: ${baseUrl}/api/health`);
            console.log(`\n🌍 Environment: ${config.nodeEnv}`);
            console.log('\n✅ Server ready!\n');
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    
    server.close(() => {
        console.log('🔌 HTTP server closed');
    });
    
    const { close } = require('./database/connection');
    await close();
    
    process.exit(0);
});

// Start server if run directly
if (require.main === module) {
    startServer();
}

module.exports = { app, server, startServer };
