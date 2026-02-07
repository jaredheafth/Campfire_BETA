# Private Messaging & User Identity System - Implementation Plan

## Overview

Build a unified Campfire user identity system that:
1. Creates a persistent user database beyond just Twitch usernames
2. Supports multiple platform connections per user (Twitch → Discord)
3. Implements private messaging via Twitch whispers
4. Persists message history locally
5. Ready for future platform integrations

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMPFIRE USER SYSTEM                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               CampfireUserManager                    │   │
│  │  - User registry with unique Campfire ID             │   │
│  │  - Platform account linking (Twitch, Discord)         │   │
│  │  - Private message threads                           │   │
│  │  - Presence & availability                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          │ IPC                               │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    IPC Handlers                       │   │
│  │  - sendPrivateMessage                                │   │
│  │  - getPrivateMessages                                │   │
│  │  - markMessagesRead                                  │   │
│  │  - getCampfireUsers                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          │                                   │
│  ┌───────────────────────▼─────────────────────────────┐  │
│  │                  Renderer Windows                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │ Buddy List  │  │ PM Window   │  │ Dashboard   │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Campfire User

```typescript
interface CampfireUser {
  // Unique Campfire identity
  campfireId: string;           // UUID v4
  createdAt: number;            // Timestamp
  updatedAt: number;            // Timestamp
  
  // Primary identity (Twitch)
  twitchAccount?: {
    userId: string;             // Twitch user ID
    username: string;           // Twitch username
    displayName: string;        // Twitch display name
    connectedAt: number;
  };
  
  // Future: Discord account
  discordAccount?: {
    userId: string;             // Discord user ID
    username: string;           // Discord username
    discriminator: string;
    connectedAt: number;
  };
  
  // Campfire-specific settings
  campfireProfile?: {
    displayName: string;        // Custom display name (defaults to Twitch)
    avatar?: string;
    status?: 'online' | 'away' | 'busy' | 'offline';
    lastSeen?: number;
  };
  
  // Private message preferences
  privacySettings?: {
    allowDMs: boolean;          // Allow receiving DMs
    showOnlineStatus: boolean;  // Show in buddy list
    requireAuthForDMs: boolean; // Only allow from authenticated users
  };
}
```

### Private Message Thread

```typescript
interface PMThread {
  threadId: string;             // UUID v4
  participants: string[];       // Array of campfireIds
  
  // Message history
  messages: PMMessage[];
  
  // Thread metadata
  createdAt: number;
  lastMessageAt: number;
  unreadCount: Record<string, number>; // campfireId → unread count
  
  // Platform sync status
  platformSync?: {
    twitch?: {
      synced: boolean;
      lastSyncAt?: number;
    };
  };
}
```

### Private Message

```typescript
interface PMMessage {
  messageId: string;            // UUID v4
  threadId: string;
  senderId: string;            // campfireId
  
  content: string;
  timestamp: number;
  
  // Delivery status
  status: 'sent' | 'delivered' | 'read';
  
  // Platform origin (for future multi-platform)
  platform?: 'twitch' | 'discord' | 'campfire';
  
  // Reference to original platform message (for whispers)
  platformMessageId?: string;
}
```

---

## Implementation Phases

### Phase 1: User Identity Foundation

**File: `desktop-app/src/main/state/CampfireUser.js`**

```javascript
/**
 * Campfire User Identity Manager
 * 
 * Single source of truth for Campfire user identities.
 * Manages user registration, platform linking, and identity resolution.
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class CampfireUser extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.usersPath = path.join(this.dataPath, 'campfire-users.json');
    
    // In-memory user registry: campfireId → user data
    this.users = new Map();
    
    // Index for fast lookups
    this.twitchIndex = new Map();  // twitchUserId → campfireId
    this.usernameIndex = new Map(); // username → campfireId (case-insensitive)
    
    this._ensureDataDirectory();
    this._loadFromDisk();
  }
  
  // ============================================
  // USER REGISTRATION
  // ============================================
  
  /**
   * Register a new Campfire user from a Twitch account
   * @param {Object} twitchData - Twitch account data
   * @returns {Object} The created user
   */
  registerFromTwitch(twitchData) {
    const { userId, username, displayName } = twitchData;
    
    // Check if already registered
    const existing = this.getByTwitchId(userId);
    if (existing) {
      console.log(`[CampfireUser] User already registered: ${username}`);
      return existing;
    }
    
    // Create new user
    const campfireId = uuidv4();
    const now = Date.now();
    
    const user = {
      campfireId,
      createdAt: now,
      updatedAt: now,
      twitchAccount: {
        userId,
        username: username.toLowerCase(),
        displayName,
        connectedAt: now
      },
      campfireProfile: {
        displayName: displayName,
        status: 'online',
        lastSeen: now
      },
      privacySettings: {
        allowDMs: true,
        showOnlineStatus: true,
        requireAuthForDMs: false
      }
    };
    
    // Store user
    this.users.set(campfireId, user);
    this.twitchIndex.set(userId, campfireId);
    this.usernameIndex.set(username.toLowerCase(), campfireId);
    
    // Persist
    this._saveToDisk();
    
    // Emit event
    this.emit('user:registered', { user });
    
    console.log(`[CampfireUser] New user registered: ${username} → ${campfireId}`);
    return user;
  }
  
  /**
   * Get user by Campfire ID
   * @param {string} campfireId 
   * @returns {Object|null}
   */
  getByCampfireId(campfireId) {
    return this.users.get(campfireId) || null;
  }
  
  /**
   * Get user by Twitch ID
   * @param {string} twitchUserId 
   * @returns {Object|null}
   */
  getByTwitchId(twitchUserId) {
    const campfireId = this.twitchIndex.get(twitchUserId);
    if (!campfireId) return null;
    return this.getByCampfireId(campfireId);
  }
  
  /**
   * Get user by Twitch username
   * @param {string} username 
   * @returns {Object|null}
   */
  getByUsername(username) {
    const campfireId = this.usernameIndex.get(username.toLowerCase());
    if (!campfireId) return null;
    return this.getByCampfireId(campfireId);
  }
  
  /**
   * Resolve any identifier to a user
   * @param {string} identifier - campfireId, twitchUserId, or username
   * @returns {Object|null}
   */
  resolveIdentifier(identifier) {
    // Try as campfireId first
    let user = this.getByCampfireId(identifier);
    if (user) return user;
    
    // Try as Twitch ID (numeric)
    if (/^\d+$/.test(identifier)) {
      user = this.getByTwitchId(identifier);
      if (user) return user;
    }
    
    // Try as username
    user = this.getByUsername(identifier);
    if (user) return user;
    
    return null;
  }
  
  /**
   * Get all registered users
   * @returns {Array}
   */
  getAllUsers() {
    return Array.from(this.users.values());
  }
  
  /**
   * Get online users
   * @returns {Array}
   */
  getOnlineUsers() {
    return this.getAllUsers().filter(user => 
      user.campfireProfile?.status === 'online'
    );
  }
  
  // ============================================
  // PLATFORM LINKING (Future)
  // ============================================
  
  /**
   * Link a Discord account to an existing user
   * @param {string} campfireId 
   * @param {Object} discordData 
   */
  linkDiscordAccount(campfireId, discordData) {
    const user = this.getByCampfireId(campfireId);
    if (!user) {
      throw new Error(`User not found: ${campfireId}`);
    }
    
    user.discordAccount = {
      userId: discordData.userId,
      username: discordData.username,
      discriminator: discordData.discriminator,
      connectedAt: Date.now()
    };
    user.updatedAt = Date.now();
    
    this._saveToDisk();
    this.emit('user:discordLinked', { user });
  }
  
  // ============================================
  // PRESENCE MANAGEMENT
  // ============================================
  
  /**
   * Update user presence status
   * @param {string} campfireId 
   * @param {string} status 
   */
  updatePresence(campfireId, status) {
    const user = this.getByCampfireId(campfireId);
    if (!user) return;
    
    user.campfireProfile.status = status;
    user.campfireProfile.lastSeen = Date.now();
    user.updatedAt = Date.now();
    
    this._saveToDisk();
    this.emit('user:presenceChanged', { user, status });
  }
  
  /**
   * Mark user as offline
   * @param {string} campfireId 
   */
  setOffline(campfireId) {
    this.updatePresence(campfireId, 'offline');
  }
  
  // ============================================
  // PERSISTENCE
  // ============================================
  
  _ensureDataDirectory() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }
  
  _loadFromDisk() {
    if (!fs.existsSync(this.usersPath)) {
      console.log('[CampfireUser] No existing user database found');
      return;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(this.usersPath, 'utf8'));
      
      // Rebuild in-memory structures
      for (const user of data.users) {
        this.users.set(user.campfireId, user);
        
        if (user.twitchAccount) {
          this.twitchIndex.set(user.twitchAccount.userId, user.campfireId);
          this.usernameIndex.set(user.twitchAccount.username, user.campfireId);
        }
      }
      
      console.log(`[CampfireUser] Loaded ${this.users.size} users`);
    } catch (error) {
      console.error('[CampfireUser] Failed to load users:', error);
    }
  }
  
  _saveToDisk() {
    const data = {
      version: '1.0',
      savedAt: Date.now(),
      users: Array.from(this.users.values())
    };
    
    fs.writeFileSync(this.usersPath, JSON.stringify(data, null, 2), 'utf8');
  }
}

module.exports = CampfireUser;
```

---

### Phase 2: Private Message Manager

**File: `desktop-app/src/main/state/PrivateMessageManager.js`**

```javascript
/**
 * Private Message Manager
 * 
 * Manages private message threads between Campfire users.
 * Integrates with Twitch IRC for whisper send/receive.
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

class PrivateMessageManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data');
    this.threadsPath = path.join(this.dataPath, 'pm-threads.json');
    
    // In-memory thread registry
    this.threads = new Map(); // threadId → PMThread
    
    // Index for fast lookups
    this.participantIndex = new Map(); // campfireId → Set<threadId>
    
    this._ensureDataDirectory();
    this._loadFromDisk();
  }
  
  // ============================================
  // THREAD MANAGEMENT
  // ============================================
  
  /**
   * Get or create a thread between two users
   * @param {string} campfireId1 
   * @param {string} campfireId2 
   * @returns {Object} PMThread
   */
  getOrCreateThread(campfireId1, campfireId2) {
    // Check for existing thread
    const existing = this._findThreadBetween(campfireId1, campfireId2);
    if (existing) {
      return existing;
    }
    
    // Create new thread
    const threadId = uuidv4();
    const now = Date.now();
    
    const thread = {
      threadId,
      participants: [campfireId1, campfireId2],
      messages: [],
      createdAt: now,
      lastMessageAt: now,
      unreadCount: {
        [campfireId1]: 0,
        [campfireId2]: 0
      }
    };
    
    this.threads.set(threadId, thread);
    this._addToParticipantIndex(threadId, campfireId1);
    this._addToParticipantIndex(threadId, campfireId2);
    
    this._saveToDisk();
    this.emit('thread:created', { thread });
    
    return thread;
  }
  
  /**
   * Find existing thread between two users
   * @private
   */
  _findThreadBetween(campfireId1, campfireId2) {
    const threads1 = this.participantIndex.get(campfireId1) || new Set();
    
    for (const threadId of threads1) {
      const thread = this.threads.get(threadId);
      if (thread && thread.participants.includes(campfireId2)) {
        return thread;
      }
    }
    
    return null;
  }
  
  _addToParticipantIndex(threadId, campfireId) {
    if (!this.participantIndex.has(campfireId)) {
      this.participantIndex.set(campfireId, new Set());
    }
    this.participantIndex.get(campfireId).add(threadId);
  }
  
  // ============================================
  // MESSAGE OPERATIONS
  // ============================================
  
  /**
   * Add a message to a thread
   * @param {string} threadId 
   * @param {Object} messageData 
   * @returns {Object} The created message
   */
  addMessage(threadId, messageData) {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    
    const messageId = uuidv4();
    const message = {
      messageId,
      threadId,
      senderId: messageData.senderId,
      content: messageData.content,
      timestamp: Date.now(),
      status: 'sent',
      platform: messageData.platform || 'campfire',
      platformMessageId: messageData.platformMessageId
    };
    
    thread.messages.push(message);
    thread.lastMessageAt = message.timestamp;
    
    // Increment unread for recipient
    const recipientId = thread.participants.find(p => p !== messageData.senderId);
    if (recipientId) {
      thread.unreadCount[recipientId] = (thread.unreadCount[recipientId] || 0) + 1;
    }
    
    this._saveToDisk();
    this.emit('message:received', { thread, message });
    
    return message;
  }
  
  /**
   * Get messages for a thread
   * @param {string} threadId 
   * @param {Object} options 
   * @returns {Array}
   */
  getMessages(threadId, options = {}) {
    const thread = this.threads.get(threadId);
    if (!thread) return [];
    
    let messages = thread.messages;
    
    // Apply pagination
    if (options.limit) {
      const start = options.offset || 0;
      messages = messages.slice(start, start + options.limit);
    }
    
    // Reverse for chronological order (oldest first)
    if (options.reverse !== false) {
      messages = [...messages].reverse();
    }
    
    return messages;
  }
  
  /**
   * Get threads for a user
   * @param {string} campfireId 
   * @returns {Array}
   */
  getThreadsForUser(campfireId) {
    const threadIds = this.participantIndex.get(campfireId) || new Set();
    
    const threads = [];
    for (const threadId of threadIds) {
      const thread = this.threads.get(threadId);
      if (thread) {
        threads.push({
          threadId: thread.threadId,
          participants: thread.participants,
          lastMessageAt: thread.lastMessageAt,
          unreadCount: thread.unreadCount[campfireId] || 0,
          preview: thread.messages[thread.messages.length - 1]?.content || ''
        });
      }
    }
    
    // Sort by last message time
    threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    
    return threads;
  }
  
  /**
   * Mark messages as read
   * @param {string} threadId 
   * @param {string} campfireId 
   */
  markAsRead(threadId, campfireId) {
    const thread = this.threads.get(threadId);
    if (!thread) return;
    
    thread.unreadCount[campfireId] = 0;
    
    // Update message statuses
    for (const message of thread.messages) {
      if (message.senderId !== campfireId && message.status !== 'read') {
        message.status = 'read';
      }
    }
    
    this._saveToDisk();
    this.emit('thread:read', { threadId, campfireId });
  }
  
  /**
   * Get unread count for a user
   * @param {string} campfireId 
   * @returns {number}
   */
  getUnreadCount(campfireId) {
    const threadIds = this.participantIndex.get(campfireId) || new Set();
    let count = 0;
    
    for (const threadId of threadIds) {
      const thread = this.threads.get(threadId);
      if (thread) {
        count += thread.unreadCount[campfireId] || 0;
      }
    }
    
    return count;
  }
  
  // ============================================
  // PERSISTENCE
  // ============================================
  
  _ensureDataDirectory() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }
  
  _loadFromDisk() {
    if (!fs.existsSync(this.threadsPath)) {
      console.log('[PMManager] No existing threads found');
      return;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(this.threadsPath, 'utf8'));
      
      for (const thread of data.threads) {
        this.threads.set(thread.threadId, thread);
        
        for (const participantId of thread.participants) {
          this._addToParticipantIndex(thread.threadId, participantId);
        }
      }
      
      console.log(`[PMManager] Loaded ${this.threads.size} threads`);
    } catch (error) {
      console.error('[PMManager] Failed to load threads:', error);
    }
  }
  
  _saveToDisk() {
    const data = {
      version: '1.0',
      savedAt: Date.now(),
      threads: Array.from(this.threads.values())
    };
    
    fs.writeFileSync(this.threadsPath, JSON.stringify(data, null, 2), 'utf8');
  }
}

module.exports = PrivateMessageManager;
```

---

### Phase 3: Twitch Whisper Integration

**File: `desktop-app/src/main/integration/WhisperService.js`**

```javascript
/**
 * Twitch Whisper Integration Service
 * 
 * Handles sending and receiving Twitch whispers via tmi.js.
 * Integrates with PrivateMessageManager for unified messaging.
 */

const EventEmitter = require('events');

class WhisperService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.twitchClient = options.twitchClient || null;
    this.pmManager = options.pmManager || null;
    this.userManager = options.userManager || null;
    
    this.isConnected = false;
  }
  
  /**
   * Set the Twitch IRC client
   * @param {Object} client - tmi.js client
   */
  setTwitchClient(client) {
    this.twitchClient = client;
    this._setupEventHandlers();
  }
  
  /**
   * Setup whisper event handlers
   * @private
   */
  _setupEventHandlers() {
    if (!this.twitchClient) return;
    
    this.twitchClient.on('whisper', (from, userstate, message, self) => {
      if (self) return; // Ignore self-sent whispers
      
      this._handleIncomingWhisper(from, userstate, message);
    });
    
    this.isConnected = true;
    console.log('[WhisperService] Connected to Twitch whispers');
  }
  
  /**
   * Handle incoming whisper
   * @private
   */
  _handleIncomingWhisper(from, userstate, message) {
    const twitchUserId = userstate['user-id'];
    const twitchUsername = from;
    
    console.log(`[WhisperService] Received whisper from ${twitchUsername}: ${message}`);
    
    // Find or create Campfire user
    let user = this.userManager?.getByTwitchId(twitchUserId);
    if (!user) {
      // Auto-register user from whisper
      user = this.userManager?.registerFromTwitch({
        userId: twitchUserId,
        username: twitchUsername,
        displayName: userstate['display-name'] || twitchUsername
      });
    }
    
    if (!user) {
      console.warn(`[WhisperService] Could not resolve user: ${twitchUsername}`);
      return;
    }
    
    // Create or get thread
    const thread = this.pmManager?.getOrCreateThread(
      user.campfireId,
      this.currentUserId // Recipient (the streamer/bot)
    );
    
    if (!thread) {
      console.error('[WhisperService] No PM manager available');
      return;
    }
    
    // Add message to thread
    const pmMessage = this.pmManager.addMessage(thread.threadId, {
      senderId: user.campfireId,
      content: message,
      platform: 'twitch',
      platformMessageId: userstate['message-id']
    });
    
    // Emit event for UI
    this.emit('whisper:received', {
      user,
      message: pmMessage,
      thread
    });
  }
  
  /**
   * Send a whisper to a user
   * @param {string} fromCampfireId - Sender's campfire ID
   * @param {string} toCampfireId - Recipient's campfire ID
   * @param {string} content - Message content
   * @returns {Promise<Object>}
   */
  async sendWhisper(fromCampfireId, toCampfireId, content) {
    const fromUser = this.userManager?.getByCampfireId(fromCampfireId);
    const toUser = this.userManager?.getByCampfireId(toCampfireId);
    
    if (!fromUser || !toUser) {
      throw new Error('Invalid user IDs');
    }
    
    if (!toUser.twitchAccount) {
      throw new Error('Recipient has no Twitch account linked');
    }
    
    // Create thread if needed
    const thread = this.pmManager?.getOrCreateThread(fromCampfireId, toCampfireId);
    
    // Add message locally first
    const message = this.pmManager.addMessage(thread.threadId, {
      senderId: fromCampfireId,
      content,
      platform: 'twitch'
    });
    
    // Send via Twitch IRC
    if (this.twitchClient && this.isConnected) {
      try {
        const targetUsername = toUser.twitchAccount.username;
        await this.twitchClient.whisper(targetUsername, content);
        
        // Update message status
        message.status = 'delivered';
        this.pmManager._saveToDisk();
        
        console.log(`[WhisperService] Sent whisper to ${targetUsername}`);
        
        return { success: true, message };
      } catch (error) {
        console.error('[WhisperService] Failed to send whisper:', error);
        message.status = 'failed';
        return { success: false, message, error };
      }
    } else {
      console.warn('[WhisperService] Not connected to Twitch');
      return { success: false, message, error: 'Not connected to Twitch' };
    }
  }
  
  /**
   * Disconnect from whispers
   */
  disconnect() {
    this.isConnected = false;
  }
}

module.exports = WhisperService;
```

---

### Phase 4: IPC Handlers

**File: `desktop-app/src/main/ipc/PrivateMessageIPCHandlers.js`**

```javascript
/**
 * Private Message IPC Handlers
 * 
 * IPC handlers for private message operations.
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Register PM IPC handlers
 * @param {Object} ipcMain - Electron IPC main
 * @param {Object} pmManager - PrivateMessageManager instance
 * @param {Object} whisperService - WhisperService instance
 * @param {Object} userManager - CampfireUser instance
 */
function registerPMIPCHandlers(ipcMain, pmManager, whisperService, userManager) {
  
  // Get threads for user
  ipcMain.handle('pm:getThreads', async (event, campfireId) => {
    return pmManager.getThreadsForUser(campfireId);
  });
  
  // Get messages in a thread
  ipcMain.handle('pm:getMessages', async (event, threadId, options = {}) => {
    return pmManager.getMessages(threadId, options);
  });
  
  // Send a private message
  ipcMain.handle('pm:sendMessage', async (event, fromId, toId, content) => {
    return whisperService.sendWhisper(fromId, toId, content);
  });
  
  // Mark thread as read
  ipcMain.handle('pm:markRead', async (event, threadId, campfireId) => {
    pmManager.markAsRead(threadId, campfireId);
    return { success: true };
  });
  
  // Get unread count
  ipcMain.handle('pm:getUnreadCount', async (event, campfireId) => {
    return pmManager.getUnreadCount(campfireId);
  });
  
  // Get user by campfire ID
  ipcMain.handle('user:getById', async (event, campfireId) => {
    return userManager.getByCampfireId(campfireId);
  });
  
  // Get user by Twitch ID
  ipcMain.handle('user:getByTwitchId', async (event, twitchUserId) => {
    return userManager.getByTwitchId(twitchUserId);
  });
  
  // Get all users
  ipcMain.handle('user:getAll', async () => {
    return userManager.getAllUsers();
  });
  
  // Search users
  ipcMain.handle('user:search', async (event, query) => {
    const users = userManager.getAllUsers();
    const lowerQuery = query.toLowerCase();
    
    return users.filter(user => {
      const twitchName = user.twitchAccount?.username || '';
      const displayName = user.campfireProfile?.displayName || '';
      
      return twitchName.includes(lowerQuery) || 
             displayName.toLowerCase().includes(lowerQuery);
    });
  });
  
  // Listen for new messages (renderer should use onPMMessage event)
  ipcMain.handle('pm:onMessage', async (event, callback) => {
    const messageHandler = (data) => {
      event.sender.send('pm:messageReceived', data);
    };
    pmManager.on('message:received', messageHandler);
    
    // Return cleanup function
    return () => pmManager.off('message:received', messageHandler);
  });
  
  // Listen for thread updates
  ipcMain.handle('pm:onThreadUpdate', async (event) => {
    const threadHandler = (data) => {
      event.sender.send('pm:threadUpdated', data);
    };
    pmManager.on('thread:created', threadHandler);
    
    return () => pmManager.off('thread:created', threadHandler);
  });
}

module.exports = { registerPMIPCHandlers };
```

---

## UI Changes

### Buddy List - PM Button

Add a "Message" button to each buddy item that opens a PM thread:

```javascript
// In createUserElement of buddy-list.html

function createUserElement(user) {
  const li = document.createElement('li');
  // ... existing code ...
  
  // Add message button
  const messageBtn = document.createElement('button');
  messageBtn.className = 'pm-button';
  messageBtn.textContent = '💬';
  messageBtn.title = 'Send private message';
  messageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openPrivateMessageThread(user);
  });
  li.appendChild(messageBtn);
  
  return li;
}

function openPrivateMessageThread(user) {
  // Request PM thread from main process
  window.electronAPI.getOrCreateThread(user.userId).then(thread => {
    // Open PM window or panel
    openPMWindow(thread);
  });
}
```

### New PM Window

Create `desktop-app/server/pm-window.html`:
- Thread message list
- Message input
- User presence indicator
- Send/receive status

---

## Future Considerations

### Discord Integration

When adding Discord support:

1. **User Linking** - Add `linkDiscordAccount()` method
2. **Discord DMs** - Create `DiscordDMService` similar to `WhisperService`
3. **Unified Thread** - Add `platform: 'discord'` to messages
4. **Cross-Platform Send** - Send to both platforms if both users connected

### Message Sync

For future server-based sync:

```javascript
// Cloud sync example (future)
async function syncMessages(threadId) {
  const messages = pmManager.getMessages(threadId);
  const response = await fetch('https://api.campfire.app/sync/messages', {
    method: 'POST',
    body: JSON.stringify({ threadId, messages })
  });
  return response.json();
}
```

---

## Summary

This plan implements:

1. ✅ **CampfireUser** - Persistent user identity system
2. ✅ **PrivateMessageManager** - Thread and message management
3. ✅ **WhisperService** - Twitch IRC integration
4. ✅ **IPC Handlers** - Renderer communication
5. ✅ **UI Updates** - PM functionality in buddy list

**Complexity**: Medium-High (requires careful state management)
**Risk**: Low (no breaking changes, backward compatible)
**Dependencies**: None (pure Node.js + existing tmi.js)
