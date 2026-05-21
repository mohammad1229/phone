const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let activeDb = null;
let syncTimeout = null;
let isSyncing = false;

// Load local .env manually if it exists (for local development and testing)
const dotenvPath = path.join(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
  const content = fs.readFileSync(dotenvPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'phone-care-db';

function setDatabaseInstance(dbInstance) {
  activeDb = dbInstance;
}

/**
 * Downloads database from Supabase Storage synchronously on server start
 */
function downloadDbSync() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('📡 [Sync] Supabase config not found. Running in offline/local-only mode.');
    return;
  }

  console.log('📡 [Sync] Supabase configuration found. Starting database restore check...');
  try {
    const helperPath = path.join(__dirname, 'download_db.js');
    execSync(`node "${helperPath}"`, { 
      stdio: 'inherit', 
      env: { ...process.env, USER_DATA_PATH: process.env.USER_DATA_PATH } 
    });
  } catch (err) {
    console.error('❌ [Sync] Synchronous database download subprocess failed:', err.message);
  }
}

/**
 * Ensures bucket exists in Supabase Storage. Creates it if missing.
 */
async function ensureBucketExists() {
  const checkUrl = `${SUPABASE_URL}/storage/v1/bucket/${BUCKET_NAME}`;
  try {
    const checkRes = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      }
    });

    if (checkRes.status === 200) {
      return; // Bucket exists
    }

    console.log(`📡 [Sync] Bucket "${BUCKET_NAME}" not found. Creating it...`);
    const createUrl = `${SUPABASE_URL}/storage/v1/bucket`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: BUCKET_NAME,
        name: BUCKET_NAME,
        public: false
      })
    });

    if (createRes.ok) {
      console.log(`✅ [Sync] Bucket "${BUCKET_NAME}" created successfully.`);
    } else {
      const errText = await createRes.text();
      console.warn(`⚠️ [Sync] Bucket creation API returned status ${createRes.status}: ${errText}`);
    }
  } catch (e) {
    console.error('❌ [Sync] Error checking/creating bucket:', e.message);
  }
}

/**
 * Synchronizes the database file to Supabase Storage by creating an online backup
 */
async function uploadDbToCloud() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !activeDb) return;
  if (isSyncing) {
    // If already syncing, schedule another check soon
    scheduleDbSync();
    return;
  }

  isSyncing = true;
  console.log('📡 [Sync] Creating database backup and replicating to Supabase...');

  const DB_DIR = process.env.USER_DATA_PATH || path.join(__dirname, 'data');
  const tempBackupPath = path.join(DB_DIR, `mobileshop_temp_backup.db`);

  try {
    // 1. Create a safe online backup copy to prevent locking issues
    await activeDb.backup(tempBackupPath);

    // 2. Ensure the bucket exists
    await ensureBucketExists();

    // 3. Read the backup file
    const fileBuffer = fs.readFileSync(tempBackupPath);

    // 4. Upload file to Supabase Storage
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/mobileshop.db`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'x-upsert': 'true',
        'Content-Type': 'application/octet-stream'
      },
      body: fileBuffer
    });

    if (uploadRes.ok) {
      console.log('✅ [Sync] Database successfully replicated to cloud storage!');
    } else {
      const errText = await uploadRes.text();
      console.error(`❌ [Sync] Replication failed with status ${uploadRes.status}: ${errText}`);
    }
  } catch (err) {
    console.error('❌ [Sync] Error during database replication:', err.message);
  } finally {
    // Clean up temporary backup file
    if (fs.existsSync(tempBackupPath)) {
      try {
        fs.unlinkSync(tempBackupPath);
      } catch (e) {}
    }
    isSyncing = false;
  }
}

/**
 * Debounces database upload requests to avoid overwhelming the cloud API
 */
function scheduleDbSync() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  
  if (syncTimeout) clearTimeout(syncTimeout);
  
  syncTimeout = setTimeout(() => {
    uploadDbToCloud().catch(err => {
      console.error('❌ [Sync] Background upload handler crashed:', err.message);
    });
  }, 3000); // 3-second debounce window
}

/**
 * Uploads any custom file (like shop logo) to Supabase Storage and returns its public URL
 */
async function uploadLogoToCloud(fileBuffer, originalName, mimeType) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  try {
    await ensureBucketExists();
    
    const ext = path.extname(originalName) || '.png';
    const fileName = `logo_${Date.now()}${ext}`;
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${fileName}`;
    
    console.log(`📡 [Sync] Uploading logo: ${fileName} to Supabase...`);
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'x-upsert': 'true',
        'Content-Type': mimeType
      },
      body: fileBuffer
    });

    if (uploadRes.ok) {
      // Return public URL (Make sure bucket permits public access or we construct URL format)
      // Supabase storage public URL format:
      // ${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fileName}
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
      console.log(`✅ [Sync] Logo uploaded successfully! URL: ${publicUrl}`);
      return publicUrl;
    } else {
      const errText = await uploadRes.text();
      console.error(`❌ [Sync] Logo upload failed: ${errText}`);
      return null;
    }
  } catch (err) {
    console.error('❌ [Sync] Error uploading logo to Supabase:', err.message);
    return null;
  }
}

module.exports = {
  setDatabaseInstance,
  downloadDbSync,
  uploadDbToCloud,
  scheduleDbSync,
  uploadLogoToCloud
};
