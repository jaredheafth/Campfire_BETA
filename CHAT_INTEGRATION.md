# Chat Integration Guide

## Chat Message Display

The widget now supports displaying chat messages above user shapes. To integrate with your chat system:

### Method 1: Direct Function Call

```javascript
// When a chat message is received
window.handleChatMessage(username, message, userId);
```

Example:
```javascript
// In your chat integration code
chatClient.onMessage((channel, userstate, message, self) => {
    if (message.length <= 50) { // Max 50 characters
        window.handleChatMessage(userstate['display-name'], message, userstate['user-id']);
    }
});
```

### Method 2: LocalStorage Event

```javascript
const chatData = {
    username: 'ViewerName',
    message: 'Hello!',
    userId: '12345678',
    timestamp: Date.now()
};

localStorage.setItem('chatMessage', JSON.stringify(chatData));
window.dispatchEvent(new StorageEvent('storage', {
    key: 'chatMessage',
    newValue: JSON.stringify(chatData)
}));
```

### Method 3: Custom Event

```javascript
window.dispatchEvent(new CustomEvent('chatMessage', {
    detail: {
        username: 'ViewerName',
        message: 'Hello!',
        userId: '12345678'
    }
}));
```

## Message Limits

- Maximum length: **50 characters**
- Messages longer than 50 characters are ignored
- Messages display for **3 seconds** then fade out

## User Movement

Viewers can move around the campfire using arrow keys when logged into the viewer dashboard. The movement is handled automatically via localStorage events.

## Integration Example (Twitch Chat)

```javascript
// Using tmi.js
const tmi = require('tmi.js');

const client = new tmi.Client({
    options: { debug: true },
    connection: {
        reconnect: true,
        secure: true
    },
    identity: {
        username: 'your_bot_username',
        password: 'oauth:your_oauth_token'
    },
    channels: ['your_channel']
});

client.connect();

client.on('message', (channel, tags, message, self) => {
    // Ignore messages from bot
    if (self) return;
    
    // Check if message is the join command
    if (message.toLowerCase().trim() === '!join') {
        // Add user to campfire
        if (window.campfireWidget) {
            window.campfireWidget.addUser(tags['display-name'], {
                userId: tags['user-id']
            });
        }
    } else {
        // Display chat message (if under 50 chars)
        if (message.length <= 50) {
            window.handleChatMessage(tags['display-name'], message, tags['user-id']);
        }
    }
});
```

## Notes

- Users are automatically added when they appear in chat messages
- The widget tracks users by username and userId
- Viewer colors are applied automatically from the viewer dashboard
- Movement controls only work for logged-in viewers
