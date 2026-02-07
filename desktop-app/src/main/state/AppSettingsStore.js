/**
 * Campfire Widget - App Settings Store
 * 
 * Persistent storage for app-level settings (not user-specific).
 * This provides a single source of truth for:
 * - State timing thresholds (sleepy, AFK, auto-leave)
 * - Streamer/bot account exclusions
 * - Other app-wide configuration
 * 
 * File-based storage in userData directory.
 */

const fs = require('fs');
const path = require('path');
const { STORAGE_FILES } = require('../constants');

/**
 * Default app settings - these match the hardcoded constants
 */
const DEFAULT_APP_SETTINGS = {
  // State timing (milliseconds)
  // These values match USER_STATE_TIMINGS in constants.js
  stateTimings: {
    sleepyThreshold: 5 * 60 * 1000,     // 5 minutes
    afkThreshold: 15 * 60 * 1000,         // 15 minutes
    autoLeaveThreshold: 60 * 60 * 1000,   // 60 minutes (0 = disabled)
    stateUpdateInterval: 30000            // 30 seconds
  },
  
  // Streamer/Bot account exclusions
  exclusions: {
    excludeStreamerFromAutoState: true,   // Default: enabled
    excludeBotFromAutoState: true,         // Default: enabled
    streamerUserId: null,                  // Set when detected via Twitch
    botUserId: null                        // Set when detected via Twitch
  },
  
  // Other app settings can be added here
  // - widget dimensions
  // - theme preferences
  // - audio settings
  // - etc.
};

/**
 * AppSettingsStore - Persistent app-level settings storage
 * 
 * This is distinct from UserPreferencesStore which stores per-user preferences.
 * AppSettingsStore stores settings that apply to the entire application.
 */
class AppSettingsStore {
  /**
   * Create a new AppSettingsStore
   * @param {string} dataPath - Path to user data directory
   */
  constructor(dataPath) {
    /** @type {string} Path to settings file */
    this.filePath = path.join(dataPath, STORAGE_FILES.SETTINGS || 'app-settings.json');
    
    /** @type {Object} In-memory cache of settings */
    this._settings = null;
    
    /** @type {boolean} Whether settings are loaded */
    this._loaded = false;
    
    /** @type {NodeJS.Timeout|null} Debounced save timeout */
    this._saveTimeout = null;
    
    /** @type {number} Debounce delay for saves (ms) */
    this._saveDebounceMs = 1000;
    
    // Load on construction
    this._loadSync();
  }
  
  // ============================================
  // PUBLIC API
  // ============================================
  
  /**
   * Get all app settings (with defaults applied)
   * @returns {Object} Full settings object with defaults
   */
  getSettings() {
    if (!this._loaded) {
      console.warn('[AppSettingsStore] Settings not loaded yet, returning defaults');
      return JSON.parse(JSON.stringify(DEFAULT_APP_SETTINGS));
    }
    
    return this._mergeWithDefaults(this._settings || {});
  }
  
  /**
   * Get specific setting by path (e.g., 'stateTimings.sleepyThreshold')
   * @param {string} keyPath - Dot-separated path to setting
   * @param {*} defaultValue - Default if not found
   * @returns {*} Setting value or default
   */
  get(keyPath, defaultValue) {
    const settings = this.getSettings();
    const keys = keyPath.split('.');
    let value = settings;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }
    
    return value !== undefined ? value : defaultValue;
  }
  
  /**
   * Save a specific setting
   * @param {string} keyPath - Dot-separated path to setting
   * @param {*} value - Value to set
   */
  set(keyPath, value) {
    const settings = this.getSettings();
    const keys = keyPath.split('.');
    let current = settings;
    
    // Navigate to parent
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    // Set the value
    current[keys[keys.length - 1]] = value;
    
    // Update and save
    this._settings = settings;
    this._scheduleSave();
  }
  
  /**
   * Update multiple settings at once
   * @param {Object} updates - Object with settings to update
   */
  update(updates) {
    const settings = this.getSettings();
    this._settings = this._deepMerge(settings, updates);
    this._scheduleSave();
    
    console.log('[AppSettingsStore] Updated settings:', Object.keys(updates));
  }
  
  /**
   * Reset all settings to defaults
   */
  resetToDefaults() {
    this._settings = JSON.parse(JSON.stringify(DEFAULT_APP_SETTINGS));
    this._scheduleSave();
    console.log('[AppSettingsStore] Reset to defaults');
  }
  
  /**
   * Force immediate save (for shutdown)
   * @returns {Promise<void>}
   */
  async flush() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }
    return this.save();
  }
  
  // ============================================
  // PRIVATE METHODS
  // ============================================
  
  /**
   * Load settings from file (synchronous, for initialization)
   * @private
   */
  _loadSync() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        
        // Check for empty or whitespace-only file
        if (!data || !data.trim()) {
          console.warn('[AppSettingsStore] Settings file is empty, using defaults');
          this._settings = {};
          this._loaded = true;
          return;
        }
        
        const parsed = JSON.parse(data);
        
        // Validate it's an object
        if (typeof parsed === 'object' && parsed !== null) {
          this._settings = parsed;
          console.log('[AppSettingsStore] Loaded app settings');
        } else {
          console.warn('[AppSettingsStore] Invalid settings format, using defaults');
          this._settings = {};
        }
      } else {
        console.log('[AppSettingsStore] No existing settings file, using defaults');
        this._settings = {};
      }
    } catch (error) {
      console.error('[AppSettingsStore] Error loading settings:', error);
      this._settings = {};
    }
    
    this._loaded = true;
  }
  
  /**
   * Save settings to file
   * @private
   */
  async save() {
    return new Promise((resolve, reject) => {
      const json = JSON.stringify(this._settings, null, 2);
      
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFile(this.filePath, json, 'utf8', (err) => {
        if (err) {
          console.error('[AppSettingsStore] Error saving settings:', err);
          reject(err);
          return;
        }
        
        console.log('[AppSettingsStore] Saved app settings');
        resolve();
      });
    });
  }
  
  /**
   * Schedule a debounced save
   * @private
   */
  _scheduleSave() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }
    
    this._saveTimeout = setTimeout(() => {
      this.save().catch(err => {
        console.error('[AppSettingsStore] Scheduled save failed:', err);
      });
    }, this._saveDebounceMs);
  }
  
  /**
   * Merge loaded settings with defaults
   * @private
   */
  _mergeWithDefaults(loaded) {
    return this._deepMerge(DEFAULT_APP_SETTINGS, loaded);
  }
  
  /**
   * Deep merge two objects
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };
    
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
}

module.exports = AppSettingsStore;
