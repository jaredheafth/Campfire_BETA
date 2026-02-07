/**
 * Campfire Widget - Hosted API Client
 * 
 * API client for desktop app to connect to hosted backend.
 * Handles authentication, API calls, and WebSocket connections.
 */

const { io } = require('socket.io-client');

class HostedAPI {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:3000';
        this.apiUrl = `${this.baseUrl}/api`;
        this.socketUrl = this.baseUrl;
        
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
        
        this.socket = null;
        this.eventHandlers = new Map();
        
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Load saved tokens
        this.loadTokens();
    }
    
    // ============================================
    // AUTHENTICATION
    // ============================================
    
    /**
     * Login with Twitch OAuth
     */
    async loginWithTwitch() {
        const response = await fetch(`${this.apiUrl}/auth/twitch`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.message);
        }
        
        // Open Twitch OAuth in system browser
        this.openExternalUrl(data.url);
        
        return {
            authUrl: data.url,
            state: data.state
        };
    }
    
    /**
     * Complete Twitch login with code
     */
    async completeTwitchLogin(code, deviceId) {
        const response = await fetch(`${this.apiUrl}/auth/twitch/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code, deviceId })
        });
        
        if (!response.ok) {
            throw new Error('Login failed');
        }
        
        const data = await response.json();
        this.setTokens(data.accessToken, data.refreshToken);
        this.user = {
            id: data.user.id,
            username: data.user.username,
            displayName: data.user.displayName,
            avatarUrl: data.user.avatarUrl
        };
        
        return this.user;
    }
    
    /**
     * Refresh access token
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }
        
        const response = await fetch(`${this.apiUrl}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken: this.refreshToken })
        });
        
        if (!response.ok) {
            this.clearTokens();
            throw new Error('Session expired');
        }
        
        const data = await response.json();
        this.setTokens(data.accessToken, this.refreshToken);
        
        return data.accessToken;
    }
    
    /**
     * Logout
     */
    async logout() {
        try {
            await fetch(`${this.apiUrl}/auth/logout`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ refreshToken: this.refreshToken })
            });
        } catch (error) {
            console.warn('Logout API call failed:', error);
        }
        
        this.clearTokens();
        this.disconnectSocket();
    }
    
    /**
     * Check if logged in
     */
    isLoggedIn() {
        return !!this.accessToken && !!this.user;
    }
    
    /**
     * Get current user
     */
    getUser() {
        return this.user;
    }
    
    // ============================================
    // TOKENS
    // ============================================
    
    setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.saveTokens();
    }
    
    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;
        this.clearSavedTokens();
    }
    
    saveTokens() {
        // In Electron, use safe storage
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('campfire_access_token', this.accessToken || '');
            localStorage.setItem('campfire_refresh_token', this.refreshToken || '');
        }
    }
    
    loadTokens() {
        if (typeof localStorage !== 'undefined') {
            this.accessToken = localStorage.getItem('campfire_access_token') || null;
            this.refreshToken = localStorage.getItem('campfire_refresh_token') || null;
        }
    }
    
    clearSavedTokens() {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('campfire_access_token');
            localStorage.removeItem('campfire_refresh_token');
        }
    }
    
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
        };
    }
    
    // ============================================
    // API CALLS
    // ============================================
    
    async request(endpoint, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        
        const headers = {
            ...options.headers,
            ...this.getAuthHeaders()
        };
        
        // Remove Content-Type for FormData
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            if (response.status === 401 && this.refreshToken) {
                // Try to refresh token
                await this.refreshAccessToken();
                // Retry request
                return this.request(endpoint, options);
            }
            
            if (!response.ok) {
                const error = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(error.message || `HTTP ${response.status}`);
            }
            
            return response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }
    
    // Shortcut methods
    get(endpoint) { return this.request(endpoint, { method: 'GET' }); }
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); }
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
    
    // ============================================
    // USER API
    // ============================================
    
    async getCurrentUser() {
        const user = await this.get('/users/me');
        this.user = user;
        return user;
    }
    
    async updateProfile(updates) {
        return this.put('/users/me', updates);
    }
    
    // ============================================
    // CAMPFIRE API
    // ============================================
    
    async getMyCampfires() {
        const data = await this.get('/campfires');
        return data.campfires;
    }
    
    async createCampfire(data) {
        return this.post('/campfires', data);
    }
    
    async getCampfire(id) {
        return this.get(`/campfires/${id}`);
    }
    
    async updateCampfire(id, data) {
        return this.put(`/campfires/${id}`, data);
    }
    
    async getCampfireMembers(id) {
        const data = await this.get(`/campfires/${id}/members`);
        return data.members;
    }
    
    async joinCampfire(id) {
        return this.post(`/campfires/${id}/join`);
    }
    
    async leaveCampfire(id) {
        return this.post(`/campfires/${id}/leave`);
    }
    
    async discoverCampfires(params = {}) {
        const query = new URLSearchParams(params).toString();
        const data = await this.get(`/campfires/discover?${query}`);
        return data.campfires;
    }
    
    async getFeaturedCampfires() {
        const data = await this.get('/campfires/featured');
        return data.featured;
    }
    
    // ============================================
    // BUDDY API
    // ============================================
    
    async getBuddies() {
        const data = await this.get('/buddies');
        return data.buddies;
    }
    
    async getBuddyRequests() {
        const data = await this.get('/buddies/requests');
        return data.requests;
    }
    
    async sendBuddyRequest(userId, message = '') {
        return this.post('/buddies/request', { userId, message });
    }
    
    async acceptBuddyRequest(userId) {
        return this.post(`/buddies/${userId}/accept`);
    }
    
    async declineBuddyRequest(userId) {
        return this.delete(`/buddies/${userId}/request`);
    }
    
    async removeBuddy(userId) {
        return this.delete(`/buddies/${userId}`);
    }
    
    // ============================================
    // WEBSOCKET
    // ============================================
    
    /**
     * Connect to WebSocket
     */
    connectSocket() {
        if (this.socket?.connected) {
            return this.socket;
        }
        
        if (!this.accessToken) {
            throw new Error('Must be logged in to connect');
        }
        
        this.socket = io(this.socketUrl, {
            auth: { token: this.accessToken },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: this.maxReconnectAttempts,
            reconnectionDelay: 1000
        });
        
        this.socket.on('connect', () => {
            console.log('[HostedAPI] WebSocket connected');
            this.reconnectAttempts = 0;
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('[HostedAPI] WebSocket disconnected:', reason);
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('[HostedAPI] WebSocket connection error:', error);
            this.reconnectAttempts++;
        });
        
        return this.socket;
    }
    
    /**
     * Disconnect WebSocket
     */
    disconnectSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
    
    /**
     * Join a campfire room
     */
    joinCampfireRoom(campfireId) {
        if (!this.socket?.connected) {
            throw new Error('WebSocket not connected');
        }
        
        return new Promise((resolve, reject) => {
            this.socket.emit('joinCampfire', { campfireId }, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    /**
     * Leave a campfire room
     */
    leaveCampfireRoom(campfireId) {
        if (!this.socket?.connected) return;
        
        this.socket.emit('leaveCampfire', { campfireId });
    }
    
    /**
     * Send chat message
     */
    sendChatMessage(campfireId, content, metadata = {}) {
        if (!this.socket?.connected) {
            throw new Error('WebSocket not connected');
        }
        
        return new Promise((resolve, reject) => {
            this.socket.emit('chatMessage', { campfireId, content, metadata }, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    /**
     * Update sprite
     */
    updateSprite(campfireId, spriteId, color) {
        if (!this.socket?.connected) return;
        
        this.socket.emit('updateSprite', { campfireId, spriteId, color });
    }
    
    /**
     * Start movement
     */
    startMovement(campfireId, direction, speed = 15) {
        if (!this.socket?.connected) return;
        
        this.socket.emit('startMovement', { campfireId, direction, speed });
    }
    
    /**
     * Stop movement
     */
    stopMovement(campfireId) {
        if (!this.socket?.connected) return;
        
        this.socket.emit('stopMovement', { campfireId });
    }
    
    /**
     * Subscribe to buddy updates
     */
    subscribeToBuddies() {
        if (!this.socket?.connected) return;
        
        this.socket.emit('subscribeToBuddies');
    }
    
    /**
     * Subscribe to notifications
     */
    subscribeToNotifications() {
        if (!this.socket?.connected) return;
        
        this.socket.emit('subscribeToNotifications');
    }
    
    /**
     * Listen to events
     */
    on(event, handler) {
        if (!this.socket) {
            throw new Error('WebSocket not connected');
        }
        
        this.socket.on(event, handler);
    }
    
    /**
     * Remove event listener
     */
    off(event, handler) {
        if (!this.socket) return;
        
        if (handler) {
            this.socket.off(event, handler);
        } else {
            this.socket.off(event);
        }
    }
    
    // ============================================
    // UTILITIES
    // ============================================
    
    openExternalUrl(url) {
        // In Electron, use shell.openExternal
        if (typeof window !== 'undefined' && window.electronAPI?.shell) {
            window.electronAPI.shell.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    }
}

// Export singleton instance
module.exports = new HostedAPI();
module.exports.HostedAPI = HostedAPI;
