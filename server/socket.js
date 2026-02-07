/**
 * Campfire Widget - WebSocket Server
 * 
 * Real-time communication for campfires, chat, and notifications.
 * Uses Socket.io for WebSocket connections.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Store active connections
const connections = new Map(); // userId -> Set of socket IDs
const socketRooms = new Map(); // campfireId -> Set of socket IDs

// ============================================
// INITIALIZE WEBSOCKET SERVER
// ============================================

function initializeWebSocket(httpServer, options = {}) {
    const {
        path = '/socket.io',
        cors = {
            origin: process.env.FRONTEND_URL || '*',
            methods: ['GET', 'POST']
        },
        pingTimeout = 60000,
        pingInterval = 25000
    } = options;

    const io = new Server(httpServer, {
        path,
        cors,
        pingTimeout,
        pingInterval,
        transports: ['websocket', 'polling']
    });

    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || 
                          socket.handshake.query.token;

            if (!token) {
                return next(new Error('Authentication required'));
            }

            // Verify token
            const decoded = jwt.verify(token, JWT_SECRET);
            
            socket.user = decoded;
            socket.userId = decoded.sub;

            // Store connection
            if (!connections.has(socket.userId)) {
                connections.set(socket.userId, new Set());
            }
            connections.get(socket.userId).add(socket.id);

            next();
        } catch (error) {
            next(new Error('Invalid authentication token'));
        }
    });

    // Connection handler
    io.on('connection', (socket) => {
        console.log(`[WebSocket] User ${socket.user.username} connected (${socket.id})`);

        // ============================================
        // CAMPFIRE EVENTS
        // ============================================

        /**
         * Join a campfire room
         */
        socket.on('joinCampfire', async (data, callback) => {
            try {
                const { campfireId } = data;

                if (!campfireId) {
                    return callback?.({ error: 'campfireId required' });
                }

                // Join the room
                socket.join(`campfire:${campfireId}`);

                // Track room membership
                if (!socketRooms.has(campfireId)) {
                    socketRooms.set(campfireId, new Set());
                }
                socketRooms.get(campfireId).add(socket.id);

                // Store user's current campfire
                socket.currentCampfireId = campfireId;

                // Notify others in the campfire
                socket.to(`campfire:${campfireId}`).emit('userJoined', {
                    userId: socket.userId,
                    username: socket.user.username,
                    displayName: socket.user.displayName,
                    socketId: socket.id
                });

                // Send current members to the joining user
                const roomMembers = await getRoomMembers(io, campfireId);
                callback?.({ success: true, members: roomMembers });

                console.log(`[WebSocket] ${socket.user.username} joined campfire ${campfireId}`);
            } catch (error) {
                console.error('[WebSocket] joinCampfire error:', error);
                callback?.({ error: error.message });
            }
        });

        /**
         * Leave a campfire room
         */
        socket.on('leaveCampfire', async (data, callback) => {
            try {
                const { campfireId } = data;

                if (!campfireId && socket.currentCampfireId) {
                    return socket.leaveCampfire({ campfireId: socket.currentCampfireId }, callback);
                }

                // Leave the room
                socket.leave(`campfire:${campfireId}`);

                // Remove from room tracking
                if (socketRooms.has(campfireId)) {
                    socketRooms.get(campfireId).delete(socket.id);
                }

                // Notify others
                socket.to(`campfire:${campfireId}`).emit('userLeft', {
                    userId: socket.userId,
                    username: socket.user.username
                });

                socket.currentCampfireId = null;

                callback?.({ success: true });

                console.log(`[WebSocket] ${socket.user.username} left campfire ${campfireId}`);
            } catch (error) {
                console.error('[WebSocket] leaveCampfire error:', error);
                callback?.({ error: error.message });
            }
        });

        // ============================================
        // CHAT EVENTS
        // ============================================

        /**
         * Send a chat message
         */
        socket.on('chatMessage', async (data, callback) => {
            try {
                const { campfireId, content, metadata = {} } = data;

                if (!campfireId || !content) {
                    return callback?.({ error: 'campfireId and content required' });
                }

                // Validate user is in the campfire
                if (!socket.rooms.has(`campfire:${campfireId}`)) {
                    return callback?.({ error: 'You must join the campfire first' });
                }

                // Limit message length
                if (content.length > 500) {
                    return callback?.({ error: 'Message too long (max 500 characters)' });
                }

                // Broadcast to all members of the campfire
                io.to(`campfire:${campfireId}`).emit('chatMessage', {
                    id: generateMessageId(),
                    campfireId,
                    userId: socket.userId,
                    username: socket.user.username,
                    displayName: socket.user.displayName,
                    content,
                    metadata: {
                        ...metadata,
                        timestamp: Date.now()
                    }
                });

                callback?.({ success: true });

                console.log(`[WebSocket] Chat message from ${socket.user.username} in ${campfireId}`);
            } catch (error) {
                console.error('[WebSocket] chatMessage error:', error);
                callback?.({ error: error.message });
            }
        });

        /**
         * Send typing indicator
         */
        socket.on('typing', (data) => {
            const { campfireId } = data;

            if (!campfireId) return;

            socket.to(`campfire:${campfireId}`).emit('userTyping', {
                userId: socket.userId,
                username: socket.user.username
            });
        });

        /**
         * Stop typing indicator
         */
        socket.on('stopTyping', (data) => {
            const { campfireId } = data;

            if (!campfireId) return;

            socket.to(`campfire:${campfireId}`).emit('userStoppedTyping', {
                userId: socket.userId
            });
        });

        // ============================================
        // SPRITE/EVENTS
        // ============================================

        /**
         * Update user sprite
         */
        socket.on('updateSprite', async (data, callback) => {
            try {
                const { campfireId, spriteId, color } = data;

                if (!campfireId) {
                    return callback?.({ error: 'campfireId required' });
                }

                // Broadcast to campfire
                io.to(`campfire:${campfireId}`).emit('spriteUpdated', {
                    userId: socket.userId,
                    username: socket.user.username,
                    spriteId,
                    color
                });

                callback?.({ success: true });
            } catch (error) {
                console.error('[WebSocket] updateSprite error:', error);
                callback?.({ error: error.message });
            }
        });

        /**
         * User started moving
         */
        socket.on('startMovement', (data) => {
            const { campfireId, direction, speed = 15 } = data;

            if (!campfireId) return;

            socket.to(`campfire:${campfireId}`).emit('userStartedMoving', {
                userId: socket.userId,
                username: socket.user.username,
                direction, // -1 for left, 1 for right
                speed
            });
        });

        /**
         * User stopped moving
         */
        socket.on('stopMovement', (data) => {
            const { campfireId } = data;

            if (!campfireId) return;

            socket.to(`campfire:${campfireId}`).emit('userStoppedMoving', {
                userId: socket.userId,
                username: socket.user.username
            });
        });

        // ============================================
        // BUDDY EVENTS
        // ============================================

        /**
         * Subscribe to buddy updates
         */
        socket.on('subscribeToBuddies', () => {
            socket.join(`buddies:${socket.userId}`);
        });

        /**
         * Unsubscribe from buddy updates
         */
        socket.on('unsubscribeFromBuddies', () => {
            socket.leave(`buddies:${socket.userId}`);
        });

        // ============================================
        // NOTIFICATION EVENTS
        // ============================================

        /**
         * Subscribe to personal notifications
         */
        socket.on('subscribeToNotifications', () => {
            socket.join(`notifications:${socket.userId}`);
        });

        /**
         * Unsubscribe from personal notifications
         */
        socket.on('unsubscribeFromNotifications', () => {
            socket.leave(`notifications:${socket.userId}`);
        });

        // ============================================
        // DISCONNECT HANDLER
        // ============================================

        socket.on('disconnect', (reason) => {
            console.log(`[WebSocket] User ${socket.user.username} disconnected (${reason})`);

            // Remove from connections
            if (connections.has(socket.userId)) {
                connections.get(socket.userId).delete(socket.id);
                if (connections.get(socket.userId).size === 0) {
                    connections.delete(socket.userId);
                }
            }

            // Remove from room tracking
            if (socket.currentCampfireId && socketRooms.has(socket.currentCampfireId)) {
                socketRooms.get(socket.currentCampfireId).delete(socket.id);

                // Notify others if room is now empty
                if (socketRooms.get(socket.currentCampfireId).size === 0) {
                    socketRooms.delete(socket.currentCampfireId);
                }
            }

            // Broadcast leave if in a campfire
            if (socket.currentCampfireId) {
                socket.to(`campfire:${socket.currentCampfireId}`).emit('userLeft', {
                    userId: socket.userId,
                    username: socket.user.username
                });
            }
        });

        // ============================================
        // ERROR HANDLER
        // ============================================

        socket.on('error', (error) => {
            console.error(`[WebSocket] Socket error for ${socket.user.username}:`, error);
        });
    });

    return io;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all members in a campfire room
 */
async function getRoomMembers(io, campfireId) {
    const room = io.sockets.adapter.rooms.get(`campfire:${campfireId}`);
    if (!room) return [];

    const members = [];
    
    for (const socketId of room) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
            members.push({
                socketId: socket.id,
                userId: socket.userId,
                username: socket.user.username,
                displayName: socket.user.displayName
            });
        }
    }

    return members;
}

/**
 * Send notification to a specific user
 */
function sendNotification(io, userId, notification) {
    io.to(`notifications:${userId}`).emit('notification', notification);
}

/**
 * Send buddy online/offline status
 */
function broadcastBuddyStatus(io, userId, isOnline) {
    io.to(`buddies:${userId}`).emit('buddyStatusChanged', {
        userId,
        isOnline
    });
}

/**
 * Send message to a campfire room
 */
function broadcastToCampfire(io, campfireId, event, data) {
    io.to(`campfire:${campfireId}`).emit(event, data);
}

/**
 * Get online users in a campfire
 */
function getOnlineUsers(campfireId) {
    const room = socketRooms.get(campfireId);
    return room ? Array.from(room) : [];
}

/**
 * Check if user is online
 */
function isUserOnline(userId) {
    return connections.has(userId);
}

/**
 * Get socket count
 */
function getSocketCount() {
    let count = 0;
    for (const sockets of connections.values()) {
        count += sockets.size;
    }
    return count;
}

/**
 * Get user count (unique users)
 */
function getUserCount() {
    return connections.size;
}

/**
 * Generate unique message ID
 */
function generateMessageId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
    initializeWebSocket,
    sendNotification,
    broadcastBuddyStatus,
    broadcastToCampfire,
    getOnlineUsers,
    isUserOnline,
    getSocketCount,
    getUserCount
};
