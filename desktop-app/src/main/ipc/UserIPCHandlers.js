/**
 * Campfire Widget - User IPC Handlers
 * 
 * Handles all IPC communication related to user management.
 * Bridges UserManager with renderer processes (widget, dashboard).
 */

const { ipcMain } = require('electron');
const { IPC_CHANNELS } = require('../constants');

/**
 * UserIPCHandlers - IPC bridge for user management
 * 
 * Registers all user-related IPC handlers and forwards
 * UserManager events to renderer processes.
 */
class UserIPCHandlers {
  /**
   * Create UserIPCHandlers
   * @param {UserManager} userManager - The UserManager instance
   * @param {Object} windows - Object containing window references
   */
  constructor(userManager, windows) {
    /** @type {UserManager} */
    this.userManager = userManager;
    
    /** @type {Object} Window references */
    this.windows = windows;
    
    /** @type {boolean} Whether handlers are registered */
    this._registered = false;
    
    // Bind methods
    this._handleGetUsers = this._handleGetUsers.bind(this);
    this._handleGetUser = this._handleGetUser.bind(this);
    this._handleUpdateUser = this._handleUpdateUser.bind(this);
    this._handleSetUserSprite = this._handleSetUserSprite.bind(this);
    this._handleSetUserColor = this._handleSetUserColor.bind(this);
    this._handleSetUserAfk = this._handleSetUserAfk.bind(this);
    this._handleSetUserLurk = this._handleSetUserLurk.bind(this);
    this._handleRemoveUser = this._handleRemoveUser.bind(this);
    this._handleGetUserPreferences = this._handleGetUserPreferences.bind(this);
    this._handleSetUserPreferences = this._handleSetUserPreferences.bind(this);
  }
  
  /**
   * Register all IPC handlers
   */
  register() {
    if (this._registered) {
      console.warn('[UserIPCHandlers] Handlers already registered');
      return;
    }
    
    // Query handlers (invoke/handle pattern)
    ipcMain.handle(IPC_CHANNELS.USERS.GET_ALL, this._handleGetUsers);
    ipcMain.handle(IPC_CHANNELS.USERS.GET_ONE, this._handleGetUser);
    ipcMain.handle(IPC_CHANNELS.USERS.GET_PREFERENCES, this._handleGetUserPreferences);
    
    // Mutation handlers (invoke/handle pattern)
    ipcMain.handle(IPC_CHANNELS.USERS.UPDATE, this._handleUpdateUser);
    ipcMain.handle(IPC_CHANNELS.USERS.SET_SPRITE, this._handleSetUserSprite);
    ipcMain.handle(IPC_CHANNELS.USERS.SET_COLOR, this._handleSetUserColor);
    ipcMain.handle(IPC_CHANNELS.USERS.SET_AFK, this._handleSetUserAfk);
    ipcMain.handle(IPC_CHANNELS.USERS.SET_LURK, this._handleSetUserLurk);
    ipcMain.handle(IPC_CHANNELS.USERS.REMOVE, this._handleRemoveUser);
    ipcMain.handle(IPC_CHANNELS.USERS.SET_PREFERENCES, this._handleSetUserPreferences);
    
    // Subscribe to UserManager events and forward to renderers
    this._setupEventForwarding();
    
    this._registered = true;
    console.log('[UserIPCHandlers] Registered all user IPC handlers');
  }
  
  /**
   * Unregister all IPC handlers
   */
  unregister() {
    if (!this._registered) return;
    
    ipcMain.removeHandler(IPC_CHANNELS.USERS.GET_ALL);
    ipcMain.removeHandler(IPC_CHANNELS.USERS.GET_ONE);
    ipcMain.removeHandler(IPC_CHANNELS.USERS.GET_PREFERENCES);
    ipcMain.removeHandler(IPC_CHANNELS.USERS.UPDATE);
    ipcMain.removeHandler(IPC_CHANNELS.USERS.SET_SPRITE);
    ipcMain.removeHandler(IPC_CHANNELS.USERS.SET_COLOR);
    ipcMain.removeHandler(IPC_CHANNELS.USERS.SET_AFK);
    ipcMain.removeHandler(IPC_CHANNELS.USERS.SET_LURK);
    ipcMain.removeHandler(IPC_CHANNELS.USERS.REMOVE);
    ipcMain.removeHandler(IPC_CHANNELS.USERS.SET_PREFERENCES);
    
    this._registered = false;
    console.log('[UserIPCHandlers] Unregistered all user IPC handlers');
  }
  
  // ============================================
  // IPC HANDLERS
  // ============================================
  
  /**
   * Handle get all users request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {Object} options - Filter options
   * @returns {Object[]} Array of serialized users
   */
  async _handleGetUsers(event, options = {}) {
    try {
      const users = this.userManager.getAllUsers();
      
      // Apply filters if provided
      let filtered = users;
      
      if (options.state) {
        filtered = filtered.filter(u => u.state === options.state);
      }
      
      if (options.excludeAfk) {
        filtered = filtered.filter(u => !u.isAfk);
      }
      
      if (options.excludeLurk) {
        filtered = filtered.filter(u => !u.isLurking);
      }
      
      // Serialize for IPC
      return filtered.map(u => u.toJSON());
    } catch (error) {
      console.error('[UserIPCHandlers] Error getting users:', error);
      throw error;
    }
  }
  
  /**
   * Handle get single user request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {string} userId - User ID to get
   * @returns {Object|null} Serialized user or null
   */
  async _handleGetUser(event, userId) {
    try {
      const user = this.userManager.getUser(userId);
      return user ? user.toJSON() : null;
    } catch (error) {
      console.error('[UserIPCHandlers] Error getting user:', error);
      throw error;
    }
  }
  
  /**
   * Handle update user request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {string} userId - User ID to update
   * @param {Object} updates - Updates to apply
   * @returns {Object|null} Updated user or null
   */
  async _handleUpdateUser(event, userId, updates) {
    try {
      const user = this.userManager.updateUser(userId, updates);
      return user ? user.toJSON() : null;
    } catch (error) {
      console.error('[UserIPCHandlers] Error updating user:', error);
      throw error;
    }
  }
  
  /**
   * Handle set user sprite request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {string} userId - User ID
   * @param {string} sprite - Sprite name
   * @returns {boolean} Success
   */
  async _handleSetUserSprite(event, userId, sprite) {
    try {
      await this.userManager.setUserSprite(userId, sprite);
      return true;
    } catch (error) {
      console.error('[UserIPCHandlers] Error setting sprite:', error);
      throw error;
    }
  }
  
  /**
   * Handle set user color request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {string} userId - User ID
   * @param {string} color - Hex color
   * @returns {boolean} Success
   */
  async _handleSetUserColor(event, userId, color) {
    try {
      await this.userManager.setUserColor(userId, color);
      return true;
    } catch (error) {
      console.error('[UserIPCHandlers] Error setting color:', error);
      throw error;
    }
  }
  
  /**
   * Handle set user AFK request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {string} userId - User ID
   * @param {boolean} isAfk - AFK status
   * @returns {boolean} Success
   */
  async _handleSetUserAfk(event, userId, isAfk) {
    try {
      this.userManager.setUserAfk(userId, isAfk);
      return true;
    } catch (error) {
      console.error('[UserIPCHandlers] Error setting AFK:', error);
      throw error;
    }
  }
  
  /**
   * Handle set user lurk request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {string} userId - User ID
   * @param {boolean} isLurking - Lurk status
   * @returns {boolean} Success
   */
  async _handleSetUserLurk(event, userId, isLurking) {
    try {
      this.userManager.setUserLurk(userId, isLurking);
      return true;
    } catch (error) {
      console.error('[UserIPCHandlers] Error setting lurk:', error);
      throw error;
    }
  }
  
  /**
   * Handle remove user request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {string} userId - User ID to remove
   * @returns {boolean} Success
   */
  async _handleRemoveUser(event, userId) {
    try {
      return this.userManager.removeUser(userId);
    } catch (error) {
      console.error('[UserIPCHandlers] Error removing user:', error);
      throw error;
    }
  }
  
  /**
   * Handle get user preferences request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {string} userId - User ID
   * @returns {Object|null} Preferences or null
   */
  async _handleGetUserPreferences(event, userId) {
    try {
      if (!this.userManager.preferencesStore) {
        return null;
      }
      return await this.userManager.preferencesStore.get(userId);
    } catch (error) {
      console.error('[UserIPCHandlers] Error getting preferences:', error);
      throw error;
    }
  }
  
  /**
   * Handle set user preferences request
   * @param {Electron.IpcMainInvokeEvent} event
   * @param {string} userId - User ID
   * @param {Object} prefs - Preferences to set
   * @returns {boolean} Success
   */
  async _handleSetUserPreferences(event, userId, prefs) {
    try {
      if (!this.userManager.preferencesStore) {
        throw new Error('Preferences store not available');
      }
      await this.userManager.preferencesStore.update(userId, prefs);
      return true;
    } catch (error) {
      console.error('[UserIPCHandlers] Error setting preferences:', error);
      throw error;
    }
  }
  
  // ============================================
  // EVENT FORWARDING
  // ============================================
  
  /**
   * Setup event forwarding from UserManager to renderers
   * @private
   */
  _setupEventForwarding() {
    // Forward user added event
    this.userManager.on('user:added', (user) => {
      this._broadcastToWindows(IPC_CHANNELS.USERS.EVENTS.ADDED, user.toJSON());
    });
    
    // Forward user removed event
    this.userManager.on('user:removed', (userId, userData) => {
      this._broadcastToWindows(IPC_CHANNELS.USERS.EVENTS.REMOVED, { userId, userData });
    });
    
    // Forward user state changed event
    this.userManager.on('user:stateChanged', (user, oldState, newState) => {
      this._broadcastToWindows(IPC_CHANNELS.USERS.EVENTS.STATE_CHANGED, {
        user: user.toJSON(),
        oldState,
        newState
      });
    });
    
    // Forward user updated event
    this.userManager.on('user:updated', (user, changes) => {
      this._broadcastToWindows(IPC_CHANNELS.USERS.EVENTS.UPDATED, {
        user: user.toJSON(),
        changes
      });
    });
    
    // Forward user activity event
    this.userManager.on('user:activity', (user) => {
      this._broadcastToWindows(IPC_CHANNELS.USERS.EVENTS.ACTIVITY, user.toJSON());
    });
    
    console.log('[UserIPCHandlers] Event forwarding configured');
  }
  
  /**
   * Broadcast message to all windows
   * @param {string} channel - IPC channel
   * @param {*} data - Data to send
   * @private
   */
  _broadcastToWindows(channel, data) {
    // Send to widget window
    if (this.windows.widget && !this.windows.widget.isDestroyed()) {
      this.windows.widget.webContents.send(channel, data);
    }
    
    // Send to dashboard window
    if (this.windows.dashboard && !this.windows.dashboard.isDestroyed()) {
      this.windows.dashboard.webContents.send(channel, data);
    }
    
    // Send to members window
    if (this.windows.members && !this.windows.members.isDestroyed()) {
      this.windows.members.webContents.send(channel, data);
    }
    
    // Send to chat popout window
    if (this.windows.chatPopout && !this.windows.chatPopout.isDestroyed()) {
      this.windows.chatPopout.webContents.send(channel, data);
    }
    
    // Send to buddy list window
    if (this.windows.buddyList && !this.windows.buddyList.isDestroyed()) {
      this.windows.buddyList.webContents.send(channel, data);
      console.log(`[UserIPCHandlers] Broadcasted ${channel} to buddyListWindow`);
    } else {
      console.log(`[UserIPCHandlers] buddyListWindow not available for ${channel} - buddyList exists: ${!!this.windows.buddyList}`);
    }
  }
  
  /**
   * Send message to specific window
   * @param {string} windowName - Window name
   * @param {string} channel - IPC channel
   * @param {*} data - Data to send
   */
  sendToWindow(windowName, channel, data) {
    const win = this.windows[windowName];
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

module.exports = UserIPCHandlers;
