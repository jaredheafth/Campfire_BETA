/**
 * Campfire Widget - Application Constants
 * 
 * All magic numbers and configuration values should be defined here.
 * This makes the codebase easier to maintain and configure.
 */

// ============================================
// WINDOW DIMENSIONS
// ============================================

/**
 * Default window dimensions for the widget
 */
const WINDOW_DEFAULTS = {
  WIDTH: 1920,
  HEIGHT: 1080,
  MIN_WIDTH: 600,
  MIN_HEIGHT: 600,
  LOCKED: true
};

/**
 * Dashboard window dimensions
 */
const DASHBOARD_WINDOW = {
  WIDTH: 750,
  HEIGHT: 900
};

/**
 * Chat popout window dimensions
 */
const CHAT_POPOUT_WINDOW = {
  WIDTH: 400,
  HEIGHT: 600,
  MIN_WIDTH: 300,
  MIN_HEIGHT: 400
};

/**
 * Settings window dimensions
 */
const SETTINGS_WINDOW = {
  WIDTH: 500,
  HEIGHT: 700,
  MIN_WIDTH: 400,
  MIN_HEIGHT: 500
};

/**
 * Members window dimensions
 */
const MEMBERS_WINDOW = {
  WIDTH: 400,
  HEIGHT: 600,
  MIN_WIDTH: 350,
  MIN_HEIGHT: 400
};

// ============================================
// CAMPFIRE VISUAL SETTINGS
// ============================================

/**
 * Circle/ring configuration for sprite positioning
 */
const CAMPFIRE_CIRCLE = {
  // Base radius for the inner ring (active users)
  BASE_RADIUS: 120,
  
  // Multiplier for outer ring (AFK/LURK users)
  // Outer ring radius = BASE_RADIUS * OUTER_RING_MULTIPLIER
  OUTER_RING_MULTIPLIER: 1.67,
  
  // Outer ring arc (degrees) - where AFK/LURK users are positioned
  // 190° to 350° = back/top of the campfire
  OUTER_RING_START_ANGLE: 190,
  OUTER_RING_END_ANGLE: 350,
  
  // Minimum spacing between users on outer ring (degrees)
  OUTER_RING_MIN_SPACING: 25,
  
  // Default sprite size (pixels)
  DEFAULT_SPRITE_SIZE: 40,
  
  // Perspective scaling amount (0-1)
  // Higher = more size difference between front and back sprites
  PERSPECTIVE_SCALE_AMOUNT: 0.17,
  
  // Scale reduction for outer ring users (makes them appear further away)
  OUTER_RING_SCALE_REDUCTION: 0.85
};

/**
 * Z-index layering for proper depth sorting
 */
const Z_INDEX = {
  // Sprites at back of circle (top)
  SPRITE_BACK_MIN: 5,
  
  // Campfire graphic
  CAMPFIRE: 10,
  
  // Sprites at front of circle (bottom)
  SPRITE_FRONT_MAX: 24,
  
  // Chat bubbles
  CHAT_BUBBLE: 25,
  
  // Usernames (always above sprites)
  USERNAME: 100,
  
  // Dashboard overlay
  DASHBOARD_OVERLAY: 50000,
  
  // Menu bar (highest)
  MENU_BAR: 999999
};

// ============================================
// USER STATE TIMINGS
// ============================================

/**
 * Timing configuration for user state transitions (in milliseconds)
 */
const USER_STATE_TIMINGS = {
  // How often to check and update user states
  STATE_UPDATE_INTERVAL: 30000, // 30 seconds
  
  // Time after last activity before user becomes SLEEPY
  SLEEPY_THRESHOLD: 5 * 60 * 1000, // 5 minutes
  
  // Time after last activity before user becomes AFK
  AFK_THRESHOLD: 15 * 60 * 1000, // 15 minutes
  
  // Time after AFK before auto-leave (if enabled)
  AUTO_LEAVE_THRESHOLD: 60 * 60 * 1000, // 60 minutes
  
  // Duration of "JOINED" state animation before transitioning to ACTIVE
  JOINED_ANIMATION_DURATION: 4500, // 4.5 seconds
  
  // Duration of chat bubble display
  CHAT_BUBBLE_DURATION: 5000, // 5 seconds
  
  // Duration of chat bubble fade out
  CHAT_BUBBLE_FADE_DURATION: 250 // 0.25 seconds
};

// ============================================
// USER STATES
// ============================================

/**
 * Valid user states
 * State machine: IN_CHAT → JOINED → ACTIVE → SLEEPY → AFK
 *                ACTIVE/SLEEPY/AFK → LURK (manual)
 *                LURK/AFK → ACTIVE (via !join)
 */
const USER_STATES = {
  // User is in Twitch chat but hasn't joined the campfire
  IN_CHAT: 'IN_CHAT',
  
  // User just joined (playing entrance animation)
  JOINED: 'JOINED',
  
  // User is active (recently chatted)
  ACTIVE: 'ACTIVE',
  
  // User hasn't chatted in a while
  SLEEPY: 'SLEEPY',
  
  // User hasn't chatted for a long time
  AFK: 'AFK',
  
  // User manually entered lurk mode
  LURK: 'LURK'
};

/**
 * States that place users on the outer ring
 */
const OUTER_RING_STATES = [USER_STATES.AFK, USER_STATES.LURK];

/**
 * States that make sprites "still" (no roaming animation)
 */
const STILL_STATES = [USER_STATES.SLEEPY, USER_STATES.AFK];

// ============================================
// ANIMATION TIMINGS
// ============================================

/**
 * Animation durations (in milliseconds)
 */
const ANIMATIONS = {
  // Pop-in entrance animation
  ENTRANCE_DURATION: 500,
  
  // Lift-fade-out exit animation
  EXIT_DURATION: 600,
  
  // Swivel/spin animation
  SWIVEL_DURATION: 1500,
  
  // Dance animation cycle
  DANCE_CYCLE: 300,
  
  // Sparkle animation duration
  SPARKLE_DURATION: 3000,
  
  // Idle float animation cycle
  IDLE_FLOAT_CYCLE: 3000,
  
  // Walking bounce animation cycle
  WALK_BOUNCE_CYCLE: 600,
  
  // Position transition (when moving around circle)
  POSITION_TRANSITION: 300
};

// ============================================
// ROAMING/MOVEMENT
// ============================================

/**
 * NPC roaming configuration
 */
const ROAMING = {
  // Base speed for roaming (degrees per update)
  BASE_SPEED: 0.5,
  
  // Speed multiplier for LURK users on outer ring
  LURK_SPEED_MULTIPLIER: 0.5,
  
  // Minimum time between direction changes (ms)
  MIN_DIRECTION_CHANGE_INTERVAL: 3000,
  
  // Maximum time between direction changes (ms)
  MAX_DIRECTION_CHANGE_INTERVAL: 10000,
  
  // Default rotation amount for !cw/!ccw commands (degrees)
  DEFAULT_ROTATION_DEGREES: 45
};

// ============================================
// COMMAND CATEGORIES
// ============================================

/**
 * Command categories for organizing and styling
 */
const COMMAND_CATEGORIES = {
  // State-changing commands (join, leave, afk, lurk)
  STATE: 'STATE',
  
  // Movement commands (cw, ccw)
  MOVEMENT: 'MOVEMENT',
  
  // Appearance commands (sprite, color)
  APPEARANCE: 'APPEARANCE',
  
  // Animation commands (spin, dance, sparkle)
  ANIMATION: 'ANIMATION',
  
  // Informational commands (help, status)
  INFO: 'INFO',
  
  // Auto-triggered announcements (sleepy, afk, auto-leave)
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  
  // Custom user-defined commands
  CUSTOM: 'CUSTOM'
};

/**
 * Categories that should display in italic/narrative style
 */
const ITALIC_COMMAND_CATEGORIES = [
  COMMAND_CATEGORIES.STATE,
  COMMAND_CATEGORIES.ANIMATION,
  COMMAND_CATEGORIES.MOVEMENT,
  COMMAND_CATEGORIES.APPEARANCE
];

// ============================================
// CHAT DESTINATIONS
// ============================================

/**
 * Available chat destinations for bot responses
 */
const CHAT_DESTINATIONS = {
  // Internal dashboard chat (always receives all messages)
  INTERNAL: 'internal',
  
  // Pop-out chat window
  POPOUT: 'popout',
  
  // Twitch chat
  TWITCH: 'twitch'
};

// ============================================
// SPRITE MODES
// ============================================

/**
 * Available sprite display modes
 */
const SPRITE_MODES = {
  // Simple colored circles
  CIRCLE: 'circle',
  CIRCLES: 'circles',
  
  // Pixel morph animations
  PIXEL_MORPHS: 'pixel-morphs',
  
  // RPG character sprites
  RPG_CHARACTERS: 'rpg-characters',
  
  // Custom user-uploaded sprites
  CUSTOM: 'custom'
};

// ============================================
// DEFAULT COLORS
// ============================================

/**
 * Default color palette for users without custom colors
 */
const DEFAULT_COLORS = [
  '#667eea', // Purple-blue
  '#764ba2', // Purple
  '#f093fb', // Pink
  '#f5576c', // Red-pink
  '#4facfe', // Light blue
  '#00f2fe', // Cyan
  '#43e97b', // Green
  '#38f9d7', // Teal
  '#fa709a', // Pink
  '#fee140', // Yellow
  '#ff6b35', // Orange
  '#9b59b6'  // Violet
];

/**
 * State-specific colors
 */
const STATE_COLORS = {
  ACTIVE: '#00ff00',    // Green
  JOINED: '#ffff00',    // Yellow
  SLEEPY: '#5b9bd5',    // Blue
  AFK: '#444444',       // Dark gray
  LURK: '#9b59b6'       // Purple
};

// ============================================
// TWITCH INTEGRATION
// ============================================

/**
 * Twitch API configuration
 */
const TWITCH = {
  // OAuth scopes required for the main account
  MAIN_ACCOUNT_SCOPES: [
    'chat:read',
    'chat:edit',
    'channel:read:subscriptions',
    'moderator:read:chatters',
    'user:read:chat'  // For fetching user chat colors
  ],
  
  // OAuth scopes required for the bot account
  BOT_ACCOUNT_SCOPES: [
    'chat:read',
    'chat:edit',
    'channel:moderate' // For deleting messages (silent mode)
  ],
  
  // Twitch IRC server
  IRC_SERVER: 'irc.chat.twitch.tv',
  IRC_PORT: 6667,
  IRC_PORT_SSL: 443,
  
  // API endpoints
  HELIX_BASE_URL: 'https://api.twitch.tv/helix',
  OAUTH_BASE_URL: 'https://id.twitch.tv/oauth2',
  
  // Rate limits
  MESSAGE_RATE_LIMIT: 20, // messages per 30 seconds (non-mod)
  MOD_MESSAGE_RATE_LIMIT: 100 // messages per 30 seconds (mod)
};

// ============================================
// THIRD-PARTY EMOTES
// ============================================

/**
 * Third-party emote provider configuration
 */
const EMOTE_PROVIDERS = {
  BTTV: {
    NAME: 'BetterTTV',
    API_BASE: 'https://api.betterttv.net/3',
    CDN_BASE: 'https://cdn.betterttv.net/emote'
  },
  FFZ: {
    NAME: 'FrankerFaceZ',
    API_BASE: 'https://api.frankerfacez.com/v1',
    CDN_BASE: 'https://cdn.frankerfacez.com/emote'
  },
  SEVENTV: {
    NAME: '7TV',
    API_BASE: 'https://7tv.io/v3',
    CDN_BASE: 'https://cdn.7tv.app/emote'
  }
};

// ============================================
// FILE PATHS
// ============================================

/**
 * Default file names for persistent storage
 */
const STORAGE_FILES = {
  SETTINGS: 'settings.json',
  TWITCH_CONFIG: 'twitch-config.json',
  USER_PREFERENCES: 'user-preferences.json',
  WINDOW_DIMENSIONS: 'window-dimensions.json',
  BOT_MESSAGES: 'bot-messages.json',
  SPRITE_PATH_CONFIG: 'sprite-path.json'
};

/**
 * Directory names
 */
const DIRECTORIES = {
  AUDIO_FILES: 'audio-files',
  CUSTOM_SPRITES: 'custom-sprites'
};

// ============================================
// IPC CHANNELS
// ============================================

/**
 * IPC channel names - centralized registry
 * All IPC communication should use these constants
 */
const IPC_CHANNELS = {
  // Window management
  OPEN_DASHBOARD: 'open-dashboard',
  OPEN_MEMBERS_WINDOW: 'open-members-window',
  OPEN_CHAT_POPOUT: 'open-chat-popout',
  OPEN_SETTINGS_MODAL: 'open-settings-modal',
  OPEN_MEMBER_DASHBOARD: 'open-member-dashboard',
  BRING_CHAT_POPOUT_TO_FRONT: 'bring-chat-popout-to-front',
  BRING_WIDGET_TO_FRONT: 'bring-widget-to-front',
  GET_WINDOW_DIMENSIONS: 'get-window-dimensions',
  SET_WINDOW_DIMENSIONS: 'set-window-dimensions',
  TOGGLE_WINDOW_LOCK: 'toggle-window-lock',
  
  // Settings
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  SETTINGS_UPDATE: 'settingsUpdate',
  UPDATE_AUDIO_SETTINGS: 'update-audio-settings',
  
  // Twitch
  GET_TWITCH_CONFIG: 'get-twitch-config',
  SAVE_TWITCH_CONFIG: 'save-twitch-config',
  GET_TWITCH_STATUS: 'get-twitch-status',
  GENERATE_TWITCH_TOKEN: 'generate-twitch-token',
  SEND_CHAT_MESSAGE: 'send-chat-message',
  DISCONNECT_TWITCH: 'disconnect-twitch',
  TWITCH_CONNECTED: 'twitchConnected',
  TWITCH_DISCONNECTED: 'twitchDisconnected',
  TWITCH_CHAT_BOT_CONNECTED: 'twitchChatBotConnected',
  TWITCH_CHAT_BOT_DISCONNECTED: 'twitchChatBotDisconnected',
  TWITCH_ERROR: 'twitchError',
  TWITCH_CHAT_MESSAGE: 'twitchChatMessage',
  THIRD_PARTY_EMOTES_UPDATE: 'thirdPartyEmotesUpdate',
  GET_THIRD_PARTY_EMOTES: 'get-third-party-emotes',
  
  // Users/Members (legacy flat channels)
  GET_ACTIVE_USERS: 'get-active-users',
  GET_WIDGET_USERS: 'get-widget-users',
  GET_POTENTIAL_MEMBERS: 'get-potential-members',
  GET_WIDGET_DISPLAY_USERS: 'get-widget-display-users',
  REFRESH_CHATTERS: 'refresh-chatters',
  ADD_TO_CHATTERS: 'add-to-chatters',
  GET_VIEWER_PREFS: 'get-viewer-prefs',
  SAVE_VIEWER_PREFS: 'save-viewer-prefs',
  KICK_MEMBER: 'kick-member',
  JOIN_MEMBER: 'join-member',
  SIMULATE_JOIN_COMMAND: 'simulate-join-command',
  KICK_ALL_USERS: 'kick-all-users',
  JOIN_ALL_USERS: 'join-all-users',
  POTENTIAL_MEMBERS_UPDATE: 'potentialMembersUpdate',
  REFRESH_MEMBERS: 'refresh-members',
  SYNC_FULL_STATE: 'sync-full-state',
  
  // Users (new structured channels for UserManager)
  USERS: {
    // Query handlers (invoke/handle pattern)
    GET_ALL: 'users:get-all',
    GET_ONE: 'users:get-one',
    GET_PREFERENCES: 'users:get-preferences',
    
    // Mutation handlers (invoke/handle pattern)
    UPDATE: 'users:update',
    SET_SPRITE: 'users:set-sprite',
    SET_COLOR: 'users:set-color',
    SET_AFK: 'users:set-afk',
    SET_LURK: 'users:set-lurk',
    REMOVE: 'users:remove',
    SET_PREFERENCES: 'users:set-preferences',
    
    // Events (sent from main to renderer via webContents.send)
    EVENTS: {
      ADDED: 'users:added',
      UPDATED: 'users:updated',
      REMOVED: 'users:removed',
      STATE_CHANGED: 'users:state-changed',
      PREFERENCES_CHANGED: 'users:preferences-changed',
      ACTIVITY: 'users:activity'
    }
  },
  
  // Events
  GET_EVENTS: 'get-events',
  USER_JOIN: 'userJoin',
  USER_LEAVE: 'userLeave',
  USER_AFK: 'userAfk',
  USER_LURK: 'userLurk',
  USER_RETURN_FROM_LURK: 'userReturnFromLurk',
  USER_UPDATE: 'userUpdate',
  CHAT_MESSAGE: 'chatMessage',
  USER_ACTIVITY: 'userActivity',
  VIEWER_MOVEMENT: 'viewerMovement',
  VIEWER_SPRITE_CHANGE: 'viewerSpriteChange',
  VIEWER_COLOR_CHANGE: 'viewerColorChange',
  VIEWER_TWITCH_COLOR_UPDATE: 'viewerTwitchColorUpdate',
  
  // Sprites
  GET_SPRITE_PATH: 'get-sprite-path',
  SET_SPRITE_PATH: 'set-sprite-path',
  RESET_SPRITE_PATH: 'reset-sprite-path',
  SPRITE_PATH_CHANGED: 'sprite-path-changed',
  
  // Audio
  SAVE_AUDIO_FILE: 'save-audio-file',
  LOAD_AUDIO_FILE: 'load-audio-file',
  DELETE_AUDIO_FILE: 'delete-audio-file',
  CONTROL_AUDIO: 'control-audio',
  GET_AUDIO_STATUS: 'get-audio-status',
  AUDIO_CONTROL: 'audioControl',
  GET_AUDIO_STATUS_EVENT: 'getAudioStatus',
  AUDIO_STATUS_RESPONSE: 'audio-status-response',
  
  // Auto-updater
  CHECK_FOR_UPDATES: 'check-for-updates',
  DOWNLOAD_UPDATE: 'download-update',
  INSTALL_UPDATE: 'install-update',
  GET_APP_VERSION: 'get-app-version',
  UPDATE_STATUS: 'update-status',
  UPDATE_PROGRESS: 'update-progress',
  
  // Bot messages
  GET_BOT_MESSAGES: 'get-bot-messages',
  SAVE_BOT_MESSAGES: 'save-bot-messages',
  BOT_MESSAGES_UPDATED: 'bot-messages-updated',
  INITIALIZE_BOT_MESSAGES: 'initialize-bot-messages',
  
  // Dashboard
  SWITCH_TAB: 'switch-tab',
  
  // App lifecycle
  SHUTDOWN_APP: 'shutdown-app'
};

// ============================================
// EXPORTS (CommonJS)
// ============================================

module.exports = {
  WINDOW_DEFAULTS,
  DASHBOARD_WINDOW,
  CHAT_POPOUT_WINDOW,
  SETTINGS_WINDOW,
  MEMBERS_WINDOW,
  CAMPFIRE_CIRCLE,
  Z_INDEX,
  USER_STATE_TIMINGS,
  USER_STATES,
  OUTER_RING_STATES,
  STILL_STATES,
  ANIMATIONS,
  ROAMING,
  COMMAND_CATEGORIES,
  ITALIC_COMMAND_CATEGORIES,
  CHAT_DESTINATIONS,
  SPRITE_MODES,
  DEFAULT_COLORS,
  STATE_COLORS,
  TWITCH,
  EMOTE_PROVIDERS,
  STORAGE_FILES,
  DIRECTORIES,
  IPC_CHANNELS
};
