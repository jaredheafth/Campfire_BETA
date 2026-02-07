/**
 * Campfire Widget - Twitch OAuth Authentication
 * 
 * Handles Twitch OAuth flow for user authentication.
 */

const { v4: uuidv4 } = require('uuid');

// Twitch OAuth configuration
const config = {
    clientId: process.env.TWITCH_CLIENT_ID || 'your_twitch_client_id',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || 'your_twitch_client_secret',
    
    // OAuth endpoints
    authUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    userUrl: 'https://api.twitch.tv/helix/users',
    
    // Scopes
    scopes: [
        'user:read:email',
        'chat:read',
        'chat:edit'
    ],
    
    // Redirect URI
    redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/api/auth/twitch/callback'
};

/**
 * Generate OAuth authorization URL
 */
function getAuthorizationUrl(state, options = {}) {
    const {
        forceVerify = false,
        scopes = config.scopes
    } = options;

    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        state: state,
        force_verify: forceVerify.toString()
    });

    return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code) {
    const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri
    });

    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Twitch token exchange failed:', error);
        throw new Error('Failed to exchange code for tokens');
    }

    return response.json();
}

/**
 * Refresh access token
 */
async function refreshAccessToken(refreshToken) {
    const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
    });

    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Twitch token refresh failed:', error);
        throw new Error('Failed to refresh access token');
    }

    return response.json();
}

/**
 * Get user data from Twitch API
 */
async function getUserData(accessToken) {
    const response = await fetch(config.userUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-Id': config.clientId
        }
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Twitch user data fetch failed:', error);
        throw new Error('Failed to fetch user data');
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
        throw new Error('No user data found');
    }

    return data.data[0];
}

/**
 * Validate access token
 */
async function validateAccessToken(accessToken) {
    const response = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: {
            'Authorization': `OAuth ${accessToken}`
        }
    });

    if (!response.ok) {
        return { valid: false };
    }

    return response.json();
}

/**
 * Revoke access token
 */
async function revokeToken(accessToken) {
    const params = new URLSearchParams({
        client_id: config.clientId,
        token: accessToken
    });

    await fetch('https://id.twitch.tv/oauth2/revoke', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });
}

/**
 * Generate state parameter for CSRF protection
 */
function generateState() {
    return uuidv4();
}

/**
 * Validate state parameter
 */
function validateState(state, storedState) {
    if (!state || !storedState) {
        return false;
    }
    
    // Use timing-safe comparison
    try {
        return require('crypto').timingSafeEqual(
            Buffer.from(state),
            Buffer.from(storedState)
        );
    } catch {
        return false;
    }
}

/**
 * Get OAuth configuration for client
 */
function getClientConfig() {
    return {
        clientId: config.clientId,
        redirectUri: config.redirectUri,
        scopes: config.scopes
    };
}

module.exports = {
    config,
    getAuthorizationUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    getUserData,
    validateAccessToken,
    revokeToken,
    generateState,
    validateState,
    getClientConfig
};
