/**
 * Campfire Widget - Bot Message Helper
 * 
 * Centralized helper for sending bot messages to multiple destinations.
 * Reduces code duplication across command handlers.
 */

/**
 * BotMessageHelper - Handles sending bot messages to all configured destinations
 */
class BotMessageHelper {
  /**
   * Create a new BotMessageHelper instance
   * @param {Object} options - Configuration options
   * @param {Function} options.sayInChannel - Function to send message to Twitch chat
   * @param {Function} options.sendToPopoutChat - Function to send message to popout chat
   * @param {Function} options.getDashboardWindow - Function to get dashboard window reference
   * @param {Function} options.getBotMessagesCache - Function to get bot messages cache
   */
  constructor(options = {}) {
    this.sayInChannel = options.sayInChannel || null;
    this.sendToPopoutChat = options.sendToPopoutChat || null;
    this.getDashboardWindow = options.getDashboardWindow || null;
    this.getBotMessagesCache = options.getBotMessagesCache || null;
  }
  
  /**
   * Get a bot message configuration by ID
   * @param {string} messageId - Message ID (e.g., 'join', 'leave', 'afk', 'lurk', 'return')
   * @returns {Object|null} Bot message config or null if not found/disabled
   */
  getBotMessage(messageId) {
    if (!this.getBotMessagesCache) return null;
    
    const cache = this.getBotMessagesCache();
    if (!Array.isArray(cache)) return null;
    
    return cache.find(msg => msg.id === messageId) || null;
  }
  
  /**
   * Get an enabled bot message configuration by ID
   * @param {string} messageId - Message ID
   * @returns {Object|null} Bot message config or null if not found/disabled
   */
  getEnabledBotMessage(messageId) {
    const msg = this.getBotMessage(messageId);
    return (msg && msg.enabled) ? msg : null;
  }
  
  /**
   * Send a bot message to all configured destinations
   * @param {string} messageId - Message ID (e.g., 'join', 'leave', 'afk', 'lurk', 'return')
   * @param {Object} replacements - Key-value pairs for message template replacements
   * @param {Object} options - Additional options
   * @param {string} options.commandCategory - Category for the command (default: 'STATE')
   * @returns {Promise<boolean>} True if message was sent to at least one destination
   */
  async sendBotMessage(messageId, replacements = {}, options = {}) {
    const botMsg = this.getEnabledBotMessage(messageId);
    if (!botMsg || !botMsg.message) {
      return false;
    }
    
    // Apply replacements to message template
    let message = botMsg.message;
    for (const [key, value] of Object.entries(replacements)) {
      message = message.replace(`{${key}}`, value);
    }
    
    const commandCategory = options.commandCategory || 'STATE';
    let sentToAny = false;
    
    // 1. Send to Twitch chat (unless silent)
    if (!botMsg.silent && this.sayInChannel) {
      try {
        await this.sayInChannel(message, 'bot', true);
        sentToAny = true;
      } catch (error) {
        console.error(`[BotMessageHelper] Error sending to Twitch chat:`, error);
      }
    }
    
    // 2. Send to Popout Chat (if respondAllChats is enabled)
    if (botMsg.respondAllChats && this.sendToPopoutChat) {
      try {
        this.sendToPopoutChat({
          username: '',
          message: message,
          userId: null,
          emotes: null,
          allowBubble: false,
          isAction: true,
          displayName: '',
          color: null,
          commandCategory: commandCategory
        });
        sentToAny = true;
      } catch (error) {
        console.error(`[BotMessageHelper] Error sending to popout chat:`, error);
      }
    }
    
    // 3. Always send to dashboard Internal Chat
    if (this.getDashboardWindow) {
      try {
        const dashboardWindow = this.getDashboardWindow();
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
          dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: message,
            userId: null,
            isAction: true,
            commandCategory: commandCategory,
            isBotResponse: true
          });
          sentToAny = true;
        }
      } catch (error) {
        console.error(`[BotMessageHelper] Error sending to dashboard:`, error);
      }
    }
    
    return sentToAny;
  }
  
  /**
   * Check if a command is allowed for non-campers
   * @param {string} messageId - Message ID
   * @returns {boolean}
   */
  allowsNonCampers(messageId) {
    const msg = this.getBotMessage(messageId);
    return msg && msg.allowNonCampers === true;
  }
  
  /**
   * Send a custom message to all destinations (not from bot messages cache)
   * @param {string} message - The message to send
   * @param {Object} options - Options
   * @param {boolean} options.silent - Don't send to Twitch chat
   * @param {boolean} options.popout - Send to popout chat
   * @param {boolean} options.dashboard - Send to dashboard (default: true)
   * @param {string} options.commandCategory - Category for the command
   * @returns {Promise<boolean>}
   */
  async sendCustomMessage(message, options = {}) {
    const {
      silent = false,
      popout = false,
      dashboard = true,
      commandCategory = 'CUSTOM'
    } = options;
    
    let sentToAny = false;
    
    // 1. Send to Twitch chat
    if (!silent && this.sayInChannel) {
      try {
        await this.sayInChannel(message, 'bot', true);
        sentToAny = true;
      } catch (error) {
        console.error(`[BotMessageHelper] Error sending custom to Twitch:`, error);
      }
    }
    
    // 2. Send to Popout Chat
    if (popout && this.sendToPopoutChat) {
      try {
        this.sendToPopoutChat({
          username: '',
          message: message,
          userId: null,
          emotes: null,
          allowBubble: false,
          isAction: true,
          displayName: '',
          color: null,
          commandCategory: commandCategory
        });
        sentToAny = true;
      } catch (error) {
        console.error(`[BotMessageHelper] Error sending custom to popout:`, error);
      }
    }
    
    // 3. Send to dashboard
    if (dashboard && this.getDashboardWindow) {
      try {
        const dashboardWindow = this.getDashboardWindow();
        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
          dashboardWindow.webContents.send('twitchChatMessage', {
            username: '',
            message: message,
            userId: null,
            isAction: true,
            commandCategory: commandCategory,
            isBotResponse: true
          });
          sentToAny = true;
        }
      } catch (error) {
        console.error(`[BotMessageHelper] Error sending custom to dashboard:`, error);
      }
    }
    
    return sentToAny;
  }
}

module.exports = BotMessageHelper;
