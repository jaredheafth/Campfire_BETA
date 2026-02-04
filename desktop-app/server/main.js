const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;
let tray;
let isServerRunning = false;

// Path to server.js in the app directory
const serverPath = path.join(__dirname, 'server', 'server.js');
const serverDir = path.join(__dirname, 'server');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Campfire Widget - Dashboard',
        backgroundColor: '#000000' // Black background while loading
    });

    // Load the loading screen first
    const loadingPath = path.join(__dirname, 'loading.html');
    mainWindow.loadFile(loadingPath);
    
    // After 2 seconds, load the dashboard
    setTimeout(() => {
        const dashboardPath = path.join(__dirname, 'server', 'dashboard.html');
        mainWindow.loadFile(dashboardPath);
    }, 2000);

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
    tray = new Tray(iconPath || path.join(__dirname, 'assets', 'icon.png'));
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: isServerRunning ? '🟢 Server Running' : '🔴 Server Stopped',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Open Dashboard',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                } else {
                    createWindow();
                }
            }
        },
        {
            label: isServerRunning ? 'Stop Server' : 'Start Server',
            click: () => {
                if (isServerRunning) {
                    stopServer().catch(console.error);
                } else {
                    startServer();
                }
            }
        },
        { type: 'separator' },
        {
                label: 'Quit',
                click: async () => {
                    await stopServer();
                    app.quit();
                }
        }
    ]);
    
    tray.setToolTip('Campfire Widget');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
        if (mainWindow) {
            mainWindow.show();
        } else {
            createWindow();
        }
    });
}

function startServer() {
    if (isServerRunning) {
        return;
    }

    // Check if server.js exists
    if (!fs.existsSync(serverPath)) {
        dialog.showErrorBox('Error', 'Server file not found. Please reinstall the application.');
        return;
    }

    // Pass sprite path as environment variable to server
    const effectiveSpritePath = getEffectiveSpritePath();
    const env = {
        ...process.env,
        CUSTOM_SPRITE_PATH: effectiveSpritePath
    };

    // Find Node.js executable
    // In packaged apps, Node.js might not be in PATH, so try multiple locations
    let nodeExecutable = 'node'; // Default: try system PATH first
    
    // Try to find Node.js in common locations
    if (process.platform === 'win32') {
        // Windows: Try common Node.js installation paths
        const possiblePaths = [
            path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs', 'node.exe'),
            path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'nodejs', 'node.exe'),
            path.join(process.env.LOCALAPPDATA || '', 'Programs', 'nodejs', 'node.exe'),
            path.join(process.env.APPDATA || '', 'npm', 'node.exe')
        ];
        
        for (const nodePath of possiblePaths) {
            if (fs.existsSync(nodePath)) {
                nodeExecutable = nodePath;
                console.log('✅ Found Node.js at:', nodeExecutable);
                break;
            }
        }
    } else {
        // Mac/Linux: Try common locations
        const possiblePaths = [
            '/usr/local/bin/node',
            '/usr/bin/node',
            '/opt/homebrew/bin/node', // Homebrew on Apple Silicon
            path.join(process.env.HOME || '', '.nvm', 'versions', 'node', 'v*', 'bin', 'node')
        ];
        
        for (const nodePath of possiblePaths) {
            if (fs.existsSync(nodePath)) {
                nodeExecutable = nodePath;
                console.log('✅ Found Node.js at:', nodeExecutable);
                break;
            }
        }
    }

    // Start the Node.js server
    console.log('🚀 Starting server with Node.js:', nodeExecutable);
    serverProcess = spawn(nodeExecutable, [serverPath], {
        cwd: serverDir,
        stdio: 'pipe',
        detached: false, // Ensure process is killed when parent exits
        env: env,
        shell: process.platform === 'win32' // Use shell on Windows to help find node
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(`Server: ${data}`);
        if (mainWindow) {
            mainWindow.webContents.send('server-log', data.toString());
        }
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`Server Error: ${data}`);
        if (mainWindow) {
            mainWindow.webContents.send('server-error', data.toString());
        }
    });

    serverProcess.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
        isServerRunning = false;
        updateTrayMenu();
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false });
        }
    });

    isServerRunning = true;
    updateTrayMenu();
    
    if (mainWindow) {
        mainWindow.webContents.send('server-status', { running: true });
    }

    // Wait a moment for server to start, then open dashboard
    // Note: Loading screen will transition to dashboard automatically
    setTimeout(() => {
        if (mainWindow) {
            mainWindow.loadURL('http://localhost:3000/dashboard.html');
        }
    }, 2000);
}

function stopServer() {
    return new Promise((resolve) => {
        if (!serverProcess) {
            isServerRunning = false;
            updateTrayMenu();
            resolve();
            return;
        }
        
        // Force kill the server process
        try {
            serverProcess.kill('SIGTERM');
            
            // If process doesn't exit within 1 second, force kill it
            const timeout = setTimeout(() => {
                if (serverProcess && !serverProcess.killed) {
                    try {
                        serverProcess.kill('SIGKILL');
                    } catch (e) {
                        console.error('Error force killing server:', e);
                    }
                }
                serverProcess = null;
                isServerRunning = false;
                updateTrayMenu();
                resolve();
            }, 1000);
            
            // Wait for process to exit
            serverProcess.on('exit', () => {
                clearTimeout(timeout);
                serverProcess = null;
                isServerRunning = false;
                updateTrayMenu();
                resolve();
            });
        } catch (e) {
            console.error('Error stopping server:', e);
            serverProcess = null;
            isServerRunning = false;
            updateTrayMenu();
            resolve();
        }
        
        if (mainWindow) {
            mainWindow.webContents.send('server-status', { running: false });
        }
    });
}

function updateTrayMenu() {
    if (tray) {
        const contextMenu = Menu.buildFromTemplate([
            {
                label: isServerRunning ? '🟢 Server Running' : '🔴 Server Stopped',
                enabled: false
            },
            { type: 'separator' },
            {
                label: 'Open Dashboard',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                    } else {
                        createWindow();
                    }
                }
            },
            {
                label: isServerRunning ? 'Stop Server' : 'Start Server',
                click: () => {
                    if (isServerRunning) {
                        stopServer().catch(console.error);
                    } else {
                        startServer();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: async () => {
                    await stopServer();
                    app.quit();
                }
            }
        ]);
        tray.setContextMenu(contextMenu);
    }
}

// IPC handlers
ipcMain.handle('start-server', () => {
    startServer();
    return { success: true };
});

ipcMain.handle('stop-server', async () => {
    await stopServer();
    return { success: true };
});

ipcMain.handle('get-server-status', () => {
    return { running: isServerRunning };
});

// Twitch OAuth handlers
ipcMain.handle('generate-twitch-token', async () => {
    return new Promise((resolve, reject) => {
        // Create OAuth window
        const authWindow = new BrowserWindow({
            width: 500,
            height: 700,
            show: false,
            modal: true,
            parent: mainWindow,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        // Twitch OAuth URL
        const clientId = 'kimne78kx3ncx6brgo4mv6wki5h1ko'; // Public client ID for token generator
        const redirectUri = 'http://localhost:3000/twitch-callback';
        const scopes = 'chat:read';
        const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scopes}`;

        authWindow.loadURL(authUrl);
        authWindow.show();

        // Handle navigation to callback URL
        authWindow.webContents.on('did-navigate', (event, url) => {
            if (url.startsWith(redirectUri)) {
                // Extract token from URL fragment (Twitch uses implicit grant)
                const urlObj = new URL(url);
                const hash = urlObj.hash.substring(1); // Remove #
                const params = new URLSearchParams(hash);
                const accessToken = params.get('access_token');
                const error = params.get('error');
                const errorDescription = params.get('error_description');

                authWindow.close();

                if (error) {
                    reject(new Error(`OAuth error: ${error} - ${errorDescription || ''}`));
                } else if (accessToken) {
                    resolve({ token: accessToken });
                } else {
                    reject(new Error('No access token received'));
                }
            }
        });

        // Also listen for will-navigate (sometimes fires before did-navigate)
        authWindow.webContents.on('will-navigate', (event, url) => {
            if (url.startsWith(redirectUri)) {
                event.preventDefault();
                const urlObj = new URL(url);
                const hash = urlObj.hash.substring(1);
                const params = new URLSearchParams(hash);
                const accessToken = params.get('access_token');
                const error = params.get('error');
                const errorDescription = params.get('error_description');

                authWindow.close();

                if (error) {
                    reject(new Error(`OAuth error: ${error} - ${errorDescription || ''}`));
                } else if (accessToken) {
                    resolve({ token: accessToken });
                } else {
                    reject(new Error('No access token received'));
                }
            }
        });

        // Handle window closed - only reject if we haven't already resolved
        let resolved = false;
        const originalResolve = resolve;
        const originalReject = reject;
        
        resolve = (value) => {
            if (!resolved) {
                resolved = true;
                originalResolve(value);
            }
        };
        
        reject = (error) => {
            if (!resolved) {
                resolved = true;
                originalReject(error);
            }
        };
        
        authWindow.on('closed', () => {
            // Only reject if we haven't already resolved/rejected
            if (!resolved) {
                reject(new Error('OAuth window closed'));
            }
        });
    });
});

// Get Twitch config from server
ipcMain.handle('get-twitch-config', async () => {
    const configPath = path.join(serverDir, 'twitch-config.json');
    try {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return config;
        }
    } catch (e) {
        console.error('Error reading Twitch config:', e);
    }
    return { botUsername: '', oauthToken: '', channelName: '' };
});

// Auto-updater handlers
ipcMain.handle('check-for-updates', async () => {
    try {
        // Ensure feed URL is set before checking (in case it wasn't set earlier)
        // Use same config as app.whenReady()
        const isPrivateRepo = false; // Set to true if your GitHub repo is private
        const githubToken = process.env.GH_TOKEN || null;
        
        const feedConfig = {
            provider: 'github',
            owner: 'jaredheafth',
            repo: 'offlineclub_widget_Campfire',
            private: isPrivateRepo
        };
        
        if (isPrivateRepo && githubToken) {
            feedConfig.token = githubToken;
        }
        
        autoUpdater.setFeedURL(feedConfig);
        
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result?.updateInfo };
    } catch (error) {
        console.error('Error checking for updates:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        console.error('Error downloading update:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('install-update', async () => {
    try {
        console.log('🔄 Preparing to install update - shutting down all processes...');
        
        // CRITICAL: Stop server and wait for it to fully terminate before installing
        await stopServer();
        
        // Close all windows
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach(win => {
            win.destroy(); // Force destroy, don't just close
        });
        
        // Destroy tray if it exists
        if (tray) {
            tray.destroy();
            tray = null;
        }
        
        // Wait a moment to ensure all processes are fully terminated
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ All processes terminated, starting installer...');
        
        // Now safe to run the installer
        // quitAndInstall(restartAfterInstall=false, isSilent=false)
        autoUpdater.quitAndInstall(false, true);
        return { success: true };
    } catch (error) {
        console.error('Error installing update:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-app-version', async () => {
    return { version: app.getVersion() };
});

// ============================================
// SPRITE PATH MANAGEMENT
// ============================================

// Get the default sprite path (cross-platform)
function getDefaultSpritePath() {
    // In development, use __dirname
    if (process.env.ELECTRON_IS_DEV === '1' || !__dirname.includes('.asar')) {
        return path.join(__dirname, 'server', 'sprites');
    }
    
    // In packaged app, check for unpacked sprites
    const unpackedDir = __dirname.replace('app.asar', 'app.asar.unpacked');
    const unpackedSprites = path.join(unpackedDir, 'server', 'sprites');
    
    if (fs.existsSync(unpackedSprites)) {
        return unpackedSprites;
    }
    
    // Fallback to asar path
    return path.join(__dirname, 'server', 'sprites');
}

// Get custom sprite path from userData
function getCustomSpritePath() {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'sprite-path.json');
    
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.customPath && fs.existsSync(config.customPath)) {
                return config.customPath;
            }
        } catch (e) {
            console.error('Error reading sprite path config:', e);
        }
    }
    
    return null;
}

// Get effective sprite path (custom first, then default)
function getEffectiveSpritePath() {
    const customPath = getCustomSpritePath();
    if (customPath) {
        return customPath;
    }
    return getDefaultSpritePath();
}

// IPC: Get current sprite path
ipcMain.handle('get-sprite-path', async () => {
    const customPath = getCustomSpritePath();
    const defaultPath = getDefaultSpritePath();
    const effectivePath = getEffectiveSpritePath();
    
    return {
        customPath: customPath,
        defaultPath: defaultPath,
        effectivePath: effectivePath,
        isCustom: customPath !== null
    };
});

// IPC: Set custom sprite path via folder picker
ipcMain.handle('set-sprite-path', async (event) => {
    if (!mainWindow) {
        return { success: false, error: 'Main window not available' };
    }
    
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Default Sprites Folder',
            message: 'Select the folder containing your default sprites (should contain a "defaults" subfolder)'
        });
        
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }
        
        const selectedPath = result.filePaths[0];
        
        // Verify the path contains a "defaults" folder
        const defaultsPath = path.join(selectedPath, 'defaults');
        if (!fs.existsSync(defaultsPath)) {
            return {
                success: false,
                error: 'Selected folder does not contain a "defaults" subfolder. Please select the correct sprites folder.'
            };
        }
        
        // Save custom path
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'sprite-path.json');
        const config = { customPath: selectedPath };
        
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        // Notify server to reload (if running)
        if (isServerRunning && mainWindow) {
            mainWindow.webContents.send('sprite-path-changed', { path: selectedPath });
        }
        
        return { success: true, path: selectedPath };
    } catch (error) {
        console.error('Error setting sprite path:', error);
        return { success: false, error: error.message };
    }
});

// IPC: Reset to default sprite path
ipcMain.handle('reset-sprite-path', async () => {
    try {
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'sprite-path.json');
        
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
        
        const defaultPath = getDefaultSpritePath();
        
        // Notify server to reload (if running)
        if (isServerRunning && mainWindow) {
            mainWindow.webContents.send('sprite-path-changed', { path: defaultPath });
        }
        
        return { success: true, path: defaultPath };
    } catch (error) {
        console.error('Error resetting sprite path:', error);
        return { success: false, error: error.message };
    }
});

// Shutdown app completely
ipcMain.handle('shutdown-app', async () => {
    console.log('🛑 Shutting down application...');
    
    // Stop server and wait for it to fully terminate
    await stopServer();
    
    // Close all windows
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(win => {
        win.destroy(); // Use destroy() instead of close() to force immediate closure
    });
    
    // Destroy tray if it exists
    if (tray) {
        tray.destroy();
        tray = null;
    }
    
    // Wait a moment for all processes to fully terminate, then quit
    setTimeout(() => {
        // Force quit if needed
        app.exit(0);
    }, 1000);
    
    return { success: true };
});

// Save Twitch config to server
ipcMain.handle('save-twitch-config', async (event, config) => {
    const configPath = path.join(serverDir, 'twitch-config.json');
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        
        // Also update server.js CONFIG if it exists
        const serverJsPath = path.join(serverDir, 'server.js');
        if (fs.existsSync(serverJsPath)) {
            let serverJs = fs.readFileSync(serverJsPath, 'utf8');
            
            // Update CONFIG object
            serverJs = serverJs.replace(
                /BOT_USERNAME:\s*['"][^'"]*['"]/,
                `BOT_USERNAME: '${config.botUsername || ''}'`
            );
            serverJs = serverJs.replace(
                /OAUTH_TOKEN:\s*['"][^'"]*['"]/,
                `OAUTH_TOKEN: '${config.oauthToken || ''}'`
            );
            serverJs = serverJs.replace(
                /CHANNEL_NAME:\s*['"][^'"]*['"]/,
                `CHANNEL_NAME: '${config.channelName || ''}'`
            );
            
            fs.writeFileSync(serverJsPath, serverJs);
        }
        
        return { success: true };
    } catch (e) {
        console.error('Error saving Twitch config:', e);
        return { success: false, error: e.message };
    }
});

// Configure auto-updater
autoUpdater.autoDownload = false; // Manual download (user clicks button)
autoUpdater.autoInstallOnAppQuit = false; // Manual install

// Disable signature verification for unsigned installers
// electron-updater v6.x uses different APIs, so we use try-catch for safety
try {
    // New API for v6.x
    if (typeof autoUpdater.disableWin32CertCheck !== 'undefined') {
        autoUpdater.disableWin32CertCheck = true;
    }
    // Legacy API for older versions
    if (typeof autoUpdater.verifySignature !== 'undefined') {
        autoUpdater.verifySignature = false;
    }
} catch (e) {
    console.warn('[Updater] Could not configure signature verification:', e.message);
}

// Note: setFeedURL is called in app.whenReady() to ensure it happens
// before any update checks, preventing the releases.atom 404 error

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
    console.log('Checking for updates...');
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { status: 'checking' });
    }
});

autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { 
            status: 'available', 
            version: info.version,
            releaseDate: info.releaseDate 
        });
    }
});

autoUpdater.on('update-not-available', (info) => {
    console.log('No update available');
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { 
            status: 'not-available',
            version: app.getVersion()
        });
    }
});

autoUpdater.on('error', (err) => {
    console.error('Update error:', err);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { 
            status: 'error', 
            error: err.message 
        });
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
    console.log(message);
    if (mainWindow) {
        mainWindow.webContents.send('update-progress', progressObj);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    if (mainWindow) {
        mainWindow.webContents.send('update-status', { 
            status: 'downloaded',
            version: info.version
        });
    }
});

app.whenReady().then(() => {
    // IMPORTANT: Set feed URL BEFORE any update checks
    // This ensures we use GitHub API instead of deprecated releases.atom
    // NOTE: If your repo is private, set private: true and add a GitHub token
    // For public repos, set private: false (no token needed)
    const isPrivateRepo = false; // Set to true if your GitHub repo is private
    const githubToken = process.env.GH_TOKEN || null; // Optional: GitHub token for private repos
    
    const feedConfig = {
        provider: 'github',
        owner: 'jaredheafth',
        repo: 'offlineclub_widget_Campfire',
        private: isPrivateRepo
    };
    
    // Add token if repo is private and token is provided
    if (isPrivateRepo && githubToken) {
        feedConfig.token = githubToken;
    }
    
    autoUpdater.setFeedURL(feedConfig);
    
    createWindow();
    createTray();
    
    // Auto-start server
    startServer();
    
    // Check for updates on startup (but don't auto-download)
    // Check every 4 hours
    setInterval(() => {
        autoUpdater.checkForUpdates().catch(err => {
            console.error('Error checking for updates:', err);
        });
    }, 4 * 60 * 60 * 1000); // 4 hours
    
    // Also check on startup (after a delay to not block UI)
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(err => {
            console.error('Error checking for updates on startup:', err);
        });
    }, 5000); // 5 seconds after startup

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // Don't quit when all windows are closed (keep running in tray)
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        // On Windows/Linux, keep running in tray
    }
});

app.on('before-quit', async (event) => {
    // Wait for server to fully stop before allowing quit
    if (isServerRunning) {
        event.preventDefault(); // Prevent quit until server stops
        await stopServer();
        app.quit(); // Now allow quit
    }
});

// Handle app protocol (for deep linking if needed)
app.setAsDefaultProtocolClient('campfire-widget');
