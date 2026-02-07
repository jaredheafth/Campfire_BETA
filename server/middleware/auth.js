/**
 * Campfire Widget - Authentication Middleware
 * 
 * Express middleware for authentication and authorization.
 */

const { verifyToken } = require('../auth/jwt');

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Require authentication (must be logged in)
 */
function requireAuth(req, res, next) {
    // Check Authorization header first
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'unauthorized',
            message: 'Authentication required'
        });
    }

    const token = authHeader.substring(7);
    
    const result = verifyToken(token, { type: 'access' });
    
    if (!result.valid) {
        return res.status(401).json({
            error: 'invalid_token',
            message: result.error
        });
    }

    // Attach user info to request
    req.user = result.decoded;
    req.userId = result.decoded.sub;
    
    next();
}

/**
 * Optional authentication (attach user if token present)
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.substring(7);
    const result = verifyToken(token, { type: 'access' });
    
    if (result.valid) {
        req.user = result.decoded;
        req.userId = result.decoded.sub;
    }
    
    next();
}

/**
 * Require specific account type
 */
function requireAccountType(...allowedTypes) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'unauthorized',
                message: 'Authentication required'
            });
        }

        if (!allowedTypes.includes(req.user.accountType)) {
            return res.status(403).json({
                error: 'forbidden',
                message: `This feature requires: ${allowedTypes.join(' or ')}`
            });
        }

        next();
    };
}

// ============================================
// CAMPFIRE AUTHORIZATION MIDDLEWARE
// ============================================

/**
 * Check if user is member of campfire
 */
function requireCampfireMember(campfireIdParam = 'campfireId') {
    return async (req, res, next) => {
        const { Campfire } = require('../database/models');
        
        const campfireId = req.params[campfireIdParam] || req.body.campfireId;
        const userId = req.userId;
        
        if (!campfireId) {
            return res.status(400).json({
                error: 'missing_parameter',
                message: `Missing ${campfireIdParam}`
            });
        }

        const isMember = await Campfire.isMember(campfireId, userId);
        
        if (!isMember) {
            return res.status(403).json({
                error: 'not_member',
                message: 'You must be a member of this campfire'
            });
        }

        req.campfireId = campfireId;
        next();
    };
}

/**
 * Check if user has required role in campfire
 */
function requireCampfireRole(...allowedRoles) {
    return async (req, res, next) => {
        const { Campfire } = require('../database/models');
        
        const campfireId = req.campfireId || req.params.campfireId;
        const userId = req.userId;
        
        if (!campfireId) {
            return res.status(400).json({
                error: 'missing_parameter',
                message: 'Missing campfireId'
            });
        }

        const hasRole = await Campfire.hasRole(campfireId, userId, allowedRoles);
        
        if (!hasRole) {
            return res.status(403).json({
                error: 'insufficient_permissions',
                message: `This action requires: ${allowedRoles.join(' or ')}`
            });
        }

        next();
    };
}

/**
 * Require campfire ownership
 */
function requireCampfireOwner() {
    return requireCampfireRole('owner');
}

/**
 * Require campfire moderator or owner
 */
function requireCampfireModerator() {
    return requireCampfireRole('owner', 'moderator');
}

// ============================================
// BUDDY AUTHORIZATION MIDDLEWARE
// ============================================

/**
 * Check if users are buddies
 */
function requireBuddies(req, res, next) {
    const { Buddy } = require('../database/models');
    
    const buddyId = req.params.buddyId || req.params.userId || req.body.buddyId;
    const userId = req.userId;
    
    if (!buddyId) {
        return res.status(400).json({
            error: 'missing_parameter',
            message: 'Missing buddyId'
        });
    }

    // Check if buddies
    const areBuddies = Buddy.areBuddies(userId, buddyId);
    
    if (!areBuddies) {
        return res.status(403).json({
            error: 'not_buddies',
            message: 'You must be buddies with this user'
        });
    }

    next();
}

// ============================================
// RATE LIMITING MIDDLEWARE
// ============================================

/**
 * Simple in-memory rate limiter
 */
function createRateLimiter(options = {}) {
    const {
        windowMs = 60000,      // 1 minute
        max = 100,              // 100 requests per window
        keyPrefix = 'ratelimit',
        message = 'Too many requests'
    } = options;

    const cache = new Map();

    return (req, res, next) => {
        const key = `${keyPrefix}:${req.ip}`;
        const now = Date.now();
        
        // Clean old entries
        for (const [k, v] of cache.entries()) {
            if (now - v.windowStart > windowMs) {
                cache.delete(k);
            }
        }

        // Get or create entry
        let entry = cache.get(key);
        if (!entry) {
            entry = { count: 0, windowStart: now };
            cache.set(key, entry);
        }

        // Check limit
        if (entry.count >= max) {
            return res.status(429).json({
                error: 'rate_limited',
                message,
                retryAfter: Math.ceil((entry.windowStart + windowMs - now) / 1000)
            });
        }

        // Increment counter
        entry.count++;

        next();
    };
}

// ============================================
// INPUT VALIDATION MIDDLEWARE
// ============================================

/**
 * Validate request body
 */
function validateBody(schema) {
    return (req, res, next) => {
        const errors = [];
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = req.body[field];
            
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }

            if (value !== undefined && value !== null) {
                if (rules.type && typeof value !== rules.type) {
                    errors.push(`${field} must be ${rules.type}`);
                }

                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }

                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must be at most ${rules.maxLength} characters`);
                }

                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${field} format is invalid`);
                }
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'validation_error',
                message: 'Validation failed',
                errors
            });
        }

        next();
    };
}

/**
 * Validate path parameters
 */
function validateParams(schema) {
    return (req, res, next) => {
        const errors = [];
        
        for (const [param, rules] of Object.entries(schema)) {
            const value = req.params[param];
            
            if (rules.required && !value) {
                errors.push(`${param} is required`);
                continue;
            }

            if (value) {
                if (rules.isUUID && !isValidUUID(value)) {
                    errors.push(`${param} must be a valid UUID`);
                }

                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${param} format is invalid`);
                }
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'validation_error',
                message: 'Validation failed',
                errors
            });
        }

        next();
    };
}

/**
 * Validate UUID format
 */
function isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

/**
 * Handle async route errors
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
    console.error('[Error]', err);

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'validation_error',
            message: err.message
        });
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'unauthorized',
            message: err.message
        });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: 'file_too_large',
            message: 'File size exceeds limit'
        });
    }

    // Default error response
    res.status(err.status || 500).json({
        error: err.code || 'internal_error',
        message: process.env.NODE_ENV === 'production' 
            ? 'An unexpected error occurred' 
            : err.message
    });
}

module.exports = {
    requireAuth,
    optionalAuth,
    requireAccountType,
    requireCampfireMember,
    requireCampfireRole,
    requireCampfireOwner,
    requireCampfireModerator,
    requireBuddies,
    createRateLimiter,
    validateBody,
    validateParams,
    asyncHandler,
    errorHandler
};
