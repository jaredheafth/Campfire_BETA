/**
 * Campfire Widget - User Manager
 * 
 * Single source of truth for all user session state.
 * Handles user lifecycle: join, leave, state transitions.
 * Emits events for UI updates.
 */

const EventEmitter = require('events');
const User = require('./User');
const { 
  USER_STATES, 
  USER_STATE_TIMINGS,
  CAMPFIRE_CIRCLE 
} = require('../constants');

/**
 * UserManager - Centralized user session management
 * 
 * Events emitted:
 * - 'user:added' - New user added (data: User)
 * - 'user:removed' - User removed (data: User)
 * - 'user:stateChanged' - User state changed (data: { user, oldState, newState })
 * - 'user:updated' - User data updated (data: User)
 * - 'user:activity' - User activity detected (data: User)
 * - 'users:cleared' - All users cleared
 */
class UserManager extends EventEmitter {
  /**
   * Create a new UserManager instance
   * @param {Object} options - Configuration options
   * @param {number} options.maxUsers - Maximum number of joined users (default: 50)
   * @param {UserPreferencesStore} options.preferencesStore - Store for persistent preferences
   */
  constructor(options = {}) {
    super();
    
    /** @type {Map<string, User>} Users by userId */
    this.users = new Map();
    
    /** @type {number} Maximum number of joined users */
    this.maxUsers = options.maxUsers || 50;
    
    /** @type {UserPreferencesStore|null} Preferences store */
    this.preferencesStore = options.preferencesStore || null;
    
    /** @type {NodeJS.Timeout|null} State update interval */
    this._stateUpdateInterval = null;
    
    /** @type {boolean} Whether state updates are running */
    this._stateUpdatesRunning = false;
    
    // Bind methods for event handlers
    this._updateUserStates = this._updateUserStates.bind(this);
  }
  
  // ============================================
  // USER LIFECYCLE
  // ============================================
  
  /**
   * Add a new user or update existing user
   * @param {string} userId - Twitch user ID
   * @param {Object} userData - User data
   * @returns {User|null} The user instance, or null if couldn't add
   */
  async addUser(userId, userData = {}) {
    const normalizedId = String(userId);
    
    // Check if user already exists
    const existingUser = this.users.get(normalizedId);
    if (existingUser) {
      return this.updateUser(normalizedId, userData);
    }
    
    // Check max users limit (only for joined users)
    const joinedCount = this.getJoinedUsers().length;
    if (joinedCount >= this.maxUsers && userData.state !== USER_STATES.IN_CHAT) {
      console.log(`[UserManager] Max users (${this.maxUsers}) reached, cannot add ${userData.username}`);
      return null;
    }
    
    // Create new user
    const user = new User(normalizedId, {
      ...userData,
      state: userData.state || USER_STATES.IN_CHAT
    });
    
    // Load preferences if store is available
    if (this.preferencesStore) {
      try {
        const prefs = await this.preferencesStore.get(normalizedId);
        if (prefs) {
          user.applyPreferences(prefs);
        }
      } catch (error) {
        console.error(`[UserManager] Error loading preferences for ${normalizedId}:`, error);
      }
    }
    
    // Calculate angle if joining campfire
    if (user.hasJoined && user.angle === undefined) {
      user.angle = this._calculateNextAngle();
    }
    
    // Add to map
    this.users.set(normalizedId, user);
    
    // Emit event
    this.emit('user:added', user);
    
    console.log(`[UserManager] Added user: ${user.username} (${normalizedId}) - state: ${user.state}`);
    
    return user;
  }
  
  /**
   * Update an existing user's data
   * @param {string} userId - Twitch user ID
   * @param {Object} updates - Data to update
   * @returns {User|null} Updated user or null if not found
   */
  async updateUser(userId, updates = {}) {
    const normalizedId = String(userId);
    const user = this.users.get(normalizedId);
    
    if (!user) {
      console.warn(`[UserManager] Cannot update non-existent user: ${normalizedId}`);
      return null;
    }
    
    // Track if state changed
    const oldState = user.state;
    
    // Apply updates
    if (updates.username !== undefined) user.username = updates.username;
    if (updates.displayName !== undefined) user.displayName = updates.displayName;
    if (updates.twitchColor !== undefined) user.twitchColor = updates.twitchColor;
    if (updates.roles !== undefined) user.roles = { ...user.roles, ...updates.roles };
    if (updates.angle !== undefined) user.angle = updates.angle;
    if (updates.roaming !== undefined) user.roaming = updates.roaming;
    if (updates.source !== undefined) user.source = updates.source;
    
    // Handle state change
    if (updates.state !== undefined && updates.state !== oldState) {
      user.state = updates.state;
      // Emit with 3 separate arguments to match UserIPCHandlers listener signature
      this.emit('user:stateChanged', user, oldState, user.state);
    }
    
    // Emit general update event
    this.emit('user:updated', user);
    
    return user;
  }
  
  /**
   * Remove a user from the manager
   * @param {string} userId - Twitch user ID
   * @returns {User|null} Removed user or null if not found
   */
  removeUser(userId) {
    const normalizedId = String(userId);
    const user = this.users.get(normalizedId);
    
    if (!user) {
      console.warn(`[UserManager] Cannot remove non-existent user: ${normalizedId}`);
      return null;
    }
    
    this.users.delete(normalizedId);
    this.emit('user:removed', user);
    
    console.log(`[UserManager] Removed user: ${user.username} (${normalizedId})`);
    
    return user;
  }
  
  /**
   * Remove all users (called on app shutdown)
   */
  removeAllUsers() {
    const users = Array.from(this.users.values());
    
    for (const user of users) {
      this.emit('user:removed', user);
    }
    
    this.users.clear();
    this.emit('users:cleared');
    
    console.log(`[UserManager] Removed all ${users.length} users`);
  }
  
  // ============================================
  // USER QUERIES
  // ============================================
  
  /**
   * Get a user by ID
   * @param {string} userId - Twitch user ID
   * @returns {User|null}
   */
  getUser(userId) {
    return this.users.get(String(userId)) || null;
  }
  
  /**
   * Get a user by username (case-insensitive)
   * @param {string} username - Twitch username
   * @returns {User|null}
   */
  getUserByUsername(username) {
    const normalizedName = String(username).toLowerCase();
    for (const user of this.users.values()) {
      if (user.username.toLowerCase() === normalizedName) {
        return user;
      }
    }
    return null;
  }
  
  /**
   * Check if a user exists
   * @param {string} userId - Twitch user ID
   * @returns {boolean}
   */
  hasUser(userId) {
    return this.users.has(String(userId));
  }
  
  /**
   * Get all users
   * @returns {User[]}
   */
  getAllUsers() {
    return Array.from(this.users.values());
  }
  
  /**
   * Get users who have joined the campfire (not just in chat)
   * @returns {User[]}
   */
  getJoinedUsers() {
    return this.getAllUsers().filter(user => user.hasJoined);
  }
  
  /**
   * Get users who are just in chat (haven't joined)
   * @returns {User[]}
   */
  getInChatUsers() {
    return this.getAllUsers().filter(user => !user.hasJoined);
  }
  
  /**
   * Get users by state
   * @param {string} state - User state
   * @returns {User[]}
   */
  getUsersByState(state) {
    return this.getAllUsers().filter(user => user.state === state);
  }
  
  /**
   * Get users on the outer ring
   * @returns {User[]}
   */
  getOuterRingUsers() {
    return this.getAllUsers().filter(user => user.isOuterRing);
  }
  
  /**
   * Get active users (recently chatted)
   * @returns {User[]}
   */
  getActiveUsers() {
    return this.getAllUsers().filter(user => user.isActive);
  }
  
  /**
   * Get user count
   * @returns {number}
   */
  get userCount() {
    return this.users.size;
  }
  
  /**
   * Get joined user count
   * @returns {number}
   */
  get joinedCount() {
    return this.getJoinedUsers().length;
  }
  
  // ============================================
  // STATE TRANSITIONS
  // ============================================
  
  /**
   * Handle user joining the campfire
   * @param {string} userId - Twitch user ID
   * @param {Object} userData - Additional user data
   * @returns {User|null}
   */
  async joinUser(userId, userData = {}) {
    const normalizedId = String(userId);
    let user = this.users.get(normalizedId);
    
    if (user) {
      // User exists - transition to JOINED state
      const oldState = user.state;
      
      // If already joined and active, this might be a return from AFK/LURK
      if (user.state === USER_STATES.AFK || user.state === USER_STATES.LURK) {
        user.state = USER_STATES.JOINED;
        user.manualAfk = false;
        user.lastActivity = Date.now();
        
        // Emit with 3 separate arguments to match UserIPCHandlers listener signature
        this.emit('user:stateChanged', user, oldState, USER_STATES.JOINED);
        
        // Transition to ACTIVE after animation
        setTimeout(() => {
          if (user.state === USER_STATES.JOINED) {
            const prevState = user.state;
            user.state = USER_STATES.ACTIVE;
            // Emit with 3 separate arguments to match UserIPCHandlers listener signature
            this.emit('user:stateChanged', user, prevState, USER_STATES.ACTIVE);
          }
        }, USER_STATE_TIMINGS.JOINED_ANIMATION_DURATION);
        
        return user;
      }
      
      // If in chat, transition to joined
      if (user.state === USER_STATES.IN_CHAT) {
        user.state = USER_STATES.JOINED;
        user.joinedAt = Date.now();
        user.lastActivity = Date.now();
        user.angle = this._calculateNextAngle();
        
        // Apply any additional data
        if (userData.twitchColor) user.twitchColor = userData.twitchColor;
        if (userData.roles) user.roles = { ...user.roles, ...userData.roles };
        
        // Emit with 3 separate arguments to match UserIPCHandlers listener signature
        this.emit('user:stateChanged', user, oldState, USER_STATES.JOINED);
        
        // Transition to ACTIVE after animation
        setTimeout(() => {
          if (user.state === USER_STATES.JOINED) {
            const prevState = user.state;
            user.state = USER_STATES.ACTIVE;
            // Emit with 3 separate arguments to match UserIPCHandlers listener signature
            this.emit('user:stateChanged', user, prevState, USER_STATES.ACTIVE);
          }
        }, USER_STATE_TIMINGS.JOINED_ANIMATION_DURATION);
        
        return user;
      }
      
      // Already joined and active - just update activity
      user.updateActivity();
      return user;
    }
    
    // New user - add with JOINED state
    return this.addUser(normalizedId, {
      ...userData,
      state: USER_STATES.JOINED,
      joinedAt: Date.now(),
      lastActivity: Date.now()
    });
  }
  
  /**
   * Handle user leaving the campfire
   * @param {string} userId - Twitch user ID
   * @returns {User|null}
   */
  leaveUser(userId) {
    return this.removeUser(userId);
  }
  
  /**
   * Handle user going AFK
   * @param {string} userId - Twitch user ID
   * @param {boolean} manual - Whether this is a manual AFK (!afk command)
   * @returns {User|null}
   */
  setUserAfk(userId, manual = false) {
    const user = this.getUser(userId);
    if (!user || !user.hasJoined) return null;
    
    const oldState = user.state;
    user.state = USER_STATES.AFK;
    user.manualAfk = manual;
    
    // Emit with 3 separate arguments to match UserIPCHandlers listener signature
    this.emit('user:stateChanged', user, oldState, USER_STATES.AFK);
    
    return user;
  }
  
  /**
   * Handle user going into lurk mode
   * @param {string} userId - Twitch user ID
   * @returns {User|null}
   */
  setUserLurk(userId) {
    const user = this.getUser(userId);
    if (!user || !user.hasJoined) return null;
    
    const oldState = user.state;
    user.state = USER_STATES.LURK;
    
    // Emit with 3 separate arguments to match UserIPCHandlers listener signature
    this.emit('user:stateChanged', user, oldState, USER_STATES.LURK);
    
    return user;
  }
  
  /**
   * Record user activity (chat message)
   * @param {string} userId - Twitch user ID
   * @returns {User|null}
   */
  recordActivity(userId) {
    const user = this.getUser(userId);
    if (!user) return null;
    
    const oldState = user.state;
    const autoReturnInfo = user.updateActivity();
    
    // If state changed due to activity, emit event
    if (user.state !== oldState) {
      // Emit with 3 separate arguments to match UserIPCHandlers listener signature
      this.emit('user:stateChanged', user, oldState, user.state);
      
      // If this was an auto-return (user was SLEEPY/AFK and became ACTIVE via chat activity)
      if (autoReturnInfo && autoReturnInfo.autoReturned) {
        this.emit('user:autoReturn', user, autoReturnInfo.previousState);
      }
    }
    
    this.emit('user:activity', user);
    
    return user;
  }
  
  // ============================================
  // AUTOMATIC STATE UPDATES
  // ============================================
  
  /**
   * Start automatic state update interval
   */
  startStateUpdates() {
    if (this._stateUpdatesRunning) return;
    
    this._stateUpdatesRunning = true;
    this._stateUpdateInterval = setInterval(
      this._updateUserStates,
      USER_STATE_TIMINGS.STATE_UPDATE_INTERVAL
    );
    
    // Run immediately
    this._updateUserStates();
    
    console.log('[UserManager] Started automatic state updates');
  }
  
  /**
   * Stop automatic state update interval
   */
  stopStateUpdates() {
    if (this._stateUpdateInterval) {
      clearInterval(this._stateUpdateInterval);
      this._stateUpdateInterval = null;
    }
    this._stateUpdatesRunning = false;
    
    console.log('[UserManager] Stopped automatic state updates');
  }
  
  /**
   * Update user states based on activity timings
   * @private
   */
  _updateUserStates() {
    const now = Date.now();
    
    for (const user of this.users.values()) {
      // Skip users who haven't joined or are in manual states
      if (!user.hasJoined) continue;
      if (user.state === USER_STATES.LURK) continue; // LURK is manual only
      if (user.manualAfk) continue; // Manual AFK doesn't auto-transition
      
      const timeSinceActivity = now - user.lastActivity;
      const oldState = user.state;
      
      // Stacking timers: each threshold is ADDED to the previous one
      // Example: 5min sleepy + 15min afk = 20min total to become AFK
      const sleepyToAfkThreshold = USER_STATE_TIMINGS.SLEEPY_THRESHOLD + USER_STATE_TIMINGS.AFK_THRESHOLD;
      const afkToLeaveThreshold = USER_STATE_TIMINGS.SLEEPY_THRESHOLD + USER_STATE_TIMINGS.AFK_THRESHOLD + USER_STATE_TIMINGS.AUTO_LEAVE_THRESHOLD;
      
      // Check for auto-leave (longest stacked threshold)
      if (timeSinceActivity >= afkToLeaveThreshold) {
        // This would be handled by settings check in the actual implementation
        // For now, just transition to AFK
        if (user.state !== USER_STATES.AFK) {
          user.state = USER_STATES.AFK;
          // Emit with 3 separate arguments to match UserIPCHandlers listener signature
          this.emit('user:stateChanged', user, oldState, USER_STATES.AFK);
        }
        continue;
      }
      
      // Check for AFK transition (stacked: sleepy + afk time)
      if (timeSinceActivity >= sleepyToAfkThreshold) {
        if (user.state !== USER_STATES.AFK) {
          user.state = USER_STATES.AFK;
          // Emit with 3 separate arguments to match UserIPCHandlers listener signature
          this.emit('user:stateChanged', user, oldState, USER_STATES.AFK);
        }
        continue;
      }
      
      // Check for SLEEPY transition
      // Both ACTIVE and JOINED users should transition to SLEEPY after inactivity
      if (timeSinceActivity >= USER_STATE_TIMINGS.SLEEPY_THRESHOLD) {
        if (user.state === USER_STATES.ACTIVE || user.state === USER_STATES.JOINED) {
          user.state = USER_STATES.SLEEPY;
          // Emit with 3 separate arguments to match UserIPCHandlers listener signature
          this.emit('user:stateChanged', user, oldState, USER_STATES.SLEEPY);
        }
        continue;
      }
    }
  }
  
  // ============================================
  // ANGLE CALCULATION
  // ============================================
  
  /**
   * Calculate the next available angle for a new user
   * @returns {number} Angle in degrees (0-360)
   * @private
   */
  _calculateNextAngle() {
    const joinedUsers = this.getJoinedUsers().filter(u => !u.isOuterRing);
    
    if (joinedUsers.length === 0) {
      // First user - random position
      return Math.random() * 360;
    }
    
    // Get existing angles
    const existingAngles = joinedUsers.map(u => u.angle);
    
    // Find the largest gap between users
    const sortedAngles = [...existingAngles].sort((a, b) => a - b);
    
    let maxGap = 0;
    let gapStart = 0;
    
    for (let i = 0; i < sortedAngles.length; i++) {
      const current = sortedAngles[i];
      const next = sortedAngles[(i + 1) % sortedAngles.length];
      
      // Handle wrap-around
      let gap = next - current;
      if (gap < 0) gap += 360;
      
      if (gap > maxGap) {
        maxGap = gap;
        gapStart = current;
      }
    }
    
    // Place new user in the middle of the largest gap
    let newAngle = gapStart + maxGap / 2;
    if (newAngle >= 360) newAngle -= 360;
    
    return newAngle;
  }
  
  /**
   * Calculate angle for outer ring user
   * @param {User} user - User to position
   * @returns {number} Angle in degrees
   */
  calculateOuterRingAngle(user) {
    const outerRingUsers = this.getOuterRingUsers().filter(u => u.userId !== user.userId);
    const startAngle = CAMPFIRE_CIRCLE.OUTER_RING_START_ANGLE;
    const endAngle = CAMPFIRE_CIRCLE.OUTER_RING_END_ANGLE;
    const arcSize = endAngle - startAngle;
    
    if (outerRingUsers.length === 0) {
      // First outer ring user - center of arc
      return startAngle + arcSize / 2;
    }
    
    // Get existing angles
    const existingAngles = outerRingUsers.map(u => u.angle);
    const minSpacing = CAMPFIRE_CIRCLE.OUTER_RING_MIN_SPACING;
    
    // Find a spot with enough spacing
    for (let angle = startAngle; angle <= endAngle; angle += minSpacing) {
      const hasConflict = existingAngles.some(
        existing => Math.abs(existing - angle) < minSpacing
      );
      
      if (!hasConflict) {
        return angle;
      }
    }
    
    // Fallback: distribute evenly
    const totalUsers = outerRingUsers.length + 1;
    const spacing = arcSize / (totalUsers + 1);
    return startAngle + spacing * totalUsers;
  }
  
  // ============================================
  // PREFERENCES INTEGRATION
  // ============================================
  
  /**
   * Save user preferences
   * @param {string} userId - Twitch user ID
   * @param {Object} prefs - Preferences to save
   */
  async saveUserPreferences(userId, prefs) {
    if (!this.preferencesStore) {
      console.warn('[UserManager] No preferences store configured');
      return;
    }
    
    await this.preferencesStore.set(userId, prefs);
    
    // Update user if they exist
    const user = this.getUser(userId);
    if (user) {
      user.applyPreferences(prefs);
      this.emit('user:updated', user);
    }
  }
  
  /**
   * Update specific user preference
   * @param {string} userId - Twitch user ID
   * @param {string} key - Preference key
   * @param {*} value - Preference value
   */
  async updateUserPreference(userId, key, value) {
    if (!this.preferencesStore) {
      console.warn('[UserManager] No preferences store configured');
      return;
    }
    
    await this.preferencesStore.update(userId, { [key]: value });
    
    // Update user if they exist
    const user = this.getUser(userId);
    if (user) {
      const prefs = await this.preferencesStore.get(userId);
      user.applyPreferences(prefs);
      this.emit('user:updated', user);
    }
  }
  
  // ============================================
  // SERIALIZATION
  // ============================================
  
  /**
   * Get all users as plain objects (for IPC)
   * @returns {Object[]}
   */
  toJSON() {
    return this.getAllUsers().map(user => user.toJSON());
  }
  
  /**
   * Get joined users for widget display
   * @returns {Object[]}
   */
  getWidgetData() {
    return this.getJoinedUsers().map(user => user.toWidgetData());
  }
  
  /**
   * Get all users for members list
   * @returns {Object[]}
   */
  getMembersData() {
    return this.getAllUsers().map(user => user.toMemberData());
  }
  
  // ============================================
  // CLEANUP
  // ============================================
  
  /**
   * Clean up resources
   */
  destroy() {
    this.stopStateUpdates();
    this.removeAllUsers();
    this.removeAllListeners();
  }
}

module.exports = UserManager;
