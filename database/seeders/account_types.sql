-- Seeder: Create default account types
-- Purpose: Seed the account_types table with default roles

-- Insert account types (will on conflict do nothing if already exists)
INSERT INTO account_types (name, display_name, description, is_user_facing, is_enabled, display_order, permissions)
VALUES
(
    'MAIN_ADMIN',
    'Main Administrator',
    'Full platform owner with all system permissions',
    FALSE,
    TRUE,
    1,
    '{
        "users": ["create", "read", "update", "delete", "ban"],
        "campfires": ["create", "read", "update", "delete", "suspend"],
        "admin": ["view_logs", "manage_admins", "system_config", "database_access"],
        "account_types": ["create", "read", "update", "delete"],
        "creator_applications": ["create", "read", "update", "delete"],
        "invite_links": ["create", "read", "update", "delete"]
    }'
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO account_types (name, display_name, description, is_user_facing, is_enabled, display_order, permissions)
VALUES
(
    'ADMIN',
    'Administrator',
    'Platform administrator for user management and site oversight',
    FALSE,
    TRUE,
    2,
    '{
        "users": ["create", "read", "update", "ban"],
        "campfires": ["read", "update", "suspend"],
        "admin": ["view_logs"],
        "account_types": ["read"],
        "creator_applications": ["read", "update"],
        "invite_links": ["read"]
    }'
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO account_types (name, display_name, description, is_user_facing, is_enabled, display_order, permissions)
VALUES
(
    'MODERATOR',
    'Moderator',
    'Content moderator for managing campfires',
    FALSE,
    TRUE,
    3,
    '{
        "users": ["read"],
        "campfires": ["read"],
        "creator_applications": [],
        "invite_links": []
    }'
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO account_types (name, display_name, description, is_user_facing, is_enabled, display_order, permissions)
VALUES
(
    'CREATOR',
    'Creator',
    'Campfire creator with dashboard access',
    TRUE,
    TRUE,
    4,
    '{
        "campfires": ["create", "read", "update", "delete"],
        "invite_links": ["create", "read", "update", "delete"]
    }'
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO account_types (name, display_name, description, is_user_facing, is_enabled, display_order, permissions)
VALUES
(
    'VIEWER',
    'Viewer',
    'Regular user - can join campfires and add buddies',
    TRUE,
    TRUE,
    5,
    '{
        "campfires": ["read", "join", "leave"],
        "invite_links": ["read", "use"]
    }'
)
ON CONFLICT (name) DO NOTHING;

-- Log success
DO $$
BEGIN
    RAISE NOTICE 'Account types seeded successfully';
END $$;
