# Twitch SILENT Implementation Guide

## Overview

This document provides detailed instructions for implementing the SILENT toggle functionality for Twitch Chat. When SILENT is enabled for a command, the user's command message should be deleted from Twitch chat while still executing the command.

**Current Status**: SILENT works for Popout Chat (implemented). Twitch Chat deletion requires additional implementation.

---

## Requirements

### Bot Account Permissions
The bot account must be a **moderator** in the Twitch channel to delete messages.

To make the bot a moderator:
1. In Twitch chat, type: `/mod <bot_username>`
2. Or use the Twitch dashboard: Creator Dashboard → Community → Roles Manager

### Twitch IRC Message Format
When a message is received via IRC, it includes tags with the message ID:

```
@badge-info=;badges=;client-nonce=abc123;color=#FF0000;display-name=Username;
emotes=;first-msg=0;flags=;id=MESSAGE-ID-HERE;mod=0;returning-chatter=0;
room-id=12345;subscriber=0;tmi-sent-ts=1234567890;turbo=0;user-id=67890;
user-type= :username!username@username.tmi.twitch.tv PRIVMSG #channel :!command
```

The `id=MESSAGE-ID-HERE` is the unique identifier needed for deletion.

---

## Implementation Steps

### Step 1: Capture Message ID

In `desktop-app/main.js`, modify the Twitch message handler to capture the message ID:

```javascript
twitchClient.on('message', async (channel, tags, message, self) => {
    if (self) return;
    
    // Capture message ID for potential deletion
    const messageId = tags.id || null;
    
    // ... existing code ...
    
    // Pass messageId to command parser
    await parseChatCommand(username, userId, message, tags, messageId);
});
```

### Step 2: Update parseChatCommand Signature

```javascript
async function parseChatCommand(username, userId, message, tags, messageId = null) {
    // ... existing code ...
}
```

### Step 3: Implement Message Deletion

Add a new function to delete messages:

```javascript
/**
 * Delete a message from Twitch chat
 * Requires bot to be a moderator in the channel
 * @param {string} messageId - The Twitch message ID to delete
 */
async function deleteTwitchMessage(messageId) {
    if (!messageId || !twitchClient || !isTwitchConnected) return;
    
    try {
        const config = loadTwitchConfig();
        const channel = config.channel || config.botUsername;
        
        // Send delete command via IRC
        await twitchClient.say(channel, `/delete ${messageId}`);
        console.log(`🗑️ Deleted message: ${messageId}`);
    } catch (err) {
        console.error('Failed to delete message:', err.message);
        // Don't throw - deletion failure shouldn't break command execution
    }
}
```

### Step 4: Call Deletion in Command Processing

In the unified command processing loop:

```javascript
for (const cmd of botMessagesCache) {
    if (!cmd.enabled || !Array.isArray(cmd.commands) || cmd.category === 'ANNOUNCEMENT') continue;
    if (cmd.commands.some(c => command === c || command.startsWith(c + ' '))) {
        
        // Delete user's command message if SILENT is enabled
        if (cmd.silent && messageId) {
            await deleteTwitchMessage(messageId);
        }
        
        // ... rest of command processing ...
    }
}
```

### Step 5: Update Individual Command Handlers

For commands with dedicated handlers (join, leave, afk, etc.), pass the messageId and check the silent flag:

```javascript
async function handleJoinCommand(username, userId, tags, messageId) {
    const botMsg = botMessagesCache.find(msg => msg.id === 'join');
    
    // Delete command message if silent
    if (botMsg && botMsg.silent && messageId) {
        await deleteTwitchMessage(messageId);
    }
    
    // ... rest of handler ...
}
```

---

## Error Handling

### Common Errors

1. **Bot not a moderator**
   - Error: `msg_channel_suspended` or permission error
   - Solution: Make bot a moderator in the channel

2. **Message already deleted**
   - Error: `bad_delete_message_error`
   - Solution: Ignore - message was already removed

3. **Invalid message ID**
   - Error: `bad_delete_message_id`
   - Solution: Log and continue - don't break command execution

### Graceful Degradation

```javascript
async function deleteTwitchMessage(messageId) {
    if (!messageId || !twitchClient || !isTwitchConnected) return;
    
    try {
        const config = loadTwitchConfig();
        const channel = config.channel || config.botUsername;
        await twitchClient.say(channel, `/delete ${messageId}`);
    } catch (err) {
        // Log but don't throw - SILENT should degrade gracefully
        if (err.message.includes('permission') || err.message.includes('moderator')) {
            console.warn('⚠️ SILENT: Bot needs moderator permissions to delete messages');
        } else {
            console.warn('⚠️ SILENT: Could not delete message:', err.message);
        }
    }
}
```

---

## User Experience Notes

1. **Brief Visibility**: The command message will appear briefly in Twitch chat before being deleted. This is unavoidable with IRC-based deletion.

2. **Deletion Notice**: Twitch may show "[message deleted]" placeholder depending on user settings.

3. **Popout Chat**: SILENT already works for Popout Chat - messages are simply not displayed.

4. **Dashboard Internal Chat**: Always shows all messages regardless of SILENT setting (for debugging/monitoring).

---

## Testing Checklist

- [ ] Bot account is moderator in channel
- [ ] Message ID is captured from IRC tags
- [ ] deleteTwitchMessage function works
- [ ] SILENT toggle deletes command messages
- [ ] Errors are handled gracefully
- [ ] Command still executes even if deletion fails
- [ ] Popout Chat SILENT still works
- [ ] Dashboard Internal Chat shows all messages

---

## Files to Modify

| File | Changes |
|------|---------|
| `desktop-app/main.js` | Add messageId capture, deleteTwitchMessage function, update command handlers |

---

## Timeline Estimate

- Implementation: 1-2 hours
- Testing: 1 hour
- Total: 2-3 hours

---

## Notes

- This feature is optional - SILENT already works for Popout Chat
- Requires streamer to grant moderator permissions to bot
- Consider adding a UI indicator when bot lacks mod permissions
