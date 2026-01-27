/**
 * Campfire Widget - User Preferences Store
 * 
 * Persistent storage for user preferences (sprite, color, custom settings).
 * File-based storage now, easily swappable to database later.
 */

const fs = require('fs');
const path = require('path');
const { STORAGE_FILES } = require('../constants');

/**
 * UserPreferencesStore - Persistent user preferences storage
 * 
 * Stores preferences that persist across sessions:
 * - Sprite choice
 * - Color preference
 * - Custom settings
 * - Future: achievements, inventory, etc.
 * 
 * Design: File-based now, interface allows easy migration to database.
 */
class UserPreferencesStore {
  /**
   * Create a new UserPreferencesStore
   * @param {string} dataPath - Path to user data directory
   */
  constructor(dataPath) {
    /** @type {string} Path to preferences file */
    this.filePath = path.join(dataPath, STORAGE_FILES.USER_PREFERENCES);
    
    /** @type {Map<string, Object>} In-memory cache */
    this.cache = new Map();
    
    /** @type {boolean} Whether cache is loaded */
    this._loaded = false;
    
    /** @type {NodeJS.Timeout|null} Debounced save timeout */
    this._saveTimeout = null;
    
    /** @type {number} Debounce delay for saves (ms) */
    this._saveDebounceMs = 1000;
    
    // Load on construction
    this._loadSync();
  }
  
  // ============================================
  // CORE CRUD OPERATIONS
  // ============================================
  
  /**
   * Get preferences for a user
   * @param {string} userId - Twitch user ID
   * @returns {Promise<Object|null>} User preferences or null if not found
   */
  async get(userId) {
    const normalizedId = String(userId);
    return this.cache.get(normalizedId) || null;
  }
  
  /**
   * Get preferences synchronously (for initialization)
   * @param {string} userId - Twitch user ID
   * @returns {Object|null} User preferences or null if not found
   */
  getSync(userId) {
    const normalizedId = String(userId);
    return this.cache.get(normalizedId) || null;
  }
  
  /**
   * Set preferences for a user (replaces all preferences)
   * @param {string} userId - Twitch user ID
   * @param {Object} prefs - Preferences object
   * @returns {Promise<void>}
   */
  async set(userId, prefs) {
    const normalizedId = String(userId);
    
    // Validate preferences
    const validated = this._validatePreferences(prefs);
    
    // Add metadata
    validated._userId = normalizedId;
    validated._updatedAt = Date.now();
    if (!validated._createdAt) {
      validated._createdAt = Date.now();
    }
    
    // Update cache
    this.cache.set(normalizedId, validated);
    
    // Schedule save
    this._scheduleSave();
  }
  
  /**
   * Update specific preferences for a user (merges with existing)
   * @param {string} userId - Twitch user ID
   * @param {Object} updates - Partial preferences to update
   * @returns {Promise<Object>} Updated preferences
   */
  async update(userId, updates) {
    const normalizedId = String(userId);
    
    // Get existing or create new
    const existing = this.cache.get(normalizedId) || {
      _userId: normalizedId,
      _createdAt: Date.now()
    };
    
    // Merge updates
    const merged = {
      ...existing,
      ...this._validatePreferences(updates),
      _updatedAt: Date.now()
    };
    
    // Update cache
    this.cache.set(normalizedId, merged);
    
    // Schedule save
    this._scheduleSave();
    
    return merged;
  }
  
  /**
   * Delete preferences for a user
   * @param {string} userId - Twitch user ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(userId) {
    const normalizedId = String(userId);
    
    if (!this.cache.has(normalizedId)) {
      return false;
    }
    
    this.cache.delete(normalizedId);
    this._scheduleSave();
    
    return true;
  }
  
  /**
   * Check if preferences exist for a user
   * @param {string} userId - Twitch user ID
   * @returns {Promise<boolean>}
   */
  async has(userId) {
    return this.cache.has(String(userId));
  }
  
  /**
   * Get all stored preferences
   * @returns {Promise<Object[]>}
   */
  async getAll() {
    return Array.from(this.cache.values());
  }
  
  /**
   * Get count of stored preferences
   * @returns {Promise<number>}
   */
  async count() {
    return this.cache.size;
  }
  
  /**
   * Clear all preferences
   * @returns {Promise<void>}
   */
  async clear() {
    this.cache.clear();
    this._scheduleSave();
  }
  
  // ============================================
  // SPECIFIC PREFERENCE HELPERS
  // ============================================
  
  /**
   * Get user's sprite preference
   * @param {string} userId - Twitch user ID
   * @returns {Promise<string|null>}
   */
  async getSprite(userId) {
    const prefs = await this.get(userId);
    return prefs?.sprite || null;
  }
  
  /**
   * Set user's sprite preference
   * @param {string} userId - Twitch user ID
   * @param {string} sprite - Sprite name
   * @returns {Promise<void>}
   */
  async setSprite(userId, sprite) {
    await this.update(userId, { sprite });
  }
  
  /**
   * Get user's color preference
   * @param {string} userId - Twitch user ID
   * @returns {Promise<string|null>}
   */
  async getColor(userId) {
    const prefs = await this.get(userId);
    return prefs?.color || null;
  }
  
  /**
   * Set user's color preference
   * @param {string} userId - Twitch user ID
   * @param {string} color - Hex color
   * @returns {Promise<void>}
   */
  async setColor(userId, color) {
    await this.update(userId, { color });
  }
  
  // ============================================
  // FILE OPERATIONS
  // ============================================
  
  /**
   * Load preferences from file (synchronous, for initialization)
   * @private
   */
  _loadSync() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        
        // Check for empty or whitespace-only file
        if (!data || !data.trim()) {
          console.warn('[UserPreferencesStore] Preferences file is empty, starting fresh');
          this.cache.clear();
          return;
        }
        
        const parsed = JSON.parse(data);
        
        // Convert array to map
        if (Array.isArray(parsed)) {
          for (const prefs of parsed) {
            if (prefs._userId) {
              this.cache.set(prefs._userId, prefs);
            }
          }
        } else if (typeof parsed === 'object') {
          // Handle old format (object with userId keys)
          for (const [userId, prefs] of Object.entries(parsed)) {
            this.cache.set(userId, { ...prefs, _userId: userId });
          }
        }
        
        console.log(`[UserPreferencesStore] Loaded ${this.cache.size} user preferences`);
      } else {
        console.log('[UserPreferencesStore] No existing preferences file, starting fresh');
      }
    } catch (error) {
      console.error('[UserPreferencesStore] Error loading preferences:', error);
      // Start with empty cache on error
      this.cache.clear();
      
      // Backup corrupted file and start fresh
      if (fs.existsSync(this.filePath)) {
        const backupPath = this.filePath + '.corrupted.' + Date.now();
        try {
          fs.renameSync(this.filePath, backupPath);
          console.warn(`[UserPreferencesStore] Backed up corrupted file to: ${backupPath}`);
        } catch (backupError) {
          console.error('[UserPreferencesStore] Could not backup corrupted file:', backupError);
        }
      }
    }
    
    this._loaded = true;
  }
  
  /**
   * Load preferences from file (async)
   * @returns {Promise<void>}
   */
  async load() {
    return new Promise((resolve, reject) => {
      fs.readFile(this.filePath, 'utf8', (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            // File doesn't exist, that's fine
            this._loaded = true;
            resolve();
            return;
          }
          reject(err);
          return;
        }
        
        try {
          const parsed = JSON.parse(data);
          
          // Convert array to map
          this.cache.clear();
          if (Array.isArray(parsed)) {
            for (const prefs of parsed) {
              if (prefs._userId) {
                this.cache.set(prefs._userId, prefs);
              }
            }
          }
          
          this._loaded = true;
          resolve();
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }
  
  /**
   * Save preferences to file
   * @returns {Promise<void>}
   */
  async save() {
    return new Promise((resolve, reject) => {
      // Convert map to array for storage
      const data = Array.from(this.cache.values());
      const json = JSON.stringify(data, null, 2);
      
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFile(this.filePath, json, 'utf8', (err) => {
        if (err) {
          console.error('[UserPreferencesStore] Error saving preferences:', err);
          reject(err);
          return;
        }
        
        console.log(`[UserPreferencesStore] Saved ${this.cache.size} user preferences`);
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
        console.error('[UserPreferencesStore] Scheduled save failed:', err);
      });
    }, this._saveDebounceMs);
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
  // VALIDATION
  // ============================================
  
  /**
   * Validate and sanitize preferences object
   * @param {Object} prefs - Raw preferences
   * @returns {Object} Validated preferences
   * @private
   */
  _validatePreferences(prefs) {
    const validated = {};
    
    // Sprite (data URL string or null)
    // Handle both string data URLs and sprite objects {name, data, ...}
    if (prefs.sprite !== undefined) {
      if (typeof prefs.sprite === 'string') {
        // Validate it's a proper data URL or file path, not "[object Object]"
        if (prefs.sprite.startsWith('data:') || prefs.sprite.startsWith('/') || prefs.sprite.startsWith('sprites/')) {
          validated.sprite = prefs.sprite;
        } else {
          // Invalid string (likely "[object Object]" from previous corruption)
          console.warn('[UserPreferencesStore] Invalid sprite string, clearing:', prefs.sprite.substring(0, 50));
          validated.sprite = null;
        }
      } else if (typeof prefs.sprite === 'object' && prefs.sprite !== null) {
        // Extract data URL from sprite object {name, data, ...}
        if (prefs.sprite.data && typeof prefs.sprite.data === 'string') {
          validated.sprite = prefs.sprite.data;
          console.log('[UserPreferencesStore] Extracted sprite data from object');
        } else {
          console.warn('[UserPreferencesStore] Sprite object has no valid data property');
          validated.sprite = null;
        }
      } else {
        validated.sprite = null;
      }
    }
    
    // Color (hex string or null)
    if (prefs.color !== undefined) {
      if (prefs.color && /^#[0-9A-Fa-f]{6}$/.test(prefs.color)) {
        validated.color = prefs.color;
      } else if (prefs.color && /^[0-9A-Fa-f]{6}$/.test(prefs.color)) {
        validated.color = '#' + prefs.color;
      } else {
        validated.color = null;
      }
    }
    
    // Custom settings (object)
    if (prefs.customSettings !== undefined) {
      validated.customSettings = typeof prefs.customSettings === 'object' 
        ? { ...prefs.customSettings }
        : {};
    }
    
    // Future: Add more preference fields here
    // - achievements: []
    // - inventory: []
    // - stats: {}
    // - etc.
    
    return validated;
  }
  
  // ============================================
  // MIGRATION HELPERS
  // ============================================
  
  /**
   * Import preferences from old format (localStorage)
   * @param {Object} oldData - Old format data
   * @returns {Promise<number>} Number of imported preferences
   */
  async importFromLegacy(oldData) {
    let imported = 0;
    
    if (typeof oldData !== 'object') return imported;
    
    for (const [key, value] of Object.entries(oldData)) {
      // Try to extract userId from various old formats
      const userId = value.userId || value.twitchId || key;
      
      if (userId) {
        await this.update(userId, {
          sprite: value.sprite || value.selectedSprite || null,
          color: value.color || value.savedColor || null
        });
        imported++;
      }
    }
    
    console.log(`[UserPreferencesStore] Imported ${imported} preferences from legacy format`);
    return imported;
  }
  
  /**
   * Export preferences for backup
   * @returns {Promise<Object>}
   */
  async export() {
    return {
      version: 1,
      exportedAt: Date.now(),
      preferences: Array.from(this.cache.values())
    };
  }
  
  /**
   * Import preferences from backup
   * @param {Object} backup - Backup data
   * @returns {Promise<number>} Number of imported preferences
   */
  async import(backup) {
    if (!backup || !Array.isArray(backup.preferences)) {
      throw new Error('Invalid backup format');
    }
    
    let imported = 0;
    
    for (const prefs of backup.preferences) {
      if (prefs._userId) {
        this.cache.set(prefs._userId, prefs);
        imported++;
      }
    }
    
    await this.save();
    
    console.log(`[UserPreferencesStore] Imported ${imported} preferences from backup`);
    return imported;
  }
  
  // ============================================
  // CLEANUP
  // ============================================
  
  /**
   * Clean up resources
   * @returns {Promise<void>}
   */
  async destroy() {
    await this.flush();
    this.cache.clear();
  }
}

module.exports = UserPreferencesStore;
