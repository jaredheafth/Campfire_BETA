/**
 * Campfire Widget - User Model
 * 
 * Database operations for user accounts.
 * Supports Twitch, Google, and email authentication.
 */

const { query } = require('../connection');

// ============================================
// CREATE
// ============================================

/**
 * Create a new user
 */
async function create(userData) {
    const {
        accountType = 'twitch',
        externalId,
        email,
        passwordHash,
        username,
        displayName,
        avatarUrl
    } = userData;

    const sql = `
        INSERT INTO users (
            account_type,
            external_id,
            email,
            password_hash,
            username,
            display_name,
            avatar_url,
            preferences,
            privacy,
            notifications
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
    `;

    const params = [
        accountType,
        externalId,
        email,
        passwordHash,
        username.toLowerCase(),
        displayName,
        avatarUrl,
        JSON.stringify({}),
        JSON.stringify({
            show_online_status: true,
            show_last_seen: true,
            show_stats: true,
            allow_friend_requests: true,
            index_in_search: true
        }),
        JSON.stringify({
            email_on_buddy_request: true,
            email_on_campfire_invite: true,
            push_online: true,
            push_messages: true,
            sound_enabled: true,
            desktop_notifications: true
        })
    ];

    const result = await query(sql, params);
    return result.rows[0];
}

/**
 * Find user by ID
 */
async function findById(id) {
    const sql = `SELECT * FROM users WHERE id = $1 AND status = 'active'`;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
}

/**
 * Find user by username
 */
async function findByUsername(username) {
    const sql = `SELECT * FROM users WHERE username = $1 AND status = 'active'`;
    const result = await query(sql, [username.toLowerCase()]);
    return result.rows[0] || null;
}

/**
 * Find user by external ID (Twitch ID, Google ID, etc.)
 */
async function findByExternalId(externalId) {
    const sql = `SELECT * FROM users WHERE external_id = $1 AND status = 'active'`;
    const result = await query(sql, [externalId]);
    return result.rows[0] || null;
}

/**
 * Find user by email
 */
async function findByEmail(email) {
    const sql = `SELECT * FROM users WHERE email = $1 AND status = 'active'`;
    const result = await query(sql, [email.toLowerCase()]);
    return result.rows[0] || null;
}

/**
 * Find user by username or email
 */
async function findByUsernameOrEmail(identifier) {
    const sql = `
        SELECT * FROM users 
        WHERE (username = $1 OR email = $1) 
        AND status = 'active'
    `;
    const result = await query(sql, [identifier.toLowerCase()]);
    return result.rows[0] || null;
}

// ============================================
// UPDATE
// ============================================

/**
 * Update user profile
 */
async function updateProfile(userId, updates) {
    const allowedFields = [
        'display_name',
        'avatar_url',
        'bio',
        'banner_url'
    ];

    const setClause = [];
    const params = [userId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (allowedFields.includes(snakeKey)) {
            setClause.push(`${snakeKey} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }
    }

    if (setClause.length === 0) {
        return findById(userId);
    }

    const sql = `
        UPDATE users 
        SET ${setClause.join(', ')}
        WHERE id = $1 AND status = 'active'
        RETURNING *
    `;

    const result = await query(sql, params);
    return result.rows[0] || null;
}

/**
 * Update user preferences (Tents)
 */
async function updatePreferences(userId, preferences) {
    const sql = `
        UPDATE users 
        SET preferences = preferences || $2::jsonb
        WHERE id = $1 AND status = 'active'
        RETURNING *
    `;

    const result = await query(sql, [userId, JSON.stringify(preferences)]);
    return result.rows[0] || null;
}

/**
 * Update user settings (privacy, notifications)
 */
async function updateSettings(userId, category, settings) {
    const validCategories = ['preferences', 'privacy', 'notifications'];
    
    if (!validCategories.includes(category)) {
        throw new Error(`Invalid settings category: ${category}`);
    }

    const sql = `
        UPDATE users 
        SET ${category} = ${category} || $2::jsonb
        WHERE id = $1 AND status = 'active'
        RETURNING *
    `;

    const result = await query(sql, [userId, JSON.stringify(settings)]);
    return result.rows[0] || null;
}

/**
 * Update last seen timestamp
 */
async function updateLastSeen(userId) {
    const sql = `
        UPDATE users 
        SET last_seen_at = NOW()
        WHERE id = $1
    `;
    await query(sql, [userId]);
}

/**
 * Update user stats
 */
async function updateStats(userId, statUpdates) {
    const sql = `
        UPDATE users 
        SET stats = stats || $2::jsonb
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [userId, JSON.stringify(statUpdates)]);
    return result.rows[0] || null;
}

/**
 * Update subscription
 */
async function updateSubscription(userId, tier, expiresAt) {
    const sql = `
        UPDATE users 
        SET subscription_tier = $2,
            subscription_expires_at = $3
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [userId, tier, expiresAt]);
    return result.rows[0] || null;
}

/**
 * Suspend user
 */
async function suspendUser(userId, reason) {
    const sql = `
        UPDATE users 
        SET status = 'suspended',
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [userId]);
    return result.rows[0] || null;
}

/**
 * Delete user (soft delete)
 */
async function deleteUser(userId) {
    const sql = `
        UPDATE users 
        SET status = 'deleted',
            username = username || '_deleted_' || NOW()::text,
            email = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [userId]);
    return result.rows[0] || null;
}

// ============================================
// SEARCH & LIST
// ============================================

/**
 * Search users by username
 */
async function searchByUsername(searchTerm, limit = 20) {
    const sql = `
        SELECT id, username, display_name, avatar_url, bio, stats
        FROM users 
        WHERE username LIKE $1 
        AND status = 'active'
        AND privacy->>'index_in_search' = 'true'
        ORDER BY username
        LIMIT $2
    `;

    const result = await query(sql, [`%${searchTerm.toLowerCase()}%`, limit]);
    return result.rows;
}

/**
 * Get online users
 */
async function getOnlineUsers(limit = 50) {
    const sql = `
        SELECT id, username, display_name, avatar_url, last_seen_at
        FROM users 
        WHERE last_seen_at > NOW() - INTERVAL '5 minutes'
        AND status = 'active'
        ORDER BY last_seen_at DESC
        LIMIT $1
    `;

    const result = await query(sql, [limit]);
    return result.rows;
}

/**
 * Get user count by date
 */
async function getUserCountByDate(startDate, endDate) {
    const sql = `
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as count
        FROM users 
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY DATE(created_at)
        ORDER BY date
    `;

    const result = await query(sql, [startDate, endDate]);
    return result.rows;
}

// ============================================
// VALIDATION
// ============================================

/**
 * Check if username is available
 */
async function isUsernameAvailable(username) {
    const sql = `
        SELECT COUNT(*) as count 
        FROM users 
        WHERE username = $1 
        AND status != 'deleted'
    `;

    const result = await query(sql, [username.toLowerCase()]);
    return parseInt(result.rows[0].count) === 0;
}

/**
 * Check if email is available
 */
async function isEmailAvailable(email) {
    const sql = `
        SELECT COUNT(*) as count 
        FROM users 
        WHERE email = $1 
        AND status != 'deleted'
    `;

    const result = await query(sql, [email.toLowerCase()]);
    return parseInt(result.rows[0].count) === 0;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    create,
    findById,
    findByUsername,
    findByExternalId,
    findByEmail,
    findByUsernameOrEmail,
    updateProfile,
    updatePreferences,
    updateSettings,
    updateLastSeen,
    updateStats,
    updateSubscription,
    suspendUser,
    deleteUser,
    searchByUsername,
    getOnlineUsers,
    getUserCountByDate,
    isUsernameAvailable,
    isEmailAvailable
};
