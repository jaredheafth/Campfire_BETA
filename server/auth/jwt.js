/**
 * Campfire Widget - JWT Authentication Utilities
 * 
 * Handles JWT token generation, verification, and refresh tokens.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Configuration
const config = {
    // JWT secret (use strong secret in production!)
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    
    // Token expiration
    accessTokenExpiry: '15m',        // 15 minutes
    refreshTokenExpiry: '7d',         // 7 days
    sessionExpiry: '30d',              // 30 days
    
    // Token settings
    algorithms: ['HS256'],
    issuer: 'campfire-widget',
    audience: 'campfire-users'
};

/**
 * Generate access token
 */
function generateAccessToken(user) {
    const payload = {
        sub: user.id,
        userId: user.id,
        username: user.username,
        displayName: user.display_name,
        accountType: user.account_type,
        type: 'access'
    };

    return jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.accessTokenExpiry,
        algorithm: config.algorithms[0],
        issuer: config.issuer,
        audience: config.audience
    });
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user, sessionData = {}) {
    const payload = {
        sub: user.id,
        userId: user.id,
        type: 'refresh',
        sessionId: sessionData.sessionId || crypto.randomUUID()
    };

    return jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.refreshTokenExpiry,
        algorithm: config.algorithms[0],
        issuer: config.issuer,
        audience: config.audience
    });
}

/**
 * Generate session token (long-lived for desktop app)
 */
function generateSessionToken(user) {
    const payload = {
        sub: user.id,
        userId: user.id,
        username: user.username,
        displayName: user.display_name,
        accountType: user.account_type,
        type: 'session'
    };

    return jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.sessionExpiry,
        algorithm: config.algorithms[0],
        issuer: config.issuer,
        audience: config.audience
    });
}

/**
 * Generate all tokens for a user
 */
function generateTokens(user, sessionData = {}) {
    return {
        accessToken: generateAccessToken(user),
        refreshToken: generateRefreshToken(user, sessionData),
        sessionToken: generateSessionToken(user),
        expiresIn: getExpiryInSeconds(config.accessTokenExpiry)
    };
}

/**
 * Verify and decode token
 */
function verifyToken(token, options = {}) {
    const { type } = options;
    
    try {
        const decoded = jwt.verify(token, config.jwtSecret, {
            algorithms: config.algorithms,
            issuer: config.issuer,
            audience: config.audience
        });

        // Check token type if specified
        if (type && decoded.type !== type) {
            throw new Error(`Invalid token type: expected ${type}, got ${decoded.type}`);
        }

        return {
            valid: true,
            decoded
        };
    } catch (error) {
        return {
            valid: false,
            error: error.message
        };
    }
}

/**
 * Decode token without verification (for debugging)
 */
function decodeToken(token) {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
}

/**
 * Check if token is expired
 */
function isTokenExpired(token) {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
        return true;
    }
    
    return Date.now() >= decoded.exp * 1000;
}

/**
 * Get token expiration time
 */
function getTokenExpiration(token) {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
        return null;
    }
    
    return new Date(decoded.exp * 1000);
}

/**
 * Get seconds until expiration
 */
function getSecondsUntilExpiration(token) {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
        return 0;
    }
    
    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
}

/**
 * Parse expiry string to seconds
 */
function getExpiryInSeconds(expiry) {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
        return 900; // Default 15 minutes
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 60 * 60 * 24;
        default: return 900;
    }
}

/**
 * Generate secure random token
 */
function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash token for storage
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
    config,
    generateAccessToken,
    generateRefreshToken,
    generateSessionToken,
    generateTokens,
    verifyToken,
    decodeToken,
    isTokenExpired,
    getTokenExpiration,
    getSecondsUntilExpiration,
    getExpiryInSeconds,
    generateSecureToken,
    hashToken
};
