const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { 
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  mainWindow.maximize();
  mainWindow.loadFile('index.html');

  // Check for updates after window is ready
  mainWindow.webContents.once('did-finish-load', () => {
    console.log('Window loaded, checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
  });
}

// Auto Updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;
autoUpdater.fullChangelog = true;

// Add logging
autoUpdater.logger = {
  info: (message) => console.log('Updater Info:', message),
  error: (message) => console.error('Updater Error:', message),
  warn: (message) => console.warn('Updater Warning:', message),
};

// Event handlers with better error handling
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for updates...');
  mainWindow.webContents.send('update-status', 'Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info);
  mainWindow.webContents.send('update-available', info);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `A new version ${info.version} is available. Downloading now...`,
    buttons: ['OK']
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('No updates available:', info);
  mainWindow.webContents.send('update-not-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info);
  mainWindow.webContents.send('update-downloaded', info);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: `Update downloaded. Application will restart to install version ${info.version}.`,
    buttons: ['Restart Now', 'Later']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log('Download progress:', progressObj);
  mainWindow.webContents.send('download-progress', progressObj);
});

autoUpdater.on('error', (error) => {
  console.error('Update error:', error);
  mainWindow.webContents.send('update-error', error.toString());
  
  // Don't show error for "no update available" errors
  if (!error.message.includes('No published versions') && !error.message.includes('404')) {
    dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'Update Error',
      message: `Failed to check for updates: ${error.message}`,
      buttons: ['OK']
    });
  }
});

// IPC handlers for UI updates
ipcMain.handle('check-for-updates', () => {
  return autoUpdater.checkForUpdates();
});

ipcMain.handle('restart-and-install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});