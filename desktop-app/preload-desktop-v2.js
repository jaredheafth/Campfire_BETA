const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Window management
    openDashboard: (tab) => ipcRenderer.invoke('open-dashboard', tab),
    openMemberDashboard: (userId, username) => ipcRenderer.invoke('open-member-dashboard', userId, username),
    getWindowDimensions: () => ipcRenderer.invoke('get-window-dimensions'),
    setWindowDimensions: (dimensions) => ipcRenderer.invoke('set-window-dimensions', dimensions),
    toggleWindowLock: () => ipcRenderer.invoke('toggle-window-lock'),
    
    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    onSettingsUpdate: (callback) => ipcRenderer.on('settingsUpdate', (event, data) => callback(data)),
    
    // Twitch
    getTwitchConfig: () => ipcRenderer.invoke('get-twitch-config'),
    saveTwitchConfig: (config) => ipcRenderer.invoke('save-twitch-config', config),
    getTwitchStatus: () => ipcRenderer.invoke('get-twitch-status'),
    onTwitchConnected: (callback) => ipcRenderer.on('twitchConnected', (event, data) => callback(data)),
    onTwitchDisconnected: (callback) => ipcRenderer.on('twitchDisconnected', (event, data) => callback(data)),
    
    // Users/Members
    getActiveUsers: () => ipcRenderer.invoke('get-active-users'),
    getPotentialMembers: () => ipcRenderer.invoke('get-potential-members'),
    kickMember: (userId) => ipcRenderer.invoke('kick-member', userId),
    joinMember: (userId, username) => ipcRenderer.invoke('join-member', userId, username),
    onPotentialMembersUpdate: (callback) => ipcRenderer.on('potentialMembersUpdate', (event, data) => callback(data)),
    
    // Events (for widget)
    getEvents: (sinceId) => ipcRenderer.invoke('get-events', sinceId),
    onUserJoin: (callback) => ipcRenderer.on('userJoin', (event, data) => callback(data)),
    onUserLeave: (callback) => ipcRenderer.on('userLeave', (event, data) => callback(data)),
    onViewerMovement: (callback) => ipcRenderer.on('viewerMovement', (event, data) => callback(data)),
    onViewerSpriteChange: (callback) => ipcRenderer.on('viewerSpriteChange', (event, data) => callback(data)),
    onViewerColorChange: (callback) => ipcRenderer.on('viewerColorChange', (event, data) => callback(data)),
    
    // Sprite path management
    getSpritePath: () => ipcRenderer.invoke('get-sprite-path'),
    setSpritePath: () => ipcRenderer.invoke('set-sprite-path'),
    resetSpritePath: () => ipcRenderer.invoke('reset-sprite-path'),
    onSpritePathChanged: (callback) => ipcRenderer.on('sprite-path-changed', (event, data) => callback(data)),
    
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
    onSwitchTab: (callback) => ipcRenderer.on('switch-tab', (event, tab) => callback(tab))
});
