-- Migration: Create creator_applications table
-- Purpose: Store creator applications for the waiting list system
-- Run this after the main schema is loaded

-- ============================================
-- CREATOR APPLICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS creator_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Contact info (for notification purposes)
    email VARCHAR(255) NOT NULL,

    -- Twitch channel URL (for verification)
    twitch_channel VARCHAR(500) NOT NULL,

    -- Application details
    reason TEXT,

    -- Social proof (optional)
    twitter_handle VARCHAR(50),
    discord_handle VARCHAR(100),
    followers_count INTEGER DEFAULT 0,

    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'under_review'
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for creator_applications
CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON creator_applications(status);
CREATE INDEX IF NOT EXISTS idx_creator_applications_email ON creator_applications(email);
CREATE INDEX IF NOT EXISTS idx_creator_applications_created_at ON creator_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_creator_applications_twitch_channel ON creator_applications(twitch_channel);

-- ============================================
-- INVITE LINKS TABLE (for sharing campfires)
-- ============================================

CREATE TABLE IF NOT EXISTS invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link code (unique identifier)
    code VARCHAR(64) UNIQUE NOT NULL,

    -- Campfire this invite is for
    campfire_id UUID REFERENCES campfires(id) ON DELETE CASCADE NOT NULL,

    -- Who created this invite
    created_by UUID REFERENCES users(id) NOT NULL,

    -- Link settings
    is_active BOOLEAN DEFAULT TRUE,
    max_uses INTEGER, -- NULL = unlimited
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL = never expires

    -- Optional: custom message with invite
    message TEXT,

    -- Tracking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Analytics
    total_clicks INTEGER DEFAULT 0
);

-- Indexes for invite_links
CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links(code);
CREATE INDEX IF NOT EXISTS idx_invite_links_campfire_id ON invite_links(campfire_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_expires_at ON invite_links(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invite_links_is_active ON invite_links(is_active) WHERE is_active = TRUE;

-- ============================================
-- ACCOUNT TYPES TABLE (for role-based access)
-- ============================================

CREATE TABLE IF NOT EXISTS account_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Type identification
    name VARCHAR(50) UNIQUE NOT NULL, -- 'MAIN_ADMIN', 'ADMIN', 'MODERATOR', 'CREATOR', 'VIEWER'
    display_name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Role flags
    is_user_facing BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,

    -- Permissions (JSONB for granular control)
    permissions JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for account_types
CREATE INDEX IF NOT EXISTS idx_account_types_name ON account_types(name);
CREATE INDEX IF NOT EXISTS idx_account_types_display_order ON account_types(display_order);
