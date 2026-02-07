/**
 * Campfire Widget - Database Schema
 * 
 * PostgreSQL schema for the hosted Campfire platform.
 * Supports:
 * - User accounts (Twitch, Google, Email)
 * - Creator campfires with full management
 * - Viewer memberships and buddy system
 * - Tents (user profiles)
 * - Chat and messaging
 * 
 * Run this on Railway PostgreSQL or local PostgreSQL instance.
 */

-- ============================================
-- EXTENSIONS
-- ============================================

-- UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

-- User account types
CREATE TYPE account_type AS ENUM ('twitch', 'google', 'email');

-- User roles in a campfire
CREATE TYPE campfire_role AS ENUM ('owner', 'moderator', 'member');

-- Buddy relationship status
CREATE TYPE buddy_status AS ENUM ('pending', 'accepted', 'blocked');

-- Message types
CREATE TYPE message_type AS ENUM ('chat', 'private', 'system');

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Authentication
    account_type account_type NOT NULL DEFAULT 'twitch',
    external_id VARCHAR(255) UNIQUE NOT NULL,  -- Twitch ID, Google ID, etc.
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),  -- For email accounts only
    
    -- Profile
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio TEXT DEFAULT '',
    banner_url TEXT,
    
    -- Settings (JSONB for flexibility)
    preferences JSONB DEFAULT '{}',
    privacy JSONB DEFAULT '{}',
    notifications JSONB DEFAULT '{}',
    
    -- Subscription/Tier (for premium features)
    subscription_tier VARCHAR(20) DEFAULT 'free',  -- 'free', 'supporter', 'premium'
    subscription_expires_at TIMESTAMP,
    
    -- Stats (JSONB for flexible tracking)
    stats JSONB DEFAULT '{
        "total_campfires_joined": 0,
        "total_time_spent": 0,
        "messages_sent": 0,
        "buddies_added": 0,
        "achievements": []
    }',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_username CHECK (username ~ '^[a-zA-Z0-9_]{3,50}$')
);

-- Indexes for users
CREATE INDEX idx_users_external_id ON users(external_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================
-- CAMPFIRES TABLE
-- ============================================

CREATE TABLE campfires (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Owner (creator of the campfire)
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Campfire details
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-friendly identifier
    description TEXT,
    tags TEXT[] DEFAULT '{}',  -- Array of tags for search
    
    -- Platform integration
    platform VARCHAR(20) DEFAULT 'twitch',  -- 'twitch', 'youtube', 'kick'
    platform_channel_id VARCHAR(255),  -- Twitch channel ID
    
    -- Visibility & Access
    is_public BOOLEAN DEFAULT true,
    is_discoverable BOOLEAN DEFAULT true,
    password_hash VARCHAR(255),  -- For private campfires
    
    -- Settings (JSONB for flexibility)
    settings JSONB DEFAULT '{
        "join_method": "command",
        "join_command": "!join",
        "max_members": 100,
        "sprite_mode": "circles",
        "allow_guest_sprites": true,
        "auto_assign_sprites": true,
        "moderation": {
            "require_approval": false,
            "allowed_roles": ["member", "moderator", "owner"]
        },
        "appearance": {
            "background_color": "#1a1a2e",
            "campfire_color": "#ff6b35",
            "show_names": true,
            "animation_speed": 1
        }
    }',
    
    -- Restrictions
    restrictions JSONB DEFAULT '{
        "subscriber_only": false,
        "vip_only": false,
        "follower_only": false,
        "min_account_age_days": 0,
        "min_account_age_action": "allow"
    }',
    
    -- Custom branding
    branding JSONB DEFAULT '{
        "custom_css": "",
        "logo_url": "",
        "background_url": "",
        "watermark_enabled": true
    }',
    
    -- Stats
    stats JSONB DEFAULT '{
        "total_visits": 0,
        "unique_visitors": 0,
        "peak_members": 0,
        "avg_session_duration": 0,
        "total_messages": 0
    }',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'archived', 'suspended'
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_campfire_name CHECK (length(name) >= 3 AND length(name) <= 100),
    CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]{3,100}$')
);

-- Indexes for campfires
CREATE INDEX idx_campfires_creator_id ON campfires(creator_id);
CREATE INDEX idx_campfires_slug ON campfires(slug);
CREATE INDEX idx_campfires_is_public ON campfires(is_public) WHERE is_public = true;
CREATE INDEX idx_campfires_is_discoverable ON campfires(is_discoverable) WHERE is_discoverable = true;
CREATE INDEX idx_campfires_platform ON campfires(platform);
CREATE INDEX idx_campfires_created_at ON campfires(created_at);
CREATE INDEX idx_campfires_tags ON campfires USING GIN(tags);

-- ============================================
-- CAMPFIRE MEMBERS TABLE (Many-to-Many)
// ===========================================

CREATE TABLE campfire_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    campfire_id UUID REFERENCES campfires(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Role in this campfire
    role campfire_role DEFAULT 'member',
    
    -- Personalization
    nickname VARCHAR(100),  -- Display name in this campfire
    sprite_id VARCHAR(255),  -- Selected sprite
    color VARCHAR(7),  -- Hex color
    
    -- Customization preferences
    preferences JSONB DEFAULT '{}',
    
    -- Member stats
    stats JSONB DEFAULT '{
        "total_time_spent": 0,
        "messages_sent": 0,
        "first_joined_at": null,
        "last_seen_at": null
    }',
    
    -- Permissions (overrides default)
    permissions JSONB DEFAULT '{}',
    
    -- Status
    is_banned BOOLEAN DEFAULT false,
    ban_reason TEXT,
    banned_at TIMESTAMP,
    banned_by UUID,  -- User ID who banned
    
    -- Timestamps
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(campfire_id, user_id)
);

-- Indexes for campfire_members
CREATE INDEX idx_campfire_members_campfire_id ON campfire_members(campfire_id);
CREATE INDEX idx_campfire_members_user_id ON campfire_members(user_id);
CREATE INDEX idx_campfire_members_role ON campfire_members(role);
CREATE INDEX idx_campfire_members_joined_at ON campfire_members(joined_at);
CREATE INDEX idx_campfire_members_last_seen_at ON campfire_members(last_seen_at);

-- ============================================
-- BUDDIES TABLE (Friendship System)
// ===========================================

CREATE TABLE buddies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    buddy_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Relationship status
    status buddy_status DEFAULT 'pending',
    
    -- Who initiated the request
    requested_by UUID REFERENCES users(id),
    
    -- Optional message with request
    request_message TEXT,
    
    -- Notes (private notes about this buddy)
    notes TEXT,
    
    -- Settings for this relationship
    settings JSONB DEFAULT '{
        "show_online_status": true,
        "notify_on_join": true,
        "priority": "normal"
    }',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP,
    
    -- Constraints
    UNIQUE(user_id, buddy_id),
    CONSTRAINT no_self_reference CHECK (user_id != buddy_id)
);

-- Indexes for buddies
CREATE INDEX idx_buddies_user_id ON buddies(user_id);
CREATE INDEX idx_buddies_buddy_id ON buddies(buddy_id);
CREATE INDEX idx_buddies_status ON buddies(status);
CREATE INDEX idx_buddies_created_at ON buddies(created_at);

-- ============================================
-- USER PREFERENCES (TENTS) TABLE
// ===========================================

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    
    -- Theme settings
    theme VARCHAR(50) DEFAULT 'modern',  -- 'modern', 'nostalgia', 'dark', 'light'
    
    -- Display preferences
    display JSONB DEFAULT '{
        "show_sprites": true,
        "animation_speed": 1,
        "compact_mode": false,
        "high_quality_sprites": true
    }',
    
    -- Notification preferences
    notifications JSONB DEFAULT '{
        "email_on_buddy_request": true,
        "email_on_campfire_invite": true,
        "push_online": true,
        "push_messages": true,
        "sound_enabled": true,
        "desktop_notifications": true
    }',
    
    -- Privacy preferences
    privacy JSONB DEFAULT '{
        "show_online_status": true,
        "show_last_seen": true,
        "show_stats": true,
        "allow_friend_requests": true,
        "index_in_search": true
    }',
    
    -- Accessibility
    accessibility JSONB DEFAULT '{
        "reduced_motion": false,
        "high_contrast": false,
        "font_size": "medium"
    }',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CAMPFIRES USER CAN SEE (Materialized View or Table)
// ============================================

CREATE TABLE campfire_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    campfire_id UUID REFERENCES campfires(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Visit details
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_seconds INTEGER DEFAULT 0,
    
    -- Source of visit
    source VARCHAR(50) DEFAULT 'direct',  -- 'direct', 'buddy', 'search', 'featured'
    
    -- Constraints
    UNIQUE(campfire_id, user_id, visited_at)
);

-- ============================================
-- MESSAGES TABLE
// ============================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Message context
    campfire_id UUID REFERENCES campfires(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    recipient_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- For private messages
    
    -- Message content
    message_type message_type DEFAULT 'chat',
    content TEXT NOT NULL,
    
    -- Message metadata
    metadata JSONB DEFAULT '{}',  -- Contains emotes, badges, etc.
    
    -- Moderation
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP,
    deleted_by UUID REFERENCES users(id),
    moderation_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for messages
CREATE INDEX idx_messages_campfire_id ON messages(campfire_id) WHERE campfire_id IS NOT NULL;
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id) WHERE recipient_id IS NOT NULL;
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_type ON messages(message_type);

-- ============================================
-- ACHIEVEMENTS TABLE
// ============================================

CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Achievement definition
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url TEXT,
    category VARCHAR(50),  -- 'engagement', 'social', 'milestone', 'special'
    
    -- Requirements (JSON schema)
    requirements JSONB NOT NULL,
    
    -- Rewards
    rewards JSONB DEFAULT '{}',  -- Badges, titles, etc.
    
    -- Visibility
    is_hidden BOOLEAN DEFAULT false,
    is_secret BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
// USER ACHIEVEMENTS TABLE
// ============================================

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
    
    -- Progress (for progressive achievements)
    progress JSONB DEFAULT '{}',
    
    -- Earned at
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, achievement_id)
);

-- Indexes for user_achievements
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_earned_at ON user_achievements(earned_at);

-- ============================================
-- SESSIONS TABLE (for JWT refresh tokens)
// ============================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Token info
    token_hash VARCHAR(255) NOT NULL,
    token_type VARCHAR(50) DEFAULT 'refresh',
    
    -- Device info
    user_agent TEXT,
    ip_address INET,
    device_id VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================
-- OAUTH ACCOUNTS TABLE (for social login)
// ============================================

CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- OAuth provider info
    provider VARCHAR(50) NOT NULL,  -- 'twitch', 'google'
    provider_user_id VARCHAR(255) NOT NULL,
    
    -- Token info (encrypted in production!)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    
    -- Profile data from provider
    profile_data JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(provider, provider_user_id),
    UNIQUE(user_id, provider)
);

-- ============================================
-- DATABASE FUNCTIONS
// ============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at'
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at 
                        BEFORE UPDATE ON %I 
                        FOR EACH ROW 
                        EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL DATA (Seed Data)
// ============================================

-- Insert default achievements
INSERT INTO achievements (code, name, description, category, requirements, rewards) VALUES
('first_join', 'First Steps', 'Join your first campfire', 'milestone', 
 '{"min_campfires_joined": 1}', 
 '{"badge": "first_join_badge", "title": "Newcomer"}'),
('campfire_regular', 'Regular', 'Visit a campfire 10 times', 'engagement',
 '{"min_visits": 10}',
 '{"badge": "regular_badge"}'),
('social_butterfly', 'Social Butterfly', 'Add 5 buddies', 'social',
 '{"min_buddies": 5}',
 '{"badge": "social_badge", "title": "Friendly"}'),
('campfire_creator', 'Campfire Starter', 'Create your first campfire', 'milestone',
 '{"min_campfires_created": 1}',
 '{"badge": "creator_badge", "title": "Founder"}');

-- ============================================
-- VIEWS
// ============================================

-- Active campfires view
CREATE OR REPLACE VIEW active_campfires AS
SELECT 
    c.*,
    u.username as creator_username,
    u.display_name as creator_display_name,
    COUNT(cm.id) as member_count,
    MAX(cm.last_seen_at) as last_activity
FROM campfires c
JOIN users u ON c.creator_id = u.id
LEFT JOIN campfire_members cm ON c.id = cm.campfire_id
WHERE c.status = 'active'
GROUP BY c.id, u.id;

-- Online users view
CREATE OR REPLACE VIEW online_users AS
SELECT 
    u.*,
    array_agg(DISTINCT cm.campfire_id) as active_campfires
FROM users u
JOIN campfire_members cm ON u.id = cm.user_id
WHERE cm.last_seen_at > NOW() - INTERVAL '5 minutes'
GROUP BY u.id;

-- ============================================
-- POLICIES (Row Level Security)
// ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campfires ENABLE ROW LEVEL SECURITY;
ALTER TABLE campfire_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users: Users can read all profiles, update own
CREATE POLICY "Users can read all profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid());

-- Campfires: Public campfires are readable by all
CREATE POLICY "Public campfires are viewable" ON campfires FOR SELECT 
USING (is_public = true OR creator_id = auth.uid());

-- Campfire members: Users can view members of campfires they're in
CREATE POLICY "Members can view campfire members" ON campfire_members FOR SELECT
USING (campfire_id IN (
    SELECT campfire_id FROM campfire_members WHERE user_id = auth.uid()
));

-- Messages: Users can view messages in campfires they're members of
CREATE POLICY "Members can view campfire messages" ON messages FOR SELECT
USING (
    (campfire_id IS NOT NULL AND campfire_id IN (
        SELECT campfire_id FROM campfire_members WHERE user_id = auth.uid()
    ))
    OR sender_id = auth.uid()
    OR recipient_id = auth.uid()
);

-- Note: These policies require a auth.uid() function which would be
-- implemented by your authentication layer (e.g., PostgREST, Supabase)
-- For standalone usage, implement application-level authorization

-- ============================================
-- COMMENTS
// ============================================

COMMENT ON TABLE users IS 'Core user accounts for the Campfire platform';
COMMENT ON TABLE campfires IS 'Campfire instances created by users';
COMMENT ON TABLE campfire_members IS 'Many-to-many relationship between users and campfires';
COMMENT ON TABLE buddies IS 'Buddy/friendship relationships between users';
COMMENT ON TABLE user_preferences IS 'User preferences (Tents settings)';
COMMENT ON TABLE messages IS 'Chat messages in campfires and private messages';
COMMENT ON TABLE achievements IS 'Gamification achievements users can earn';
COMMENT ON TABLE user_achievements IS 'User progress on achievements';
COMMENT ON TABLE sessions IS 'User sessions for authentication';
COMMENT ON TABLE oauth_accounts IS 'OAuth provider connections for social login';

-- ============================================
-- MIGRATION HELPERS
// ============================================

-- Run migrations with version tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_name VARCHAR(255) PRIMARY KEY,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Example migration tracking:
-- INSERT INTO schema_migrations (migration_name) VALUES ('001_initial_schema');

-- ============================================
// END OF SCHEMA
// ============================================
