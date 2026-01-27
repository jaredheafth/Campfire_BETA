# Error Handling Standard

## Overview

This document establishes a unified error handling pattern for the Campfire Widget application to provide consistent, user-friendly error messages and logging.

## Error Handling Pattern

### 1. **Try-Catch with Logging & User Notification**

```javascript
try {
    // Attempt operation
    const result = riskyOperation();
} catch (error) {
    // Always log the full error for debugging
    console.error('[ComponentName] Operation failed:', error);
    
    // Show user-friendly message (not technical details)
    showUserError('Failed to load widget', 'Please refresh the page and try again.');
    
    // Optional: Send error to monitoring service
    reportErrorToService({ component: 'ComponentName', error });
}
```

### 2. **Error Categories & Messages**

#### Network Errors
```javascript
try {
    const response = await fetch(url);
} catch (error) {
    console.error('[Network] Fetch failed:', error);
    showUserError(
        'Connection Error',
        'Unable to connect to the server. Check your internet connection.'
    );
}
```

#### File/Path Errors
```javascript
try {
    const data = fs.readFileSync(path, 'utf8');
} catch (error) {
    console.error('[FileSystem] Read failed for path:', path, error);
    showUserError(
        'File Not Found',
        'Configuration file missing. Resetting to defaults.'
    );
    // Fallback to defaults
}
```

#### JSON Parse Errors
```javascript
try {
    const parsed = JSON.parse(jsonString);
} catch (error) {
    console.error('[JSON] Parse failed:', error);
    showUserError(
        'Data Corrupted',
        'Settings appear corrupted. Resetting to defaults.'
    );
    return defaultValue;
}
```

#### Twitch Connection Errors
```javascript
try {
    await twitchClient.connect();
} catch (error) {
    console.error('[Twitch] Connection failed:', error);
    showUserError(
        'Twitch Connection Error',
        `Failed to connect to Twitch: ${error.message}`
    );
    // Retry logic...
}
```

### 3. **User Error Display Functions**

#### In Electron (main.js)
```javascript
function showUserError(title, message) {
    try {
        dialog.showErrorBox(title, message);
    } catch (e) {
        console.error('[Error] Failed to show error dialog:', e);
    }
}

function showUserWarning(title, message) {
    try {
        dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title,
            message,
            buttons: ['OK']
        });
    } catch (e) {
        console.error('[Error] Failed to show warning dialog:', e);
    }
}
```

#### In Browser (widget.html/dashboard.html)
```javascript
function showUserError(title, message) {
    // Show toast/notification
    const notification = document.createElement('div');
    notification.className = 'error-notification';
    notification.innerHTML = `
        <div class="error-title">${escapeHtml(title)}</div>
        <div class="error-message">${escapeHtml(message)}</div>
    `;
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => notification.remove(), 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

### 4. **Logging Levels**

```javascript
// [ComponentName] prefix helps identify source
console.log('[ComponentName] Info message');      // Normal operation
console.warn('[ComponentName] Warning message');  // Non-critical issue
console.error('[ComponentName] Error message');   // Critical failure
```

### 5. **Silent Failures vs User Notification**

| Scenario | Handling | Example |
|----------|----------|---------|
| Non-critical feature | Silent (log only) | Sprite animation timing |
| User-facing operation | Show message | Failed to upload sprite |
| Data loss risk | Show error + user action | Settings failed to save |
| Connection loss | Show error + retry | Twitch disconnected |

## Common Errors & Solutions

### Network Request Failed
```javascript
async function fetchWithFallback(url, fallback) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.warn(`[Fetch] Failed to load ${url}:`, error);
        return fallback;
    }
}
```

### Missing Configuration
```javascript
function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (error) {
        console.error('[Config] Parse failed:', error);
    }
    
    // Return safe defaults
    return getDefaultConfig();
}
```

### Sprite Loading Failed
```javascript
async function loadSprite(url) {
    try {
        return await fetch(url).then(r => r.blob());
    } catch (error) {
        console.error('[Sprite] Load failed for:', url, error);
        // Show placeholder sprite
        return await getPlaceholderSprite();
    }
}
```

## CSS for Error Notifications

```css
.error-notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(220, 53, 69, 0.95);
    color: white;
    padding: 16px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    font-family: system-ui, -apple-system, sans-serif;
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
}

.error-notification .error-title {
    font-weight: 600;
    margin-bottom: 4px;
}

.error-notification .error-message {
    font-size: 14px;
    opacity: 0.95;
}

@keyframes slideIn {
    from {
        transform: translateX(400px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}
```

## Implementation Checklist

- [ ] Wrap all async operations in try-catch
- [ ] Log errors with component prefix
- [ ] Show user-friendly messages (no stack traces)
- [ ] Provide fallback values where possible
- [ ] Test error scenarios (offline, missing files, corrupted data)
- [ ] Monitor error frequency in production
- [ ] Update messages based on user feedback

## Error Monitoring (Future)

Consider integrating:
- Sentry (error tracking)
- LogRocket (session replay)
- Custom error reporting endpoint

This will help identify and fix issues users encounter.
