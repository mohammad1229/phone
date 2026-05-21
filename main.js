const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;
let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 350,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
    icon: path.join(__dirname, 'public', 'phone_care_logo.png'),
    webPreferences: {
      nodeIntegration: false
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'public', 'splash.html')).catch(err => {
    console.log('Error loading splash file:', err);
  });

  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'gonet phone',
    autoHideMenuBar: true,
    show: false, // Hidden until ready
    icon: path.join(__dirname, 'public', 'phone_care_logo.png'),
    webPreferences: {
      nodeIntegration: false
    }
  });

  // Load local server URL
  mainWindow.loadURL('http://localhost:3000').catch(err => {
    console.log('Error loading URL:', err);
  });

  // Once loaded, allow the splash animation to show fully, then transition
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (splashWindow) {
        splashWindow.close();
      }
      mainWindow.show();
      mainWindow.focus();
    }, 2500); // 2.5 seconds duration
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Pass AppData path to server.js for safe SQLite storage
  process.env.USER_DATA_PATH = app.getPath('userData');
  
  // Start Express server within Electron
  try {
    require('./server.js');
  } catch (err) {
    dialog.showErrorBox('خطأ في تشغيل السيرفر', 'حدث خطأ أثناء تحميل السيرفر المحلي: ' + err.message);
  }

  createSplashWindow();
  createMainWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });

  // Setup Auto Updater
  setupAutoUpdater();
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.log("Error checking for updates:", err);
  });

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info',
      title: 'تحديث جديد متاح',
      message: 'يتوفر تحديث جديد للبرنامج (الإصدار ' + info.version + '). جاري تحميله في الخلفية...',
      buttons: ['حسناً']
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'question',
      title: 'اكتمل تحميل التحديث',
      message: 'تم تحميل التحديث بنجاح. هل تريد إغلاق البرنامج وتثبيت التحديث الآن؟',
      buttons: ['تثبيت الآن', 'لاحقاً']
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });
}

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
