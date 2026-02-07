/**
 * Campfire Widget - Buddy Model
 * 
 * Database operations for the buddy/friendship system.
 */

const { query } = require('../connection');

// ============================================
// CREATE
// ============================================

/**
 * Send buddy request
 */
async function sendRequest(fromUserId, toUserId, message = '') {
    const sql = `
        INSERT INTO buddies (user_id, buddy_id, status, requested_by, request_message)
        VALUES ($1, $2, 'pending', $1, $3)
        ON CONFLICT (user_id, buddy_id) 
        DO UPDATE SET requested_by = EXCLUDED.requested_by,
                      request_message = EXCLUDED.request_message,
                      created_at = NOW(),
                      updated_at = NOW()
        RETURNING *
    `;

    const result = await query(sql, [fromUserId, toUserId, message]);
    return result.rows[0] || null;
}

/**
 * Accept buddy request
 */
async function acceptRequest(userId, buddyUserId) {
    const sql = `
        UPDATE buddies 
        SET status = 'accepted',
            accepted_at = NOW(),
            updated_at = NOW()
        WHERE user_id = $1 
        AND buddy_id = $2 
        AND status = 'pending'
        RETURNING *
    `;

    const result = await query(sql, [userId, buddyUserId]);
    
    // Also accept the reverse relationship
    if (result.rows[0]) {
        await query(`
            UPDATE buddies 
            SET status = 'accepted',
                accepted_at = NOW(),
                updated_at = NOW()
            WHERE user_id = $1 
            AND buddy_id = $2 
            AND status = 'pending'
        `, [buddyUserId, userId]);
    }
    
    return result.rows[0] || null;
}

/**
 * Decline buddy request
 */
async function declineRequest(userId, buddyUserId) {
    const sql = `
        UPDATE buddies 
        SET status = 'blocked',
            updated_at = NOW()
        WHERE user_id = $1 
        AND buddy_id = $2 
        AND status = 'pending'
        RETURNING *
    `;

    const result = await query(sql, [userId, buddyUserId]);
    return result.rows[0] || null;
}

// ============================================
// READ
// ============================================

/**
 * Get all buddies for a user (both sent and received)
 */
async function getAllBuddies(userId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let sql = `
        SELECT b.*,
               u.username,
               u.display_name,
               u.avatar_url,
               u.last_seen_at
        FROM buddies b
        JOIN users u ON b.buddy_id = u.id
        WHERE b.user_id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (status) {
        sql += ` AND b.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
    }

    sql += ` ORDER BY b.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
}

/**
 * Get friends (accepted buddies)
 */
async function getFriends(userId, options = {}) {
    return getAllBuddies(userId, { ...options, status: 'accepted' });
}

/**
 * Get pending requests (received)
 */
async function getPendingRequests(userId, options = {}) {
    const { limit = 20, offset = 0 } = options;

    const sql = `
        SELECT b.*,
               u.username,
               u.display_name,
               u.avatar_url
        FROM buddies b
        JOIN users u ON b.user_id = u.id
        WHERE b.buddy_id = $1
        AND b.status = 'pending'
        ORDER BY b.created_at DESC
        LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [userId, limit, offset]);
    return result.rows;
}

/**
 * Get buddy details
 */
async function getBuddy(userId, buddyUserId) {
    const sql = `
        SELECT b.*,
               u.username,
               u.display_name,
               u.avatar_url,
               u.last_seen_at
        FROM buddies b
        JOIN users u ON b.buddy_id = u.id
        WHERE b.user_id = $1 AND b.buddy_id = $2
    `;

    const result = await query(sql, [userId, buddyUserId]);
    return result.rows[0] || null;
}

/**
 * Check if users are buddies
 */
async function areBuddies(userId1, userId2) {
    const sql = `
        SELECT EXISTS(
            SELECT 1 FROM buddies 
            WHERE user_id = $1 
            AND buddy_id = $2 
            AND status = 'accepted'
        ) as is_buddy
    `;

    const result = await query(sql, [userId1, userId2]);
    return result.rows[0]?.is_buddy || false;
}

/**
 * Check if there's a pending request
 */
async function hasPendingRequest(userId, buddyUserId) {
    const sql = `
        SELECT EXISTS(
            SELECT 1 FROM buddies 
            WHERE (user_id = $1 AND buddy_id = $2)
            OR (user_id = $2 AND buddy_id = $1)
            AND status = 'pending'
        ) as has_request
    `;

    const result = await query(sql, [userId, buddyUserId]);
    return result.rows[0]?.has_request || false;
}

/**
 * Get friend count
 */
async function getFriendCount(userId) {
    const sql = `
        SELECT COUNT(*) as count 
        FROM buddies 
        WHERE user_id = $1 AND status = 'accepted'
    `;

    const result = await query(sql, [userId]);
    return parseInt(result.rows[0].count);
}

/**
 * Get online friends
 */
async function getOnlineFriends(userId) {
    const sql = `
        SELECT b.*,
               u.username,
               u.display_name,
               u.avatar_url
        FROM buddies b
        JOIN users u ON b.buddy_id = u.id
        WHERE b.user_id = $1
        AND b.status = 'accepted'
        AND u.last_seen_at > NOW() - INTERVAL '5 minutes'
        ORDER BY u.last_seen_at DESC
    `;

    const result = await query(sql, [userId]);
    return result.rows;
}

// ============================================
// UPDATE
// ============================================

/**
 * Update buddy settings
 */
async function updateSettings(userId, buddyUserId, settings) {
    const sql = `
        UPDATE buddies 
        SET settings = settings || $3::jsonb,
            updated_at = NOW()
        WHERE user_id = $1 AND buddy_id = $2
        RETURNING *
    `;

    const result = await query(sql, [userId, buddyUserId, JSON.stringify(settings)]);
    return result.rows[0] || null;
}

/**
 * Block user
 */
async function blockUser(userId, blockUserId) {
    // Remove any existing relationship
    await removeBuddy(userId, blockUserId);
    
    const sql = `
        INSERT INTO buddies (user_id, buddy_id, status)
        VALUES ($1, $2, 'blocked')
        ON CONFLICT (user_id, buddy_id) 
        DO UPDATE SET status = 'blocked',
                      updated_at = NOW()
        RETURNING *
    `;

    const result = await query(sql, [userId, blockUserId]);
    return result.rows[0] || null;
}

/**
 * Unblock user
 */
async function unblockUser(userId, blockUserId) {
    const sql = `
        DELETE FROM buddies 
        WHERE user_id = $1 AND buddy_id = $2 AND status = 'blocked'
        RETURNING *
    `;

    const result = await query(sql, [userId, blockUserId]);
    return result.rows[0] || null;
}

/**
 * Get blocked users
 */
async function getBlockedUsers(userId) {
    const sql = `
        SELECT b.*,
               u.username,
               u.display_name,
               u.avatar_url
        FROM buddies b
        JOIN users u ON b.buddy_id = u.id
        WHERE b.user_id = $1 AND b.status = 'blocked'
        ORDER BY b.updated_at DESC
    `;

    const result = await query(sql, [userId]);
    return result.rows;
}

// ============================================
// DELETE
// ============================================

/**
 * Remove buddy
 */
async function removeBuddy(userId, buddyUserId) {
    const sql = `
        DELETE FROM buddies 
        WHERE (user_id = $1 AND buddy_id = $2)
        OR (user_id = $2 AND buddy_id = $1)
        RETURNING *
    `;

    const result = await query(sql, [userId, buddyUserId]);
    return result.rows[0] || null;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    sendRequest,
    acceptRequest,
    declineRequest,
    getAllBuddies,
    getFriends,
    getPendingRequests,
    getBuddy,
    areBuddies,
    hasPendingRequest,
    getFriendCount,
    getOnlineFriends,
    updateSettings,
    blockUser,
    unblockUser,
    getBlockedUsers,
    removeBuddy
};
