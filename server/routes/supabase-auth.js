/**
 * Campfire Widget - Supabase Authentication Routes
 * 
 * Handles user authentication using Supabase Auth.
 * Supports Twitch OAuth and session management.
 */

const express = require('express');
const { getSupabase, getSupabaseAdmin, isConfigured } = require('../supabase');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Twitch OAuth configuration
const config = {
    twitchClientId: process.env.TWITCH_CLIENT_ID,
    twitchClientSecret: process.env.TWITCH_CLIENT_SECRET,
    redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/api/auth/twitch/callback'
};

/**
 * GET /api/auth/status
 * Check current authentication status
 */
router.get('/status', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json({ 
                authenticated: false,
                message: 'No token provided'
            });
        }
        
        const token = authHeader.substring(7);
        
        if (!isConfigured()) {
            return res.json({ 
                authenticated: false,
                message: 'Supabase not configured'
            });
        }
        
        const supabase = getSupabase();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.json({ 
                authenticated: false,
                message: error?.message || 'Invalid token'
            });
        }
        
        res.json({
            authenticated: true,
            user: {
                id: user.id,
                email: user.email,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/twitch
 * Start Twitch OAuth flow (returns authorization URL)
 */
router.post('/twitch', async (req, res) => {
    try {
        if (!isConfigured()) {
            return res.status(503).json({ 
                error: 'supabase_not_configured',
                message: 'Supabase is not configured'
            });
        }
        
        // Generate state for CSRF protection
        const state = uuidv4();
        
        // Build Twitch OAuth URL
        const params = new URLSearchParams({
            client_id: config.twitchClientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: 'user:read:email chat:read chat:edit',
            state: state
        });
        
        const authUrl = `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
        
        res.json({
            authUrl,
            state
        });
    } catch (error) {
        console.error('Twitch auth error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/auth/twitch/callback
 * Handle Twitch OAuth callback
 */
router.get('/twitch/callback', async (req, res) => {
    try {
        const { code, state, error: oauthError } = req.query;
        
        if (oauthError) {
            return res.redirect(`/login?error=${oauthError}`);
        }
        
        if (!code) {
            return res.redirect('/login?error=no_code');
        }
        
        if (!isConfigured()) {
            return res.redirect('/login?error=supabase_not_configured');
        }
        
        const supabase = getSupabase();
        
        // Exchange code for tokens
        const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: config.twitchClientId,
                client_secret: config.twitchClientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: config.redirectUri
            })
        });
        
        const tokens = await tokenResponse.json();
        
        if (tokens.error) {
            return res.redirect(`/login?error=${tokens.error}`);
        }
        
        // Get Twitch user data
        const userResponse = await fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Client-Id': config.twitchClientId
            }
        });
        
        const userData = await userResponse.json();
        const twitchUser = userData.data?.[0];
        
        if (!twitchUser) {
            return res.redirect('/login?error=no_twitch_user');
        }
        
        // Sign in or sign up with Supabase using the Twitch access token
        const { data: { user, session }, error: signInError } = await supabase.auth.signInWithOAuth({
            provider: 'twitch',
            options: {
                access_token: tokens.access_token,
                redirectTo: `${req.protocol}://${req.get('host')}/api/auth/twitch/callback`
            }
        });
        
        if (signInError) {
            return res.redirect(`/login?error=${signInError.message}`);
        }
        
        // Redirect to app with session
        res.redirect(`/?auth=success&user_id=${user.id}`);
    } catch (error) {
        console.error('Twitch callback error:', error);
        res.redirect(`/login?error=${encodeURIComponent(error.message)}`);
    }
});

/**
 * POST /api/auth/logout
 * Sign out user
 */
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json({ success: true });
        }
        
        const token = authHeader.substring(7);
        
        if (!isConfigured()) {
            return res.json({ success: true });
        }
        
        const supabase = getSupabase();
        await supabase.auth.signOut();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ error: 'refresh_token_required' });
        }
        
        if (!isConfigured()) {
            return res.status(503).json({ error: 'supabase_not_configured' });
        }
        
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        
        if (error) {
            return res.status(401).json({ error: error.message });
        }
        
        res.json({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/auth/session
 * Get current session
 */
router.get('/session', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.json({ authenticated: false });
        }
        
        const token = authHeader.substring(7);
        
        if (!isConfigured()) {
            return res.json({ authenticated: false });
        }
        
        const supabase = getSupabase();
        const { data: { session }, error } = await supabase.auth.getSession(token);
        
        if (error || !session) {
            return res.json({ authenticated: false });
        }
        
        res.json({
            authenticated: true,
            user: {
                id: session.user.id,
                email: session.user.email
            },
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            expiresAt: session.expires_at
        });
    } catch (error) {
        console.error('Session error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
