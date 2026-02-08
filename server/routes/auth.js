/**
 * Campfire Widget - Authentication Routes
 * 
 * API routes for authentication (login, logout, token refresh, etc.)
 */

const express = require('express');
const router = express.Router();

const { requireAuth, asyncHandler } = require('../middleware/auth');
const { generateTokens, verifyToken, hashToken, generateSecureToken } = require('../auth/jwt');
const twitchAuth = require('../auth/twitch');
const { User } = require('../../database/models');

const { query } = require('../../database/connection');

// ============================================
// TWITCH OAUTH
// ============================================

/**
 * POST /api/auth/twitch
 * Start Twitch OAuth authorization flow
 * Accepts: { stayLoggedIn: boolean, authType: 'create' | 'login' }
 */
router.post('/twitch', asyncHandler(async (req, res) => {
    const { stayLoggedIn, authType } = req.body;
    
    // Generate state for CSRF protection
    const state = twitchAuth.generateState();
    
    // Store auth context in signed cookie
    res.cookie('oauth_context', JSON.stringify({
        state,
        stayLoggedIn: stayLoggedIn !== false, // default to true
        authType: authType || 'login'
    }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutes
    });

    // Generate authorization URL
    const authUrl = twitchAuth.getAuthorizationUrl(state, {
        forceVerify: req.query.forceVerify === 'true'
    });

    res.json({
        url: authUrl,
        state
    });
}));

/**
 * GET /api/auth/twitch
 * Redirect to Twitch OAuth authorization page (legacy - GET version)
 */
router.get('/twitch', (req, res) => {
    // Generate state for CSRF protection
    const state = twitchAuth.generateState();
    
    // Store state in cookie (short-lived)
    res.cookie('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 60 * 1000, // 10 minutes
        sameSite: 'lax'
    });

    // Generate authorization URL
    const authUrl = twitchAuth.getAuthorizationUrl(state, {
        forceVerify: req.query.forceVerify === 'true'
    });

    res.json({
        url: authUrl,
        state
    });
});

/**
 * GET /api/auth/twitch/callback
 * Handle Twitch OAuth callback
 */
router.get('/twitch/callback', asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;

    // Handle user cancellation
    if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?auth=cancelled&error=${error}`);
    }

    // Get oauth_context cookie (new format) or fall back to oauth_state
    let oauthContext = null;
    let storedState = null;
    
    if (req.cookies.oauth_context) {
        try {
            oauthContext = JSON.parse(req.cookies.oauth_context);
            storedState = oauthContext.state;
        } catch (e) {
            console.error('[Auth] Failed to parse oauth_context cookie');
        }
    }
    
    // Fall back to old oauth_state cookie
    if (!storedState && req.cookies.oauth_state) {
        storedState = req.cookies.oauth_state;
    }

    // Validate state
    if (!twitchAuth.validateState(state, storedState)) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?auth=error&message=invalid_state`);
    }

    // Clear oauth cookies
    res.clearCookie('oauth_context');
    res.clearCookie('oauth_state');

    // Get stayLoggedIn from context (default to true)
    const stayLoggedIn = oauthContext?.stayLoggedIn !== false;
    
    // Session expiry based on stayLoggedIn
    const sessionExpiryDays = stayLoggedIn ? 30 : 7;
    const sessionExpiryMs = sessionExpiryDays * 24 * 60 * 60 * 1000;

    // Exchange code for tokens
    const twitchTokens = await twitchAuth.exchangeCodeForTokens(code);

    // Get user data from Twitch
    const twitchUser = await twitchAuth.getUserData(twitchTokens.access_token);

    // Find or create user
    let user = await User.findByExternalId(twitchUser.id);

    if (!user) {
        // Create new user
        user = await User.create({
            accountType: 'twitch',
            externalId: twitchUser.id,
            email: twitchUser.email || null,
            username: twitchUser.login,
            displayName: twitchUser.display_name,
            avatarUrl: twitchUser.profile_image_url
        });

        console.log(`[Auth] New user created: ${user.username} (${user.id})`);
    } else {
        // Update user data from Twitch
        await User.updateProfile(user.id, {
            displayName: twitchUser.display_name,
            avatarUrl: twitchUser.profile_image_url
        });

        // Refresh user data
        user = await User.findById(user.id);
    }

    // Generate JWT tokens
    const tokens = generateTokens(user);

    // Store refresh token hash for revocation
    const refreshTokenHash = hashToken(tokens.refreshToken);
    const expiresAt = new Date(Date.now() + sessionExpiryMs);

    await query(`
        INSERT INTO sessions (user_id, token_hash, token_type, expires_at, user_agent, ip_address)
        VALUES ($1, $2, 'refresh', $3, $4, $5)
    `, [user.id, refreshTokenHash, expiresAt, req.headers['user-agent'], req.ip]);

    // Update last seen
    await User.updateLastSeen(user.id);

    // Set tokens as cookies
    res.cookie('access_token', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: sessionExpiryMs
    });

    // Store user info in a separate cookie for quick access (not httpOnly)
    res.cookie('user_info', JSON.stringify({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url
    }), {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: sessionExpiryMs
    });

    // Redirect to home/dashboard
    const redirectUrl = oauthContext?.authType === 'create' ? '/home?welcome=new' : '/home';
    res.redirect(`${process.env.FRONTEND_URL}${redirectUrl}`);
}));

/**
 * POST /api/auth/twitch/token
 * Get access token for desktop app (PKCE flow alternative)
 */
router.post('/twitch/token', asyncHandler(async (req, res) => {
    const { code, deviceId } = req.body;

    if (!code) {
        return res.status(400).json({
            error: 'missing_code',
            message: 'Authorization code is required'
        });
    }

    // Exchange code for tokens
    const twitchTokens = await twitchAuth.exchangeCodeForTokens(code);

    // Get user data from Twitch
    const twitchUser = await twitchAuth.getUserData(twitchTokens.access_token);

    // Find or create user
    let user = await User.findByExternalId(twitchUser.id);

    if (!user) {
        user = await User.create({
            accountType: 'twitch',
            externalId: twitchUser.id,
            email: twitchUser.email || null,
            username: twitchUser.login,
            displayName: twitchUser.display_name,
            avatarUrl: twitchUser.profile_image_url
        });
    }

    // Generate tokens for desktop app
    const tokens = generateTokens(user, { sessionId: deviceId });

    // Return tokens
    res.json({
        user: {
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            avatarUrl: user.avatar_url
        },
        ...tokens
    });
}));

// ============================================
// TOKEN REFRESH
// ============================================

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken || req.cookies.refresh_token;

    if (!refreshToken) {
        return res.status(401).json({
            error: 'missing_token',
            message: 'Refresh token is required'
        });
    }

    // Verify refresh token
    const result = verifyToken(refreshToken, { type: 'refresh' });

    if (!result.valid) {
        return res.status(401).json({
            error: 'invalid_token',
            message: 'Invalid or expired refresh token'
        });
    }

    // Check if token is revoked
    const tokenHash = hashToken(refreshToken);
    const sessionResult = await query(`
        SELECT * FROM sessions 
        WHERE token_hash = $1 
        AND user_id = $2 
        AND expires_at > NOW()
        AND is_active = true
    `, [tokenHash, result.decoded.userId]);

    if (sessionResult.rows.length === 0) {
        return res.status(401).json({
            error: 'session_revoked',
            message: 'Session has been revoked'
        });
    }

    // Get fresh user data
    const user = await User.findById(result.decoded.userId);

    if (!user) {
        return res.status(401).json({
            error: 'user_not_found',
            message: 'User not found'
        });
    }

    // Generate new access token
    const accessToken = require('../auth/jwt').generateAccessToken(user);

    res.json({
        accessToken,
        expiresIn: 15 * 60 // 15 minutes
    });
}));

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * POST /api/auth/session
 * Create long-lived session token for desktop app
 */
router.post('/session', requireAuth, asyncHandler(async (req, res) => {
    const { deviceId, deviceName } = req.body;

    const sessionToken = require('../auth/jwt').generateSessionToken(req.user);

    // Store session
    const tokenHash = hashToken(sessionToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await query(`
        INSERT INTO sessions (user_id, token_hash, token_type, expires_at, user_agent, ip_address, device_id)
        VALUES ($1, $2, 'session', $3, $4, $5, $6)
        ON CONFLICT (token_hash) DO UPDATE SET last_used_at = NOW()
    `, [req.userId, tokenHash, expiresAt, req.headers['user-agent'], req.ip, deviceId]);

    res.json({
        sessionToken,
        expiresAt: expiresAt.toISOString()
    });
}));

/**
 * GET /api/auth/sessions
 * Get all active sessions for user
 */
router.get('/sessions', requireAuth, asyncHandler(async (req, res) => {
    const sessionsResult = await query(`
        SELECT id, token_type, user_agent, ip_address, created_at, last_used_at, expires_at
        FROM sessions 
        WHERE user_id = $1 AND is_active = true
        ORDER BY last_used_at DESC
    `, [req.userId]);

    res.json({
        sessions: sessionsResult.rows.map(s => ({
            ...s,
            isCurrent: false // Will be filtered client-side
        }))
    });
}));

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revoke a session
 */
router.delete('/sessions/:sessionId', requireAuth, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    await query(`
        UPDATE sessions 
        SET is_active = false 
        WHERE id = $1 AND user_id = $2
    `, [sessionId, req.userId]);

    res.json({ success: true });
}));

/**
 * DELETE /api/auth/sessions
 * Revoke all sessions (logout everywhere)
 */
router.delete('/sessions', requireAuth, asyncHandler(async (req, res) => {
    await query(`
        UPDATE sessions 
        SET is_active = false 
        WHERE user_id = $1
    `, [req.userId]);

    res.json({ success: true });
}));

// ============================================
// LOGOUT
// ============================================

/**
 * POST /api/auth/logout
 * Logout (revoke refresh token)
 */
router.post('/logout', asyncHandler(async (req, res) => {
    const refreshToken = req.body.refreshToken || req.cookies.refresh_token;

    if (refreshToken) {
        // Revoke refresh token
        const tokenHash = hashToken(refreshToken);
        await query(`
            UPDATE sessions 
            SET is_active = false 
            WHERE token_hash = $1
        `, [tokenHash]);
    }

    // Clear cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    res.json({ success: true });
}));

// ============================================
// USER INFO
// ============================================

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);

    if (!user) {
        return res.status(404).json({
            error: 'user_not_found',
            message: 'User not found'
        });
    }

    res.json({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        accountType: user.account_type,
        subscriptionTier: user.subscription_tier,
        preferences: user.preferences,
        stats: user.stats,
        createdAt: user.created_at,
        lastSeenAt: user.last_seen_at
    });
}));

// ============================================
// OAUTH CONFIG
// ============================================

/**
 * GET /api/auth/config
 * Get OAuth client configuration (public)
 */
router.get('/config', (req, res) => {
    res.json({
        twitch: twitchAuth.getClientConfig()
    });
});

module.exports = router;
