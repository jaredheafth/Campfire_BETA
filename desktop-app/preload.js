const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    openDashboard: (tab) => ipcRenderer.invoke('open-dashboard', tab),
    openMembersWindow: () => ipcRenderer.invoke('open-members-window'),
    openChatPopout: () => ipcRenderer.invoke('open-chat-popout'),
    bringChatPopoutToFront: () => ipcRenderer.invoke('bring-chat-popout-to-front'),
    bringWidgetToFront: () => ipcRenderer.invoke('bring-widget-to-front'),
    openSettingsModal: () => ipcRenderer.invoke('open-settings-modal'),
    openMemberDashboard: (userId, username, mode = 'streamer') => ipcRenderer.invoke('open-member-dashboard', userId, username, mode),
    joinAllTestUsers: () => ipcRenderer.invoke('join-all-test-users'),
    kickAllTestUsers: () => ipcRenderer.invoke('kick-all-test-users'),
    getWindowDimensions: () => ipcRenderer.invoke('get-window-dimensions'),
    setWindowDimensions: (dimensions) => ipcRenderer.invoke('set-window-dimensions', dimensions),
    toggleWindowLock: () => ipcRenderer.invoke('toggle-window-lock'),
    
    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    updateAudioSettings: (audioSettings) => ipcRenderer.invoke('update-audio-settings', audioSettings),
    onSettingsUpdate: (callback) => ipcRenderer.on('settingsUpdate', (event, data) => callback(data)),
    
    // Twitch
    getTwitchConfig: () => ipcRenderer.invoke('get-twitch-config'),
    saveTwitchConfig: (config) => ipcRenderer.invoke('save-twitch-config', config),
    getTwitchStatus: () => ipcRenderer.invoke('get-twitch-status'),
    generateTwitchToken: (accountType) => ipcRenderer.invoke('generate-twitch-token', accountType),
    sendChatMessage: (message, speaker) => ipcRenderer.invoke('send-chat-message', message, speaker),
    disconnectTwitch: () => ipcRenderer.invoke('disconnect-twitch'),
    onTwitchConnected: (callback) => ipcRenderer.on('twitchConnected', (event, data) => callback(data)),
    onTwitchDisconnected: (callback) => ipcRenderer.on('twitchDisconnected', (event, data) => callback(data)),
    onTwitchChatBotConnected: (callback) => ipcRenderer.on('twitchChatBotConnected', (event, data) => callback(data)),
    onTwitchChatBotDisconnected: (callback) => ipcRenderer.on('twitchChatBotDisconnected', (event, data) => callback(data)),
    onTwitchError: (callback) => ipcRenderer.on('twitchError', (event, data) => callback(data)),
    onTwitchChatMessage: (callback) => ipcRenderer.on('twitchChatMessage', (event, data) => callback(data)),
    onThirdPartyEmotesUpdate: (callback) => ipcRenderer.on('thirdPartyEmotesUpdate', (event, data) => callback(data)),
    getThirdPartyEmotes: () => ipcRenderer.invoke('get-third-party-emotes'),
    kickAllUsers: () => ipcRenderer.invoke('kick-all-users'),
    joinAllUsers: (opts) => ipcRenderer.invoke('join-all-users', opts),
    
    // Users/Members
    getActiveUsers: () => ipcRenderer.invoke('get-active-users'),
    getWidgetUsers: () => ipcRenderer.invoke('get-widget-users'),
    getPotentialMembers: () => ipcRenderer.invoke('get-potential-members'),
    getWidgetDisplayUsers: () => ipcRenderer.invoke('get-widget-display-users'),
    refreshChatters: () => ipcRenderer.invoke('refresh-chatters'),
    addToChatters: (username, userData) => ipcRenderer.invoke('add-to-chatters', username, userData),
    getViewerPrefs: (userId) => ipcRenderer.invoke('get-viewer-prefs', userId),
    kickMember: (userId) => ipcRenderer.invoke('kick-member', userId),
    joinMember: (userId, username, options) => ipcRenderer.invoke('join-member', userId, username, options),
    simulateJoinCommand: (username, userId) => ipcRenderer.invoke('simulate-join-command', username, userId),
    addTestUserToWidget: (userId, username) => ipcRenderer.invoke('add-test-user-to-widget', userId, username),
    removeTestUserFromWidget: (userId, username) => ipcRenderer.invoke('remove-test-user-from-widget', userId, username),
    onPotentialMembersUpdate: (callback) => ipcRenderer.on('potentialMembersUpdate', (event, data) => callback(data)),
    onRefreshMembers: (callback) => ipcRenderer.on('refresh-members', () => callback()),
    onSyncFullState: (callback) => ipcRenderer.on('sync-full-state', (event, data) => callback(data)),
    
    // Events (for widget)
    getEvents: (sinceId) => ipcRenderer.invoke('get-events', sinceId),
    onUserJoin: (callback) => ipcRenderer.on('userJoin', (event, data) => callback(data)),
    onUserLeave: (callback) => ipcRenderer.on('userLeave', (event, data) => callback(data)),
    onUserAfk: (callback) => ipcRenderer.on('userAfk', (event, data) => callback(data)),
    onUserLurk: (callback) => ipcRenderer.on('userLurk', (event, data) => callback(data)),
    onUserReturnFromLurk: (callback) => ipcRenderer.on('userReturnFromLurk', (event, data) => callback(data)),
    onUserUpdate: (callback) => ipcRenderer.on('userUpdate', (event, data) => callback(data)),
    onUserIdMigrated: (callback) => ipcRenderer.on('userIdMigrated', (event, data) => callback(data)),
    onChatMessage: (callback) => ipcRenderer.on('chatMessage', (event, data) => callback(data)),
    onUserActivity: (callback) => ipcRenderer.on('userActivity', (event, data) => callback(data)),
    onViewerMovement: (callback) => ipcRenderer.on('viewerMovement', (event, data) => callback(data)),
    onViewerSpriteChange: (callback) => ipcRenderer.on('viewerSpriteChange', (event, data) => callback(data)),
    onViewerColorChange: (callback) => ipcRenderer.on('viewerColorChange', (event, data) => callback(data)),
    onViewerTwitchColorUpdate: (callback) => ipcRenderer.on('viewerTwitchColorUpdate', (event, data) => callback(data)),
    saveViewerPrefs: (opts) => ipcRenderer.invoke('save-viewer-prefs', opts),
    
    // Sprite path management
    getSpritePath: () => ipcRenderer.invoke('get-sprite-path'),
    setSpritePath: () => ipcRenderer.invoke('set-sprite-path'),
    resetSpritePath: () => ipcRenderer.invoke('reset-sprite-path'),
    onSpritePathChanged: (callback) => ipcRenderer.on('sprite-path-changed', (event, data) => callback(data)),
    
    // Audio file storage (file-based for large files)
    saveAudioFile: (audioType, fileName, fileData) => ipcRenderer.invoke('save-audio-file', { audioType, fileName, fileData }),
    loadAudioFile: (audioType) => ipcRenderer.invoke('load-audio-file', audioType),
    deleteAudioFile: (audioType) => ipcRenderer.invoke('delete-audio-file', audioType),
    
    // Audio playback control (plays in widget window for persistence)
    controlAudio: (action, audioType, volume) => ipcRenderer.invoke('control-audio', { action, audioType, volume }),
    getAudioStatus: () => ipcRenderer.invoke('get-audio-status'),
    onAudioControl: (callback) => ipcRenderer.on('audioControl', (event, data) => callback(data)),
    onGetAudioStatus: (callback) => ipcRenderer.on('getAudioStatus', () => callback()),
    sendAudioStatusResponse: (status) => ipcRenderer.send('audio-status-response', status),
    
    // Auto-updater
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onUpdateStatus: (callback) => ipcRenderer.on('update-status', (event, data) => callback(data)),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, data) => callback(data)),
    
    // Shutdown
    shutdownApp: () => ipcRenderer.invoke('shutdown-app'),
    
    // Dashboard tab switching
    switchTab: (tab) => ipcRenderer.send('switch-tab', tab),
    onSwitchTab: (callback) => ipcRenderer.on('switch-tab', (event, tab) => callback(tab)),
    onOpenSettingsModal: (callback) => ipcRenderer.on('open-settings-modal', () => callback()),

    // Bot messages - Now uses main process as single source of truth
    getBotMessages: () => ipcRenderer.invoke('get-bot-messages'),
    saveBotMessages: (messages) => ipcRenderer.invoke('save-bot-messages', messages),
    initializeBotMessages: (messages) => ipcRenderer.send('initialize-bot-messages', messages),
    onBotMessagesUpdate: (callback) => ipcRenderer.on('bot-messages-update', (event, data) => callback(data))
});
