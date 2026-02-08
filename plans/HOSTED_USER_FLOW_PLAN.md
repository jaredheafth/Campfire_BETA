# Hosted Platform - Comprehensive User Flow & Architecture

## User Types (5 Roles)

| Role | Description | Auth Method | Capabilities |
|------|-------------|-------------|--------------|
| **MAIN_ADMIN** | Full platform owner | Email/Password | All permissions, create/delete admins, system config |
| **ADMIN** | Platform administrators | Twitch OAuth + Main Admin approval | User management, site oversight (no system config) |
| **MODERATOR** | Content moderators | Twitch OAuth | Campfire-specific: kick/bban users, manage reports |
| **CREATOR** | Campfire owners | Twitch OAuth + Approval | Create/manage campfires, assign moderators |
| **VIEWER** | End users | Twitch OAuth | Join campfires, buddy list, chat, customize |

---

## Authentication Flow - First Screen (Gatekeeper)

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMPFIRE WELCOME                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   🔥 Welcome to Campfire Widget                              │
│                                                              │
│   ┌─────────────────────────────────────────────────┐       │
│   │  Select Your Account Type                          │       │
│   │                                                   │       │
│   │  ▼ [ VIEWER (Default)                         ] ▼ │       │
│   │                                                   │       │
│   │  [ VIEWER ]       ← User-facing, selectable       │       │
│   │  [ CREATOR ]      ← Disabled, requires approval     │       │
│   │                                                   │       │
│   └─────────────────────────────────────────────────┘       │
│                                                              │
│   ┌─────────────────────────────────────────────────┐       │
│   │  [Continue with Twitch]                         → │       │
│   └─────────────────────────────────────────────────┘       │
│                                                              │
│   ┌─────────────────────────────────────────────────┐       │
│   │  [Apply to be a Creator]                     → │       │
│   │  Want to host your own campfire?              │       │
│   └─────────────────────────────────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete User Journeys

### VIEWER Journey
```
1. Landing Page / Account Selector
2. Select "VIEWER" (only enabled option)
3. "Continue with Twitch" → OAuth flow
4. Authorization callback
5. → HOME PAGE (Tents)
   - Welcome message
   - Quick stats (campfires joined, buddies online)
   - Tabs: [Home] [Campfires] [Buddies] [Settings]
6. Settings Tab → Embedded Viewer Dashboard (existing code)
```

### CREATOR Journey (After Approval)
```
1. Landing Page / Account Selector
2. Select "CREATOR" (now enabled after approval)
3. "Continue with Twitch" → OAuth flow
4. Authorization callback
5. → CREATOR DASHBOARD
   - My Campfire (configure settings)
   - Invite Link Generator (unique, expiring links)
   - Add/Configure Bot Account (toggle between user account or separate)
   - Assign Moderators
   - Analytics
```

### MODERATOR Journey
```
1. Login (assigned role by Creator or Admin)
2. → MODERATOR VIEW (limited dashboard)
   - Assigned campfires
   - Report queue
   - User search & actions (kick, ban, mute)
```

### ADMIN Journey
```
1. Admin Login (separate email/password or Twitch OAuth)
2. → ADMIN DASHBOARD
   - User Management (all users, change roles)
   - Account Types (enable/disable, create new)
   - Creator Approvals (from waiting list)
   - Site Analytics
   - Campfire Oversight
```

### MAIN_ADMIN Journey
```
1. Main Admin Login (email/password only)
2. → FULL ADMIN DASHBOARD
   - Everything ADMIN can do
   - Create/delete ADMIN accounts
   - System configuration
   - Database management access
```

---

## Database Schema

### Account Types Table
```sql
CREATE TABLE account_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE, -- 'MAIN_ADMIN', 'ADMIN', 'MODERATOR', 'CREATOR', 'VIEWER'
    display_name VARCHAR(100),
    description TEXT,
    is_user_facing BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    permissions JSONB, -- Granular permissions
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Permissions structure:
-- {
--   "campfires": ["create", "read", "update", "delete", "assign_moderator"],
--   "users": ["read", "update", "ban"],
--   "admin": ["view_logs", "manage_admins"], -- only for MAIN_ADMIN
--   "invite_links": ["create", "revoke"]
-- }
```

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_type VARCHAR(20) NOT NULL, -- 'twitch', 'email', 'discord'

    -- Twitch OAuth fields
    twitch_id VARCHAR(64) UNIQUE,
    twitch_username VARCHAR(255),
    twitch_display_name VARCHAR(255),
    twitch_profile_image_url TEXT,
    twitch_access_token TEXT,
    twitch_refresh_token TEXT,

    -- Email/Password fields (for Main Admin)
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),

    -- Role system
    account_type_id UUID REFERENCES account_types(id),
    is_creator_approved BOOLEAN DEFAULT FALSE,

    -- Bot account (for Creators - can use separate Twitch account)
    bot_twitch_id VARCHAR(64),
    bot_username VARCHAR(255),
    use_separate_bot_account BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,

    -- Constraints
    CONSTRAINT check_twitch_or_email CHECK (
        (auth_type = 'twitch' AND twitch_id IS NOT NULL) OR
        (auth_type = 'email' AND email IS NOT NULL)
    )
);
```

### Creator Waiting List
```sql
CREATE TABLE creator_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),

    -- Contact info
    email VARCHAR(255),
    phone VARCHAR(20),

    -- Application details
    twitch_channel_url VARCHAR(255),
    reason TEXT,
    expected_use_case TEXT,

    -- Social proof (optional)
    twitter_handle VARCHAR(50),
    discord_handle VARCHAR(50),
    followers_count INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);
```

### Invite Links (For Campfire Sharing)
```sql
CREATE TABLE invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campfire_id UUID REFERENCES campfires(id),
    created_by UUID REFERENCES users(id),

    -- Link details
    code VARCHAR(64) UNIQUE NOT NULL, -- Unique invite code
    link VARCHAR(255) UNIQUE NOT NULL, -- Full shareable URL

    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    max_uses INTEGER, -- NULL = unlimited
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP, -- NULL = never expires

    -- Tracking
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP,

    -- Analytics
    total_clicks INTEGER DEFAULT 0
);
```

---

## Page Architecture

```
/                           → Landing / Account Selector
/login                      → Account Selector + Twitch Login
/auth/twitch                → Twitch OAuth redirect
/auth/twitch/callback       → OAuth callback handler
/auth/email/login           → Email/Password login (Main Admin)
/auth/email/register         → Register Main Admin

/home                       → Tents (User Home)
  /home                     → Overview, stats
  /home/campfires           → My Campfires
  /home/buddies             → Buddy List
  /home/settings            → Embedded Viewer Dashboard

/dashboard                  → Creator Dashboard
  /dashboard                → Overview, quick stats
  /dashboard/campfire       → Configure My Campfire
  /dashboard/invite-links   → Generate/Manage Invite Links
  /dashboard/bot            → Bot Account Settings
  /dashboard/moderators      → Assign Moderators

/admin                      → Admin Dashboard
  /admin/users             → User Management
  /admin/account-types     → Manage Account Types
  /admin/creator-approvals  → Creator Waiting List
  /admin/campfires         → All Campfires
  /admin/analytics          → Site Analytics

/campfires/:id              → View Campfire (widget embed)
/widget/:id                 → Embeddable Widget
/chat/:id                   → Embeddable Chat

/invite/:code              → Handle invite link
                            → If logged in: join campfire
                            → If not logged in: redirect to account selector → campfire
```

---

## Component Architecture

### Frontend Pages (in `pages/` folder)
```
pages/
├── login.html              # Account selector + Twitch/Email login
├── invite.html             # Handle invite links
│
├── home.html               # Tents - User home
│   ├── components/
│   │   ├── navbar.html
│   │   ├── user-menu.html
│   │   └── campfire-card.html
│   └── tabs/
│       ├── overview.html
│       ├── campfires.html
│       ├── buddies.html
│       └── settings.html   # Embedded viewer-dashboard.html
│
├── dashboard.html          # Creator Dashboard
│   ├── components/
│   │   ├── navbar.html
│   │   ├── invite-link-manager.html
│   │   └── moderator-assigner.html
│   └── tabs/
│       ├── overview.html
│       ├── campfire.html
│       ├── invite-links.html
│       ├── bot.html
│       └── moderators.html
│
├── admin/                  # Admin Dashboard
│   ├── index.html
│   ├── users.html
│   ├── account-types.html
│   ├── creator-approvals.html
│   └── campfires.html
│
└── shared/
    ├── modals/
    │   ├── creator-application.html
    │   ├── confirm-action.html
    │   └── error-message.html
    └── styles/
        └── main.css
```

### Backend Routes (in `server/routes/`)
```
server/routes/
├── auth/
│   ├── login.js           # Account selector + OAuth start
│   ├── twitch.js          # Twitch OAuth
│   ├── callback.js        # OAuth callback
│   ├── email.js           # Email/Password auth
│   └── status.js          # Check auth status
│
├── api/
│   ├── users/
│   │   ├── me.js          # Current user profile
│   │   ├── preferences.js # User settings
│   │   └── apply.js       # Creator application
│   │
│   ├── campfires/
│   │   ├── index.js       # List, create
│   │   ├── :id.js        # Get, update, delete
│   │   ├── :id/join.js   # Join campfire
│   │   └── :id/leave.js  # Leave campfire
│   │
│   ├── buddies/
│   │   ├── index.js       # List, add, remove buddies
│   │   └── requests.js    # Buddy requests
│   │
│   ├── invite-links/
│   │   ├── index.js       # Create, list invite links
│   │   └── :id.js        # Revoke, update invite link
│   │
│   └── dashboard/
│       ├── campfire.js    # Creator campfire settings
│       ├── bot.js        # Bot account management
│       └── moderators.js  # Assign moderators
│
├── admin/
│   ├── users.js          # User management
│   ├── account-types.js   # Role management
│   ├── creator-approvals.js # Creator applications
│   └── campfires.js      # All campfires
│
└── invite/
    └── :code.js          # Handle invite link
```

---

## Invite Link System

```
┌─────────────────────────────────────────────────────────────┐
│                    INVITE LINK FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CREATOR Dashboard → Invite Links Tab                        │
│       │                                                       │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────┐         │
│  │  [Generate New Link]                           │         │
│  │                                                 │         │
│  │  Settings:                                      │         │
│  │  ┌─────────────────────────────────────────┐   │         │
│  │  │ Max Uses: [10] (blank = unlimited)    │   │         │
│  │  │ Expires: [____] (blank = never)        │   │         │
│  │  └─────────────────────────────────────────┘   │         │
│  │                                                 │         │
│  │  [Generate]                                    │         │
│  └─────────────────────────────────────────────────┘         │
│       │                                                       │
│       ▼                                                       │
│  ┌─────────────────────────────────────────────────┐         │
│  │  Active Invite Links                            │         │
│  │                                                 │         │
│  │  🔗 campfire.app/invite/ABC123XYZ            │         │
│  │     Uses: 3/10  |  Expires: Never            │         │
│  │     [Copy] [Disable] [Delete]                │         │
│  │                                                 │         │
│  │  🔗 campfire.app/invite/DEF456UVW            │         │
│  │     Uses: 0/5  |  Expires: 2024-02-28       │         │
│  │     [Copy] [Disable] [Delete]                │         │
│  └─────────────────────────────────────────────────┘         │
│                                                              │
│  VIEWER clicks invite link:                                  │
│  1. Not logged in → Account Selector → Twitch → Campfire    │
│  2. Logged in → Auto-join campfire                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation TODO List

### Phase 1: Foundation (Days 1-3)
- [ ] Database migrations for new schema
- [ ] Seed account_types table (MAIN_ADMIN, ADMIN, MODERATOR, CREATOR, VIEWER)
- [ ] Create `login.html` with account selector dropdown
- [ ] Implement Creator waiting list popup/modal
- [ ] Update `server/routes/auth/` to handle role selection
- [ ] Create basic `/home` page with tabs
- [ ] Embed `viewer-dashboard.html` in `/home/settings`

### Phase 2: Viewer Experience (Days 4-6)
- [ ] Complete `/home/campfires` tab
- [ ] Complete `/home/buddies` tab
- [ ] Implement `/api/campfires/:id/join` endpoint
- [ ] Implement `/api/campfires/:id/leave` endpoint
- [ ] Connect viewer-dashboard.html to hosted auth
- [ ] Test full Viewer flow

### Phase 3: Creator Features (Days 7-10)
- [ ] Create Creator approval workflow
- [ ] Build `/dashboard` (Creator Dashboard)
- [ ] Implement `/dashboard/campfire` settings
- [ ] Build Invite Link system
- [ ] Create Bot Account toggle (use user account vs separate)
- [ ] Implement Moderator assignment

### Phase 4: Admin System (Days 11-14)
- [ ] Build `/admin/users` management
- [ ] Build `/admin/account-types` management
- [ ] Build `/admin/creator-approvals` UI
- [ ] Email/Password auth for Main Admin
- [ ] Admin audit logging

### Phase 5: Polish & Testing (Days 15-20)
- [ ] Role-based access control (middleware)
- [ ] Invite link click tracking
- [ ] Analytics dashboard
- [ ] Security audit
- [ ] Performance testing

---

## Key Files to Modify/Create

### New Files Needed
```
pages/login.html
pages/invite.html
pages/home.html
pages/home/overview.html
pages/home/campfires.html
pages/home/buddies.html
pages/home/settings.html
pages/dashboard.html
pages/dashboard/overview.html
pages/dashboard/campfire.html
pages/dashboard/invite-links.html
pages/dashboard/bot.html
pages/dashboard/moderators.html
pages/admin/index.html
pages/admin/users.html
pages/admin/account-types.html
pages/admin/creator-approvals.html
pages/admin/campfires.html
pages/shared/modals/creator-application.html
pages/shared/modals/confirm-action.html
server/routes/auth/login.js
server/routes/auth/email.js
server/routes/api/invite-links.js
server/routes/api/dashboard/bot.js
server/routes/api/dashboard/moderators.js
server/routes/admin/users.js
server/routes/admin/account-types.js
server/routes/admin/creator-approvals.js
server/routes/invite/:code.js
```

### Files to Modify
```
server.js - Add new routes
database/schema.sql - Update schema
server/routes/supabase-auth.js - Add role handling
desktop-app/server/viewer-dashboard.html - Connect to hosted auth
```

---

## Questions Answered

✅ **Bot Account Auth**
- Default: Uses Creator's Twitch account
- Toggle: Can authenticate separate bot account

✅ **Admin Auth**
- MAIN_ADMIN: Email/Password only
- ADMIN: Twitch OAuth + Main Admin approval
- Limited permissions for Twitch-based Admins

✅ **Moderator Assignment**
- Creators can assign Moderators to their campfire
- Admins can assign Moderators to any campfire

✅ **Notifications**
- Start simple with email
- Build future-proof notification framework

✅ **Invite Links**
- Sharing button copies unique invite link
- Link → Account Selector → Twitch Auth → Auto-join campfire
- Creators can: reset, disable, delete, set max uses, set expiration
