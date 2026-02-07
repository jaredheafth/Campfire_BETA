/**
 * Campfire Widget - Campfire Model
 * 
 * Database operations for campfire instances.
 * Supports creator management, member tracking, and settings.
 */

const { query } = require('../connection');

// ============================================
// CREATE
// ============================================

/**
 * Create a new campfire
 */
async function create(campfireData) {
    const {
        creatorId,
        name,
        slug,
        description,
        tags,
        platform,
        platformChannelId,
        isPublic = true,
        isDiscoverable = true,
        settings,
        restrictions,
        branding
    } = campfireData;

    const sql = `
        INSERT INTO campfires (
            creator_id,
            name,
            slug,
            description,
            tags,
            platform,
            platform_channel_id,
            is_public,
            is_discoverable,
            settings,
            restrictions,
            branding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
    `;

    const params = [
        creatorId,
        name,
        slug.toLowerCase(),
        description,
        tags || [],
        platform || 'twitch',
        platformChannelId,
        isPublic,
        isDiscoverable,
        JSON.stringify(settings || {}),
        JSON.stringify(restrictions || {}),
        JSON.stringify(branding || {})
    ];

    const result = await query(sql, params);
    
    // Automatically add creator as owner member
    if (result.rows[0]) {
        await addMember(result.rows[0].id, creatorId, 'owner');
    }
    
    return result.rows[0];
}

/**
 * Find campfire by ID
 */
async function findById(id) {
    const sql = `
        SELECT c.*, 
               u.username as creator_username,
               u.display_name as creator_display_name,
               u.avatar_url as creator_avatar
        FROM campfires c
        JOIN users u ON c.creator_id = u.id
        WHERE c.id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
}

/**
 * Find campfire by slug
 */
async function findBySlug(slug) {
    const sql = `
        SELECT c.*, 
               u.username as creator_username,
               u.display_name as creator_display_name,
               u.avatar_url as creator_avatar
        FROM campfires c
        JOIN users u ON c.creator_id = u.id
        WHERE c.slug = $1
    `;
    const result = await query(sql, [slug.toLowerCase()]);
    return result.rows[0] || null;
}

/**
 * Find campfire by ID or slug
 */
async function findByIdOrSlug(identifier) {
    // Try UUID first
    const { v4: uuidValidate } = require('uuid');
    if (uuidValidate(identifier)) {
        return findById(identifier);
    }
    
    // Try slug
    return findBySlug(identifier);
}

/**
 * Find campfires by creator
 */
async function findByCreator(creatorId, options = {}) {
    const { limit = 50, offset = 0, status = 'active' } = options;

    const sql = `
        SELECT c.*,
               COUNT(cm.id) as member_count
        FROM campfires c
        LEFT JOIN campfire_members cm ON c.id = cm.campfire_id
        WHERE c.creator_id = $1
        AND ($3 = 'all' OR c.status = $3)
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT $4 OFFSET $5
    `;

    const result = await query(sql, [creatorId, status, status, limit, offset]);
    return result.rows;
}

// ============================================
// UPDATE
// ============================================

/**
 * Update campfire
 */
async function update(campfireId, updates) {
    const allowedFields = [
        'name',
        'description',
        'tags',
        'is_public',
        'is_discoverable',
        'settings',
        'restrictions',
        'branding',
        'status'
    ];

    const setClause = [];
    const params = [campfireId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        if (allowedFields.includes(snakeKey)) {
            setClause.push(`${snakeKey} = $${paramIndex}`);
            params.push(typeof value === 'object' ? JSON.stringify(value) : value);
            paramIndex++;
        }
    }

    if (setClause.length === 0) {
        return findById(campfireId);
    }

    const sql = `
        UPDATE campfires 
        SET ${setClause.join(', ')}
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, params);
    return result.rows[0] || null;
}

/**
 * Update settings
 */
async function updateSettings(campfireId, newSettings) {
    const sql = `
        UPDATE campfires 
        SET settings = settings || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [campfireId, JSON.stringify(newSettings)]);
    return result.rows[0] || null;
}

/**
 * Update restrictions
 */
async function updateRestrictions(campfireId, newRestrictions) {
    const sql = `
        UPDATE campfires 
        SET restrictions = restrictions || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [campfireId, JSON.stringify(newRestrictions)]);
    return result.rows[0] || null;
}

/**
 * Update last active timestamp
 */
async function updateLastActive(campfireId) {
    const sql = `
        UPDATE campfires 
        SET last_active_at = NOW()
        WHERE id = $1
    `;
    await query(sql, [campfireId]);
}

/**
 * Archive campfire
 */
async function archive(campfireId) {
    const sql = `
        UPDATE campfires 
        SET status = 'archived',
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [campfireId]);
    return result.rows[0] || null;
}

/**
 * Suspend campfire
 */
async function suspend(campfireId, reason) {
    const sql = `
        UPDATE campfires 
        SET status = 'suspended',
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [campfireId]);
    return result.rows[0] || null;
}

/**
 * Delete campfire
 */
async function deleteCampfire(campfireId) {
    const sql = `
        DELETE FROM campfires 
        WHERE id = $1
        RETURNING *
    `;

    const result = await query(sql, [campfireId]);
    return result.rows[0] || null;
}

// ============================================
// MEMBERS
// ============================================

/**
 * Add member to campfire
 */
async function addMember(campfireId, userId, role = 'member') {
    const sql = `
        INSERT INTO campfire_members (campfire_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (campfire_id, user_id) 
        DO UPDATE SET role = EXCLUDED.role,
                      joined_at = NOW(),
                      is_banned = false,
                      updated_at = NOW()
        RETURNING *
    `;

    const result = await query(sql, [campfireId, userId, role]);
    return result.rows[0] || null;
}

/**
 * Remove member from campfire
 */
async function removeMember(campfireId, userId) {
    const sql = `
        DELETE FROM campfire_members 
        WHERE campfire_id = $1 AND user_id = $2
        RETURNING *
    `;

    const result = await query(sql, [campfireId, userId]);
    return result.rows[0] || null;
}

/**
 * Update member role
 */
async function updateMemberRole(campfireId, userId, newRole) {
    const sql = `
        UPDATE campfire_members 
        SET role = $3,
            updated_at = NOW()
        WHERE campfire_id = $1 AND user_id = $2
        RETURNING *
    `;

    const result = await query(sql, [campfireId, userId, newRole]);
    return result.rows[0] || null;
}

/**
 * Get campfire members
 */
async function getMembers(campfireId, options = {}) {
    const { role, limit = 100, offset = 0 } = options;

    let sql = `
        SELECT cm.*,
               u.username,
               u.display_name,
               u.avatar_url
        FROM campfire_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.campfire_id = $1
        AND cm.is_banned = false
    `;

    const params = [campfireId];
    let paramIndex = 2;

    if (role) {
        sql += ` AND cm.role = $${paramIndex}`;
        params.push(role);
        paramIndex++;
    }

    sql += ` ORDER BY cm.joined_at ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
}

/**
 * Get member count
 */
async function getMemberCount(campfireId) {
    const sql = `
        SELECT COUNT(*) as count 
        FROM campfire_members 
        WHERE campfire_id = $1 AND is_banned = false
    `;
    
    const result = await query(sql, [campfireId]);
    return parseInt(result.rows[0].count);
}

/**
 * Check if user is member
 */
async function isMember(campfireId, userId) {
    const sql = `
        SELECT EXISTS(
            SELECT 1 FROM campfire_members 
            WHERE campfire_id = $1 
            AND user_id = $2 
            AND is_banned = false
        ) as is_member
    `;

    const result = await query(sql, [campfireId, userId]);
    return result.rows[0]?.is_member || false;
}

/**
 * Check if user has required role
 */
async function hasRole(campfireId, userId, requiredRoles) {
    const sql = `
        SELECT role FROM campfire_members 
        WHERE campfire_id = $1 AND user_id = $2
    `;

    const result = await query(sql, [campfireId, userId]);
    const userRole = result.rows[0]?.role;
    
    if (!userRole) return false;
    
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return roles.includes(userRole);
}

/**
 * Update member last seen
 */
async function updateMemberLastSeen(campfireId, userId) {
    const sql = `
        UPDATE campfire_members 
        SET last_seen_at = NOW(),
            stats = jsonb_set(
                COALESCE(stats, '{}'::jsonb),
                '{total_time_spent}',
                ((COALESCE(stats->>'total_time_spent', '0')::int) + 1)::text::jsonb
            )
        WHERE campfire_id = $1 AND user_id = $2
    `;
    await query(sql, [campfireId, userId]);
}

/**
 * Ban member
 */
async function banMember(campfireId, userId, reason, bannedBy) {
    const sql = `
        UPDATE campfire_members 
        SET is_banned = true,
            ban_reason = $3,
            banned_by = $4,
            banned_at = NOW(),
            updated_at = NOW()
        WHERE campfire_id = $1 AND user_id = $2
        RETURNING *
    `;

    const result = await query(sql, [campfireId, userId, reason, bannedBy]);
    return result.rows[0] || null;
}

/**
 * Unban member
 */
async function unbanMember(campfireId, userId) {
    const sql = `
        UPDATE campfire_members 
        SET is_banned = false,
            ban_reason = NULL,
            banned_by = NULL,
            banned_at = NULL,
            updated_at = NOW()
        WHERE campfire_id = $1 AND user_id = $2
        RETURNING *
    `;

    const result = await query(sql, [campfireId, userId]);
    return result.rows[0] || null;
}

// ============================================
// SEARCH & LIST
// ============================================

/**
 * Search campfires
 */
async function searchCampfires(searchParams) {
    const {
        query: searchQuery,
        platform,
        tags,
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC'
    } = searchParams;

    let sql = `
        SELECT c.*,
               u.username as creator_username,
               u.display_name as creator_display_name,
               COUNT(DISTINCT cm.user_id) as member_count
        FROM campfires c
        JOIN users u ON c.creator_id = u.id
        LEFT JOIN campfire_members cm ON c.id = cm.campfire_id AND cm.is_banned = false
        WHERE c.status = 'active'
        AND c.is_public = true
        AND c.is_discoverable = true
    `;

    const params = [];
    let paramIndex = 1;

    if (searchQuery) {
        sql += ` AND (c.name ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
        params.push(`%${searchQuery}%`);
        paramIndex++;
    }

    if (platform) {
        sql += ` AND c.platform = $${paramIndex}`;
        params.push(platform);
        paramIndex++;
    }

    if (tags && tags.length > 0) {
        sql += ` AND c.tags && $${paramIndex}::text[]`;
        params.push(tags);
        paramIndex++;
    }

    sql += ` GROUP BY c.id, u.username, u.display_name`;

    // Validate sort column
    const validSortColumns = ['created_at', 'member_count', 'last_active_at', 'name'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    sql += ` ORDER BY c.${sortColumn} ${order} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
}

/**
 * Get featured campfires
 */
async function getFeatured(limit = 10) {
    const sql = `
        SELECT c.*,
               u.username as creator_username,
               u.display_name as creator_display_name,
               COUNT(DISTINCT cm.user_id) as member_count
        FROM campfires c
        JOIN users u ON c.creator_id = u.id
        LEFT JOIN campfire_members cm ON c.id = cm.campfire_id AND cm.is_banned = false
        WHERE c.status = 'active'
        AND c.is_public = true
        AND c.is_discoverable = true
        GROUP BY c.id, u.username, u.display_name
        ORDER BY c.stats->>'total_visits' DESC, cm.member_count DESC
        LIMIT $1
    `;

    const result = await query(sql, [limit]);
    return result.rows;
}

/**
 * Get campfires user is member of
 */
async function getUserCampfires(userId, limit = 50) {
    const sql = `
        SELECT c.*,
               cm.role,
               cm.nickname,
               cm.sprite_id,
               cm.color,
               cm.joined_at,
               COUNT(DISTINCT cm2.user_id) as member_count
        FROM campfire_members cm
        JOIN campfires c ON cm.campfire_id = c.id
        LEFT JOIN campfire_members cm2 ON c.id = cm2.campfire_id AND cm2.is_banned = false
        WHERE cm.user_id = $1
        AND c.status = 'active'
        AND cm.is_banned = false
        GROUP BY c.id, cm.id
        ORDER BY cm.last_seen_at DESC
        LIMIT $2
    `;

    const result = await query(sql, [userId, limit]);
    return result.rows;
}

// ============================================
// STATS
// ============================================

/**
 * Increment visit count
 */
async function incrementVisits(campfireId) {
    const sql = `
        UPDATE campfires 
        SET stats = jsonb_set(
            COALESCE(stats, '{}'::jsonb),
            '{total_visits}',
            ((COALESCE(stats->>'total_visits', '0')::int) + 1)::text::jsonb
        ),
        last_active_at = NOW()
        WHERE id = $1
    `;
    await query(sql, [campfireId]);
}

/**
 * Get campfire stats
 */
async function getStats(campfireId) {
    const sql = `
        SELECT 
            COUNT(DISTINCT cm.user_id) as unique_visitors,
            COUNT(DISTINCT cm.id) as total_visits,
            MAX(cm.last_seen_at) as last_activity
        FROM campfire_members cm
        WHERE cm.campfire_id = $1
    `;

    const result = await query(sql, [campfireId]);
    return result.rows[0];
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    create,
    findById,
    findBySlug,
    findByIdOrSlug,
    findByCreator,
    update,
    updateSettings,
    updateRestrictions,
    updateLastActive,
    archive,
    suspend,
    deleteCampfire,
    addMember,
    removeMember,
    updateMemberRole,
    getMembers,
    getMemberCount,
    isMember,
    hasRole,
    updateMemberLastSeen,
    banMember,
    unbanMember,
    searchCampfires,
    getFeatured,
    getUserCampfires,
    incrementVisits,
    getStats
};
