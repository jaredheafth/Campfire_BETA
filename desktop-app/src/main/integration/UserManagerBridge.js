/**
 * Campfire Widget - UserManager Bridge
 * 
 * Provides backward-compatible functions that bridge the new UserManager
 * with the existing main.js code. This allows gradual migration without
 * breaking existing functionality.
 * 
 * Usage in main.js:
 *   const { UserManagerBridge } = require('./src/main/integration');
 *   const bridge = new UserManagerBridge(userManager, { broadcastToWidget, ... });
 *   
 *   // Replace: activeUsers.set(userId, user)
 *   // With:    bridge.addUser(userId, userData)
 */

const { USER_STATES } = require('../constants');

/**
 * UserManagerBridge - Backward-compatible wrapper for UserManager
 * 
 * Provides the same interface as the old activeUsers Map operations
 * but uses UserManager internally. This allows gradual migration.
 */
class UserManagerBridge {
  /**
   * Create a UserManagerBridge
   * @param {UserManager} userManager - The UserManager instance
   * @param {Object} callbacks - Callback functions from main.js
   * @param {Function} callbacks.broadcastToWidget - Send message to widget
   * @param {Function} callbacks.addEvent - Add event to queue
   * @param {Function} callbacks.loadViewerPrefs - Load viewer preferences
   * @param {Function} callbacks.saveViewerPrefsFile - Save viewer preferences
   */
  constructor(userManager, callbacks = {}) {
    /** @type {UserManager} */
    this.userManager = userManager;
    
    /** @type {Object} */
    this.callbacks = callbacks;
    
    // Setup event forwarding
    this._setupEventForwarding();
  }
  
  // ============================================
  // BACKWARD-COMPATIBLE MAP-LIKE INTERFACE
  // ============================================
  
  /**
   * Check if user exists (like Map.has)
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  has(userId) {
    return this.userManager.hasUser(userId);
  }
  
  /**
   * Get user data (like Map.get)
   * @param {string} userId - User ID
   * @returns {Object|undefined} User data in old format
   */
  get(userId) {
    const user = this.userManager.getUser(userId);
    if (!user) return undefined;
    
    // Convert to old format for backward compatibility
    return this._toOldFormat(user);
  }
  
  /**
   * Set user data (like Map.set)
   * @param {string} userId - User ID
   * @param {Object} userData - User data in old format
   * @returns {UserManagerBridge} this (for chaining)
   */
  set(userId, userData) {
    const existingUser = this.userManager.getUser(userId);
    
    if (existingUser) {
      // Update existing user
      this.userManager.updateUser(userId, this._toNewFormat(userData));
    } else {
      // Add new user
      this.userManager.addUser(userId, this._toNewFormat(userData));
    }
    
    return this;
  }
  
  /**
   * Delete user (like Map.delete)
   * @param {string} userId - User ID
   * @returns {boolean} True if deleted
   */
  delete(userId) {
    return this.userManager.removeUser(userId);
  }
  
  /**
   * Get size (like Map.size)
   * @returns {number}
   */
  get size() {
    return this.userManager.getUserCount();
  }
  
  /**
   * Get all entries (like Map.entries)
   * @returns {Iterator}
   */
  entries() {
    const users = this.userManager.getAllUsers();
    const entries = users.map(u => [u.userId, this._toOldFormat(u)]);
    return entries[Symbol.iterator]();
  }
  
  /**
   * Get all values (like Map.values)
   * @returns {Iterator}
   */
  values() {
    const users = this.userManager.getAllUsers();
    const values = users.map(u => this._toOldFormat(u));
    return values[Symbol.iterator]();
  }
  
  /**
   * Get all keys (like Map.keys)
   * @returns {Iterator}
   */
  keys() {
    const users = this.userManager.getAllUsers();
    const keys = users.map(u => u.userId);
    return keys[Symbol.iterator]();
  }
  
  /**
   * ForEach (like Map.forEach)
   * @param {Function} callback - Callback function
   */
  forEach(callback) {
    const users = this.userManager.getAllUsers();
    users.forEach(u => {
      callback(this._toOldFormat(u), u.userId, this);
    });
  }
  
  /**
   * Clear all users (like Map.clear)
   */
  clear() {
    this.userManager.clearAllUsers();
  }
  
  // ============================================
  // HIGH-LEVEL OPERATIONS
  // ============================================
  
  /**
   * Add a user (replaces activeUsers.set with full user creation)
   * @param {string} userId - User ID
   * @param {Object} userData - User data
   * @returns {Object} Created user in old format
   */
  addUser(userId, userData) {
    const user = this.userManager.addUser(userId, this._toNewFormat(userData));
    return this._toOldFormat(user);
  }
  
  /**
   * Join a user to the campfire
   * @param {string} userId - User ID
   * @param {Object} userData - User data
   * @returns {Object} Joined user in old format
   */
  joinUser(userId, userData) {
    const user = this.userManager.joinUser(userId, this._toNewFormat(userData));
    return this._toOldFormat(user);
  }
  
  /**
   * Remove a user from the campfire
   * @param {string} userId - User ID
   * @returns {boolean} True if removed
   */
  leaveUser(userId) {
    return this.userManager.leaveUser(userId);
  }
  
  /**
   * Set user AFK status
   * @param {string} userId - User ID
   * @param {boolean} isAfk - AFK status
   */
  setUserAfk(userId, isAfk) {
    this.userManager.setUserAfk(userId, isAfk);
  }
  
  /**
   * Set user lurk status
   * @param {string} userId - User ID
   * @param {boolean} isLurking - Lurk status
   */
  setUserLurk(userId, isLurking) {
    this.userManager.setUserLurk(userId, isLurking);
  }
  
  /**
   * Update user activity (for chat messages)
   * @param {string} userId - User ID
   */
  updateUserActivity(userId) {
    this.userManager.updateUserActivity(userId);
  }
  
  /**
   * Check if user is joined (by userId or username)
   * @param {string} userId - User ID
   * @param {string} username - Username
   * @returns {boolean}
   */
  isUserJoined(userId, username) {
    // Check by userId first
    if (userId && this.userManager.hasUser(userId)) {
      return true;
    }
    
    // Check by username
    if (username) {
      const user = this.userManager.getUserByUsername(username);
      return !!user;
    }
    
    return false;
  }
  
  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Object|null} User in old format or null
   */
  getUserByUsername(username) {
    const user = this.userManager.getUserByUsername(username);
    return user ? this._toOldFormat(user) : null;
  }
  
  /**
   * Build active users list for widget sync
   * @returns {Object[]} Array of user data in old format
   */
  buildActiveUsersList() {
    return this.userManager.getAllUsers().map(u => this._toOldFormat(u));
  }
  
  // ============================================
  // FORMAT CONVERSION
  // ============================================
  
  /**
   * Convert User object to old format
   * @param {User} user - User object
   * @returns {Object} Old format user data
   * @private
   */
  _toOldFormat(user) {
    if (!user) return null;
    
    // Get the raw data from User object
    const json = typeof user.toJSON === 'function' ? user.toJSON() : user;
    
    return {
      username: json.username || '',
      userId: json.userId || '',
      color: json.color || null,
      selectedSprite: json.sprite || json.selectedSprite || null,
      twitchColor: json.twitchColor || null,
      angle: json.angle || 0,
      joinedAt: json.joinedAt || Date.now(),
      state: json.state || 'joined',
      userState: json.state || 'active',
      source: json.source || 'unknown',
      roles: json.roles || null,
      isLurking: json.isLurking || false,
      isAfk: json.isAfk || false,
      still: json.still || false,
      roaming: json.roaming || false,
      wander: json.wander || false
    };
  }
  
  /**
   * Convert old format to new User data
   * @param {Object} oldData - Old format user data
   * @returns {Object} New format user data
   * @private
   */
  _toNewFormat(oldData) {
    if (!oldData) return {};
    
    // Map old state names to new USER_STATES
    let state = USER_STATES.JOINED;
    if (oldData.state === 'active' || oldData.userState === 'active') {
      state = USER_STATES.ACTIVE;
    } else if (oldData.state === 'afk' || oldData.isAfk) {
      state = USER_STATES.AFK;
    } else if (oldData.state === 'lurk' || oldData.isLurking) {
      state = USER_STATES.LURK;
    } else if (oldData.state === 'sleepy') {
      state = USER_STATES.SLEEPY;
    }
    
    return {
      username: oldData.username || oldData.displayName || '',
      twitchColor: oldData.twitchColor || oldData.color || null,
      angle: oldData.angle,
      source: oldData.source || 'unknown',
      roles: oldData.roles || null,
      state: state,
      isLurking: oldData.isLurking || false,
      // Movement state
      still: oldData.still || false,
      roaming: oldData.roaming || false,
      wander: oldData.wander || false,
      // Preferences (will be loaded from store)
      sprite: oldData.selectedSprite || oldData.sprite || null,
      color: oldData.color || null
    };
  }
  
  // ============================================
  // EVENT FORWARDING
  // ============================================
  
  /**
   * Setup event forwarding from UserManager to callbacks
   * @private
   */
  _setupEventForwarding() {
    const { broadcastToWidget, addEvent } = this.callbacks;
    
    // Forward user added event
    this.userManager.on('user:added', (user) => {
      const oldFormat = this._toOldFormat(user);
      if (addEvent) addEvent('userJoin', oldFormat);
      if (broadcastToWidget) broadcastToWidget('userJoin', oldFormat);
    });
    
    // Forward user removed event
    this.userManager.on('user:removed', (userId, userData) => {
      if (addEvent) addEvent('userLeave', { userId, ...userData });
      if (broadcastToWidget) broadcastToWidget('userLeave', { userId, ...userData });
    });
    
    // Forward state changes
    this.userManager.on('user:stateChanged', (user, oldState, newState) => {
      const oldFormat = this._toOldFormat(user);
      
      // Map to specific events based on state change
      if (newState === USER_STATES.AFK) {
        if (broadcastToWidget) broadcastToWidget('userAfk', oldFormat);
      } else if (newState === USER_STATES.LURK) {
        if (broadcastToWidget) broadcastToWidget('userLurk', oldFormat);
      } else if (oldState === USER_STATES.LURK || oldState === USER_STATES.AFK) {
        if (broadcastToWidget) broadcastToWidget('userReturnFromLurk', oldFormat);
      }
    });
    
    // Forward activity updates
    this.userManager.on('user:activity', (user) => {
      if (broadcastToWidget) {
        broadcastToWidget('userActivity', {
          userId: user.userId,
          username: user.username
        });
      }
    });
  }
  
  // ============================================
  // UTILITY
  // ============================================
  
  /**
   * Get the underlying UserManager
   * @returns {UserManager}
   */
  getManager() {
    return this.userManager;
  }
  
  /**
   * Sync preferences from old viewer-prefs.json to UserPreferencesStore
   * @param {Object} oldPrefs - Old preferences object
   * @returns {Promise<number>} Number of imported preferences
   */
  async importLegacyPreferences(oldPrefs) {
    if (!this.userManager.preferencesStore) {
      console.warn('[UserManagerBridge] No preferences store available');
      return 0;
    }
    
    return this.userManager.preferencesStore.importFromLegacy(oldPrefs);
  }
}

module.exports = UserManagerBridge;
