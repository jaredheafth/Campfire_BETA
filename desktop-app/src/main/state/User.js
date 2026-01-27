/**
 * Campfire Widget - User Model
 * 
 * Represents a user in the campfire system.
 * Separates session data (temporary) from preferences (persistent).
 */

const { USER_STATES, OUTER_RING_STATES, STILL_STATES, DEFAULT_COLORS } = require('../constants');

/**
 * User class representing a campfire participant
 * 
 * Session data (cleared on app shutdown):
 * - state, angle, position, activity timestamps
 * 
 * Preferences (persisted via UserPreferencesStore):
 * - sprite choice, color, custom settings
 */
class User {
  /**
   * Create a new User instance
   * @param {string} userId - Twitch user ID (canonical identifier)
   * @param {Object} data - Initial user data
   */
  constructor(userId, data = {}) {
    // ============================================
    // IDENTITY (from Twitch, immutable)
    // ============================================
    
    /** @type {string} Twitch user ID - the canonical identifier */
    this.userId = String(userId);
    
    /** @type {string} Twitch display name */
    this.username = data.username || '';
    
    /** @type {string} Twitch display name (may differ in casing) */
    this.displayName = data.displayName || data.username || '';
    
    // ============================================
    // SESSION STATE (cleared on shutdown)
    // ============================================
    
    /** @type {string} Current user state (see USER_STATES) */
    this._state = data.state || USER_STATES.IN_CHAT;
    
    /** @type {number} Position angle around the campfire (0-360 degrees) */
    this.angle = data.angle ?? Math.random() * 360;
    
    /** @type {boolean} Whether user is on the outer ring */
    this.outerRing = data.outerRing || false;
    
    /** @type {boolean} Whether user is currently roaming (NPC movement) */
    this.roaming = data.roaming ?? true;
    
    /** @type {boolean} Whether user manually set AFK (vs auto-AFK) */
    this.manualAfk = data.manualAfk || false;
    
    /** @type {number} Timestamp of last activity (chat message) */
    this.lastActivity = data.lastActivity || Date.now();
    
    /** @type {number} Timestamp when user joined the campfire */
    this.joinedAt = data.joinedAt || Date.now();
    
    /** @type {string} Source of how user was added (chat-command, api, test, etc.) */
    this.source = data.source || 'unknown';
    
    // ============================================
    // TWITCH METADATA (from IRC tags)
    // ============================================
    
    /** @type {string|null} Twitch username color (hex) */
    this.twitchColor = data.twitchColor || null;
    
    /** @type {Object} User roles/badges from Twitch */
    this.roles = {
      isBroadcaster: data.roles?.isBroadcaster || false,
      isMod: data.roles?.isMod || false,
      isVip: data.roles?.isVip || false,
      isSubscriber: data.roles?.isSubscriber || false,
      subTier: data.roles?.subTier || 0,
      isFollower: data.roles?.isFollower || false
    };
    
    // ============================================
    // PREFERENCES (loaded from UserPreferencesStore)
    // ============================================
    
    /** @type {Object|null} User preferences (sprite, color, etc.) */
    this._preferences = null;
    
    // ============================================
    // INTERNAL TRACKING
    // ============================================
    
    /** @type {string} Previous state (for state change events) */
    this._previousState = null;
    
    /** @type {boolean} Whether user was sleepy before going AFK */
    this.wasSleepy = false;
  }
  
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  /**
   * Get current user state
   * @returns {string} Current state
   */
  get state() {
    return this._state;
  }
  
  /**
   * Set user state with validation
   * @param {string} newState - New state to set
   */
  set state(newState) {
    if (!Object.values(USER_STATES).includes(newState)) {
      console.warn(`[User] Invalid state: ${newState}`);
      return;
    }
    
    this._previousState = this._state;
    this._state = newState;
    
    // Track if user was sleepy before going AFK
    if (newState === USER_STATES.AFK && this._previousState === USER_STATES.SLEEPY) {
      this.wasSleepy = true;
    } else if (newState === USER_STATES.ACTIVE || newState === USER_STATES.JOINED) {
      this.wasSleepy = false;
    }
    
    // Update outer ring status based on state
    this.outerRing = OUTER_RING_STATES.includes(newState);
    
    // Update roaming based on state
    if (STILL_STATES.includes(newState)) {
      this.roaming = false;
    } else if (newState === USER_STATES.LURK) {
      // LURK users can roam on outer ring at reduced speed
      this.roaming = true;
    }
  }
  
  /**
   * Get previous state (useful for state change events)
   * @returns {string|null} Previous state
   */
  get previousState() {
    return this._previousState;
  }
  
  /**
   * Check if user is on the outer ring
   * @returns {boolean}
   */
  get isOuterRing() {
    return this.outerRing || OUTER_RING_STATES.includes(this._state);
  }
  
  /**
   * Check if user should be still (no roaming)
   * @returns {boolean}
   */
  get isStill() {
    return STILL_STATES.includes(this._state) || !this.roaming;
  }
  
  /**
   * Check if user has joined the campfire (not just in chat)
   * @returns {boolean}
   */
  get hasJoined() {
    return this._state !== USER_STATES.IN_CHAT;
  }
  
  /**
   * Check if user is active (recently chatted)
   * @returns {boolean}
   */
  get isActive() {
    return this._state === USER_STATES.ACTIVE || this._state === USER_STATES.JOINED;
  }
  
  // ============================================
  // PREFERENCES
  // ============================================
  
  /**
   * Apply preferences loaded from UserPreferencesStore
   * @param {Object} prefs - Preferences object
   */
  applyPreferences(prefs) {
    this._preferences = prefs || {};
  }
  
  /**
   * Get user's sprite choice
   * @returns {string|null} Sprite name or null for default
   */
  get sprite() {
    return this._preferences?.sprite || null;
  }
  
  /**
   * Get user's color preference
   * Falls back to: saved color → Twitch color → hash-based default
   * @returns {string} Hex color
   */
  get color() {
    // Priority: saved preference → Twitch color → hash-based default
    if (this._preferences?.color) {
      return this._preferences.color;
    }
    if (this.twitchColor) {
      return this.twitchColor;
    }
    return this._getDefaultColor();
  }
  
  /**
   * Get a consistent default color based on username hash
   * @returns {string} Hex color
   * @private
   */
  _getDefaultColor() {
    // Simple hash function for consistent color assignment
    let hash = 0;
    const str = this.username.toLowerCase();
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % DEFAULT_COLORS.length;
    return DEFAULT_COLORS[index];
  }
  
  // ============================================
  // ACTIVITY TRACKING
  // ============================================
  
  /**
   * Update last activity timestamp (called when user chats)
   * @returns {Object|null} Auto-return info if user was auto-returned, null otherwise
   */
  updateActivity() {
    this.lastActivity = Date.now();
    
    // If user was sleepy/AFK, transition back to active (auto-return)
    if (this._state === USER_STATES.SLEEPY || this._state === USER_STATES.AFK) {
      const previousState = this._state;
      this.state = USER_STATES.ACTIVE;
      
      // Return info about the auto-return for announcement
      return {
        autoReturned: true,
        previousState: previousState,
        userId: this.userId,
        username: this.username
      };
    }
    
    return null;
  }
  
  /**
   * Get time since last activity in milliseconds
   * @returns {number}
   */
  get timeSinceActivity() {
    return Date.now() - this.lastActivity;
  }
  
  /**
   * Get time since joining in milliseconds
   * @returns {number}
   */
  get timeSinceJoin() {
    return Date.now() - this.joinedAt;
  }
  
  // ============================================
  // SERIALIZATION
  // ============================================
  
  /**
   * Convert to plain object for IPC/storage
   * @param {boolean} includePreferences - Whether to include preferences
   * @returns {Object}
   */
  toJSON(includePreferences = true) {
    const data = {
      userId: this.userId,
      username: this.username,
      displayName: this.displayName,
      state: this._state,
      angle: this.angle,
      outerRing: this.outerRing,
      roaming: this.roaming,
      manualAfk: this.manualAfk,
      lastActivity: this.lastActivity,
      joinedAt: this.joinedAt,
      source: this.source,
      twitchColor: this.twitchColor,
      roles: { ...this.roles },
      wasSleepy: this.wasSleepy,
      // Computed properties
      isOuterRing: this.isOuterRing,
      isStill: this.isStill,
      hasJoined: this.hasJoined,
      isActive: this.isActive
    };
    
    if (includePreferences && this._preferences) {
      data.sprite = this.sprite;
      data.color = this.color;
      data.preferences = { ...this._preferences };
    } else {
      // Still include computed color even without full preferences
      data.color = this.color;
    }
    
    return data;
  }
  
  /**
   * Create User instance from plain object
   * @param {Object} data - Plain object data
   * @returns {User}
   */
  static fromJSON(data) {
    const user = new User(data.userId, data);
    if (data.preferences) {
      user.applyPreferences(data.preferences);
    }
    return user;
  }
  
  /**
   * Create a minimal representation for widget display
   * @returns {Object}
   */
  toWidgetData() {
    return {
      userId: this.userId,
      username: this.username,
      displayName: this.displayName,
      state: this._state,
      angle: this.angle,
      outerRing: this.isOuterRing,
      roaming: this.roaming,
      color: this.color,
      sprite: this.sprite,
      twitchColor: this.twitchColor,
      wasSleepy: this.wasSleepy,
      roles: { ...this.roles }
    };
  }
  
  /**
   * Create a minimal representation for members list
   * @returns {Object}
   */
  toMemberData() {
    return {
      userId: this.userId,
      username: this.username,
      displayName: this.displayName,
      state: this._state,
      hasJoined: this.hasJoined,
      isActive: this.isActive,
      lastActivity: this.lastActivity,
      joinedAt: this.joinedAt,
      color: this.color,
      twitchColor: this.twitchColor,
      roles: { ...this.roles }
    };
  }
}

module.exports = User;
