/**
 * Campfire Widget - Message Model
 * 
 * Database operations for chat messages and private messages.
 */

const { query } = require('../connection');

// ============================================
// CREATE
// ============================================

/**
 * Create a message
 */
async function create(messageData) {
    const {
        campfireId,
        senderId,
        recipientId,
        messageType = 'chat',
        content,
        metadata = {}
    } = messageData;

    const sql = `
        INSERT INTO messages (
            campfire_id,
            sender_id,
            recipient_id,
            message_type,
            content,
            metadata
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `;

    const params = [
        campfireId,
        senderId,
        recipientId,
        messageType,
        content,
        JSON.stringify(metadata)
    ];

    const result = await query(sql, params);
    return result.rows[0] || null;
}

/**
 * Create chat message in campfire
 */
async function createChatMessage(campfireId, senderId, content, metadata = {}) {
    return create({
        campfireId,
        senderId,
        messageType: 'chat',
        content,
        metadata
    });
}

/**
 * Create private message
 */
async function createPrivateMessage(senderId, recipientId, content, metadata = {}) {
    return create({
        senderId,
        recipientId,
        messageType: 'private',
        content,
        metadata
    });
}

// ============================================
// READ
// ============================================

/**
 * Get messages for a campfire
 */
async function getCampfireMessages(campfireId, options = {}) {
    const { limit = 100, beforeId, afterId, since } = options;

    let sql = `
        SELECT m.*,
               u.username,
               u.display_name,
               u.avatar_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.campfire_id = $1
        AND m.is_deleted = false
        AND m.message_type = 'chat'
    `;

    const params = [campfireId];
    let paramIndex = 2;

    if (beforeId) {
        sql += ` AND m.id < $${paramIndex}`;
        params.push(beforeId);
        paramIndex++;
    }

    if (afterId) {
        sql += ` AND m.id > $${paramIndex}`;
        params.push(afterId);
        paramIndex++;
    }

    if (since) {
        sql += ` AND m.created_at > $${paramIndex}`;
        params.push(since);
        paramIndex++;
    }

    sql += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, 0);

    const result = await query(sql, params);
    return result.rows.reverse(); // Return in chronological order
}

/**
 * Get private messages between two users
 */
async function getPrivateMessages(userId1, userId2, options = {}) {
    const { limit = 50, beforeId, afterId } = options;

    let sql = `
        SELECT m.*,
               u.username,
               u.display_name,
               u.avatar_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE ((m.sender_id = $1 AND m.recipient_id = $2)
           OR (m.sender_id = $2 AND m.recipient_id = $1))
        AND m.message_type = 'private'
        AND m.is_deleted = false
    `;

    const params = [userId1, userId2];
    let paramIndex = 3;

    if (beforeId) {
        sql += ` AND m.id < $${paramIndex}`;
        params.push(beforeId);
        paramIndex++;
    }

    if (afterId) {
        sql += ` AND m.id > $${paramIndex}`;
        params.push(afterId);
        paramIndex++;
    }

    sql += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, 0);

    const result = await query(sql, params);
    return result.rows.reverse();
}

/**
 * Get message by ID
 */
async function findById(messageId) {
    const sql = `
        SELECT m.*,
               u.username,
               u.display_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = $1
    `;

    const result = await query(sql, [messageId]);
    return result.rows[0] || null;
}

/**
 * Get message count for campfire
 */
async function getMessageCount(campfireId, since = null) {
    let sql = `
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE campfire_id = $1
        AND message_type = 'chat'
        AND is_deleted = false
    `;

    const params = [campfireId];

    if (since) {
        sql += ` AND created_at > $2`;
        params.push(since);
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].count);
}

/**
 * Search messages
 */
async function searchMessages(campfireId, searchTerm, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const sql = `
        SELECT m.*,
               u.username,
               u.display_name,
               u.avatar_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.campfire_id = $1
        AND m.message_type = 'chat'
        AND m.is_deleted = false
        AND m.content ILIKE $2
        ORDER BY m.created_at DESC
        LIMIT $3 OFFSET $4
    `;

    const result = await query(sql, [campfireId, `%${searchTerm}%`, limit, offset]);
    return result.rows;
}

/**
 * Get recent conversations for user
 */
async function getRecentConversations(userId, limit = 20) {
    const sql = `
        SELECT DISTINCT ON (
            CASE 
                WHEN m.sender_id = $1 THEN m.recipient_id 
                ELSE m.sender_id 
            END
        )
        m.id,
        m.content,
        m.created_at,
        m.sender_id,
        m.recipient_id,
        u.username as other_username,
        u.display_name as other_display_name,
        u.avatar_url as other_avatar
        FROM messages m
        JOIN users u ON (
            CASE 
                WHEN m.sender_id = $1 THEN m.recipient_id = u.id
                ELSE m.sender_id = u.id
            END
        )
        WHERE (m.sender_id = $1 OR m.recipient_id = $1)
        AND m.message_type = 'private'
        AND m.is_deleted = false
        ORDER BY 
            CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END,
            m.created_at DESC
        LIMIT $2
    `;

    const result = await query(sql, [userId, limit]);
    return result.rows;
}

// ============================================
// UPDATE
// ============================================

/**
 * Soft delete message
 */
async function deleteMessage(messageId, userId, reason = '') {
    const sql = `
        UPDATE messages 
        SET is_deleted = true,
            deleted_at = NOW(),
            deleted_by = $2,
            moderation_reason = $3
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [messageId, userId, reason]);
    return result.rows[0] || null;
}

/**
 * Bulk delete messages
 */
async function bulkDelete(messageIds, userId, reason = '') {
    const sql = `
        UPDATE messages 
        SET is_deleted = true,
            deleted_at = NOW(),
            deleted_by = $2,
            moderation_reason = $3
        WHERE id = ANY($1)
        RETURNING id
    `;

    const result = await query(sql, [messageIds, userId, reason]);
    return result.rows;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    create,
    createChatMessage,
    createPrivateMessage,
    getCampfireMessages,
    getPrivateMessages,
    findById,
    getMessageCount,
    searchMessages,
    getRecentConversations,
    deleteMessage,
    bulkDelete
};
