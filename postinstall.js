const { execSync } = require('child_process');

if (!process.env.RENDER) {
  console.log('📡 Local environment detected. Running electron-builder install-app-deps...');
  try {
    execSync('electron-builder install-app-deps', { stdio: 'inherit' });
  } catch (err) {
    console.error('⚠️ Failed to install Electron dependencies:', err.message);
  }
} else {
  console.log('📡 Render environment detected. Skipping electron-builder installation scripts.');
}
