/**
 * Campfire Widget - Database Models Index
 * 
 * Exports all database models from a single entry point.
 */

const User = require('./User');
const Campfire = require('./Campfire');
const Buddy = require('./Buddy');
const Message = require('./Message');

// Re-export models
module.exports = {
    User,
    Campfire,
    Buddy,
    Message
};

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Get user with profile data
 */
async function getUserWithProfile(userId) {
    const user = await User.findById(userId);
    if (!user) return null;
    
    return {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        stats: user.stats,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at,
        lastSeenAt: user.last_seen_at
    };
}

/**
 * Get campfire with details
 */
async function getCampfireWithDetails(campfireId) {
    const campfire = await Campfire.findById(campfireId);
    if (!campfire) return null;
    
    const members = await Campfire.getMembers(campfireId, { limit: 100 });
    const stats = await Campfire.getStats(campfireId);
    
    return {
        ...campfire,
        memberCount: members.length,
        members: members.map(m => ({
            id: m.user_id,
            username: m.username,
            displayName: m.display_name,
            avatarUrl: m.avatar_url,
            role: m.role,
            nickname: m.nickname,
            spriteId: m.sprite_id,
            color: m.color
        })),
        stats
    };
}

/**
 * Get buddy with online status
 */
async function getBuddyWithStatus(userId, buddyUserId) {
    const buddy = await Buddy.getBuddy(userId, buddyUserId);
    if (!buddy) return null;
    
    return {
        ...buddy,
        isOnline: buddy.last_seen_at && 
                  new Date(buddy.last_seen_at) > new Date(Date.now() - 5 * 60 * 1000)
    };
}

/**
 * Initialize all models
 */
async function initializeModels() {
    // Any model-level initialization can go here
    console.log('📦 Database models initialized');
}

module.exports = {
    User,
    Campfire,
    Buddy,
    Message,
    getUserWithProfile,
    getCampfireWithDetails,
    getBuddyWithStatus,
    initializeModels
};
