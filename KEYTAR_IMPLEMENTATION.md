# Token Encryption with Keytar

## Overview

This document describes how to implement secure token storage using the `keytar` library, which stores tokens in the OS credential store rather than plain text files.

## Why This Matters

**Current Issue**: OAuth tokens are stored in plain text (`twitch-config.json`)
- ⚠️ Security risk if device is compromised
- Tokens visible in backups
- No encryption at rest

**Solution**: Use OS-level credential store via `keytar`
- ✅ Secure: Uses OS keychain (Windows, macOS) or secret-service (Linux)
- ✅ Transparent: No code changes for users
- ✅ Standard: Industry best practice

## Installation

```bash
npm install keytar
```

Note: `keytar` requires build tools. It will compile native modules during installation.

## Implementation

### 1. Encryption Module (`keytar-wrapper.js`)

Create a wrapper around keytar for consistent API:

```javascript
const keytar = require('keytar');

const SERVICE_NAME = 'Campfire Widget';
const TWITCH_ACCOUNT = 'twitch-oauth';

/**
 * Save token securely
 */
async function saveToken(token) {
    try {
        await keytar.setPassword(SERVICE_NAME, TWITCH_ACCOUNT, token);
        console.log('[Security] Token saved to OS keychain');
        return true;
    } catch (error) {
        console.error('[Security] Failed to save token:', error);
        // Fallback: save to file (less secure but functional)
        saveLegacyToken(token);
        return false;
    }
}

/**
 * Retrieve token securely
 */
async function getToken() {
    try {
        const token = await keytar.getPassword(SERVICE_NAME, TWITCH_ACCOUNT);
        if (token) {
            console.log('[Security] Token retrieved from OS keychain');
            return token;
        }
    } catch (error) {
        console.error('[Security] Failed to retrieve token from keychain:', error);
    }
    
    // Fallback: check legacy file storage
    return getLegacyToken();
}

/**
 * Delete token securely
 */
async function deleteToken() {
    try {
        await keytar.deletePassword(SERVICE_NAME, TWITCH_ACCOUNT);
        console.log('[Security] Token deleted from keychain');
        return true;
    } catch (error) {
        console.error('[Security] Failed to delete token:', error);
        return false;
    }
}

module.exports = { saveToken, getToken, deleteToken };
```

### 2. Usage in Main Process (`main.js`)

```javascript
const { saveToken, getToken, deleteToken } = require('./keytar-wrapper');

// On app start: load token from secure storage
async function loadTwitchToken() {
    try {
        const token = await getToken();
        if (token) {
            console.log('[Twitch] Token loaded from secure storage');
            return token;
        }
    } catch (error) {
        console.error('[Twitch] Failed to load token:', error);
    }
    return null;
}

// When user sets new token: save to secure storage
async function setTwitchToken(token) {
    try {
        await saveToken(token);
        console.log('[Twitch] Token saved securely');
        return true;
    } catch (error) {
        console.error('[Twitch] Failed to save token:', error);
        return false;
    }
}

// When user logs out: delete token
async function clearTwitchToken() {
    try {
        await deleteToken();
        console.log('[Twitch] Token cleared');
        return true;
    } catch (error) {
        console.error('[Twitch] Failed to clear token:', error);
        return false;
    }
}
```

### 3. Migration from Plain Text

For existing installations using plain text tokens:

```javascript
async function migrateTokens() {
    const legacyToken = getLegacyToken(); // read from twitch-config.json
    
    if (legacyToken) {
        console.log('[Security] Migrating token to secure storage...');
        try {
            await saveToken(legacyToken);
            // Delete plain text file (optional - keep for backup)
            // fs.unlinkSync(path.join(userDataPath, 'twitch-config.json'));
            console.log('[Security] Token migration complete');
        } catch (error) {
            console.error('[Security] Token migration failed:', error);
        }
    }
}

// Call on app startup
app.whenReady().then(async () => {
    await migrateTokens();
    // ... rest of startup
});
```

## Platform Differences

| Platform | Storage | Security |
|----------|---------|----------|
| Windows | Windows Credential Manager | ⭐⭐⭐⭐ |
| macOS | Keychain | ⭐⭐⭐⭐ |
| Linux | Secret-Service/pass | ⭐⭐⭐ |

## Fallback Strategy

If keytar fails (offline, missing dependencies):
1. Try OS keychain → 2. Try legacy file → 3. Prompt user for token

This ensures app keeps working even if keytar has issues.

## Testing

```javascript
// Test secure token storage
test('should save and retrieve token securely', async () => {
    const testToken = 'oauth_test_12345';
    
    // Save
    await saveToken(testToken);
    
    // Retrieve
    const retrieved = await getToken();
    expect(retrieved).toBe(testToken);
    
    // Cleanup
    await deleteToken();
});

test('should fallback to legacy storage if keytar fails', async () => {
    // Mock keytar failure
    jest.mock('keytar', () => ({
        setPassword: () => Promise.reject(new Error('Not available'))
    }));
    
    const saved = await saveToken('test');
    expect(saved).toBe(false); // Falls back to file
});
```

## Deployment Notes

1. **Windows**: Requires `windows-build-tools` for compilation
2. **macOS**: Native, should work out of box
3. **Linux**: Requires `libsecret` development libraries

Install build tools:
```bash
# Windows
npm install --global windows-build-tools

# macOS
# Usually works without additional tools

# Linux
sudo apt-get install libsecret-1-dev (Debian/Ubuntu)
```

## Security Best Practices

✅ **Do**:
- Store tokens in OS keychain
- Log token access for audit trails
- Use clear error messages (don't leak token values)
- Migrate existing tokens on first run

❌ **Don't**:
- Log token values
- Store multiple tokens unencrypted
- Hardcode any secrets in code
- Share tokens between users

## Future Enhancements

- [ ] Multi-account support (multiple Twitch channels)
- [ ] Token refresh handling
- [ ] Secure token expiration policies
- [ ] Hardware security key support (FIDO2)
