# Auto-Updater Configuration

## Overview

This guide explains how to make the auto-updater configurable instead of hardcoded.

## Current State

Currently, the GitHub repository is hardcoded in `main.js`:

```javascript
const feedConfig = {
    provider: 'github',
    owner: 'jaredheafth',
    repo: 'offlineclub_widget_Campfire',
    private: isPrivateRepo
};
```

This prevents users from forking the project and using their own releases.

## Configuration File

Create `update-config.json` in the app data directory:

```json
{
  "provider": "github",
  "owner": "your-username",
  "repo": "your-fork-name",
  "private": false,
  "token": null
}
```

## Implementation

### 1. Load Configuration

In `main.js`, replace hardcoded config with:

```javascript
function loadUpdateConfig() {
    const configPath = path.join(userDataPath, 'update-config.json');
    const defaultConfig = {
        provider: 'github',
        owner: 'jaredheafth',
        repo: 'offlineclub_widget_Campfire',
        private: false
    };
    
    try {
        if (fs.existsSync(configPath)) {
            const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            // Merge with defaults (user can override individual fields)
            return { ...defaultConfig, ...saved };
        }
    } catch (error) {
        console.warn('[Updater] Failed to load update config:', error);
    }
    
    return defaultConfig;
}

function saveUpdateConfig(config) {
    const configPath = path.join(userDataPath, 'update-config.json');
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('[Updater] Config saved');
        return true;
    } catch (error) {
        console.error('[Updater] Failed to save config:', error);
        return false;
    }
}
```

### 2. Use Configuration

```javascript
app.whenReady().then(() => {
    // ... existing code ...
    
    // Load updater config
    const feedConfig = loadUpdateConfig();
    
    // Add token if in private repo
    if (feedConfig.private && process.env.GH_TOKEN) {
        feedConfig.token = process.env.GH_TOKEN;
    }
    
    try {
        autoUpdater.setFeedURL(feedConfig);
        console.log('[Updater] Feed configured:', feedConfig);
    } catch (e) {
        console.warn('[Updater] setFeedURL failed:', e.message);
    }
});
```

### 3. IPC Handler for Settings

Add IPC handler to allow UI configuration:

```javascript
ipcMain.handle('get-update-config', async () => {
    return loadUpdateConfig();
});

ipcMain.handle('set-update-config', async (_event, config) => {
    return saveUpdateConfig(config);
});
```

### 4. Dashboard UI

Add to `dashboard.html`:

```html
<div class="settings-tab">
    <h3>Update Configuration</h3>
    <p>Configure where to check for updates:</p>
    
    <label>
        Repository Owner:
        <input type="text" id="updateOwner" placeholder="github-username">
    </label>
    
    <label>
        Repository Name:
        <input type="text" id="updateRepo" placeholder="your-fork-name">
    </label>
    
    <label>
        <input type="checkbox" id="updatePrivate">
        Private Repository
    </label>
    
    <label>
        GitHub Token (for private repos):
        <input type="password" id="updateToken" placeholder="ghp_...">
    </label>
    
    <button onclick="saveUpdateConfig()">Save Update Config</button>
    <button onclick="checkUpdatesNow()">Check for Updates Now</button>
</div>
```

### 5. Dashboard JavaScript

```javascript
async function loadUpdateConfig() {
    const config = await window.electronAPI.getUpdateConfig();
    document.getElementById('updateOwner').value = config.owner;
    document.getElementById('updateRepo').value = config.repo;
    document.getElementById('updatePrivate').checked = config.private;
}

async function saveUpdateConfig() {
    const config = {
        owner: document.getElementById('updateOwner').value,
        repo: document.getElementById('updateRepo').value,
        private: document.getElementById('updatePrivate').checked,
        token: document.getElementById('updateToken').value || null
    };
    
    const success = await window.electronAPI.setUpdateConfig(config);
    if (success) {
        alert('Update configuration saved. Restart the app for changes to take effect.');
    }
}

async function checkUpdatesNow() {
    await window.electronAPI.checkForUpdates();
}
```

## Environment Variables

For CI/CD and automation:

```bash
# Set via environment
export GH_TOKEN="ghp_your_token"
export UPDATE_OWNER="your-username"
export UPDATE_REPO="your-fork"
export UPDATE_PRIVATE="false"
```

In code:
```javascript
const config = {
    provider: 'github',
    owner: process.env.UPDATE_OWNER || 'jaredheafth',
    repo: process.env.UPDATE_REPO || 'offlineclub_widget_Campfire',
    private: process.env.UPDATE_PRIVATE === 'true'
};

if (process.env.GH_TOKEN) {
    config.token = process.env.GH_TOKEN;
}
```

## Default Configuration

First run creates default config:

```javascript
function ensureUpdateConfig() {
    const configPath = path.join(userDataPath, 'update-config.json');
    if (!fs.existsSync(configPath)) {
        const defaults = {
            provider: 'github',
            owner: 'jaredheafth',
            repo: 'offlineclub_widget_Campfire',
            private: false,
            _comment: 'Edit this file to use your own fork for updates'
        };
        fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf8');
        console.log('[Updater] Created default config');
    }
}
```

## Validation

```javascript
function validateUpdateConfig(config) {
    if (!config.provider || config.provider !== 'github') {
        throw new Error('Only GitHub provider supported');
    }
    
    if (!config.owner || typeof config.owner !== 'string') {
        throw new Error('Invalid repository owner');
    }
    
    if (!config.repo || typeof config.repo !== 'string') {
        throw new Error('Invalid repository name');
    }
    
    return true;
}
```

## Migration

For existing users (backward compatibility):

```javascript
const config = loadUpdateConfig(); // Will use defaults if file doesn't exist
// Existing hardcoded repos will be overridden by this config
```

## Testing

```javascript
test('should load update config', () => {
    const config = loadUpdateConfig();
    expect(config.provider).toBe('github');
    expect(config.owner).toBeDefined();
    expect(config.repo).toBeDefined();
});

test('should merge with defaults', () => {
    // User config with only owner changed
    const userConfig = { owner: 'newuser' };
    const merged = { ...defaultConfig, ...userConfig };
    
    expect(merged.owner).toBe('newuser');
    expect(merged.repo).toBe('offlineclub_widget_Campfire'); // Default
});
```

## Deployment

1. **Forked Repository**: Update config in dashboard or `update-config.json`
2. **Private Repository**: Set `GH_TOKEN` environment variable
3. **No Updates**: Set `owner` to empty string to disable auto-updates

## Future Enhancements

- [ ] Support other providers (GitLab, custom servers)
- [ ] Update channel selection (stable, beta, nightly)
- [ ] Download mirrors/CDNs
- [ ] Automatic config migration on version bumps
