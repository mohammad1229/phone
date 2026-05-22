const fs = require('fs');
const path = require('path');

// Load env variables if they aren't loaded
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

async function download() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('📡 [Sync Subprocess] Supabase config missing. Skipping cloud restore.');
    process.exit(0);
  }

  const DB_DIR = process.env.USER_DATA_PATH || path.join(__dirname, 'data');
  const DB_PATH = path.join(DB_DIR, 'mobileshop.db');

  console.log(`📡 [Sync Subprocess] Checking for cloud database at: ${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET_NAME}/mobileshop.db`);
  try {
    const url = `${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET_NAME}/mobileshop.db`;
    console.log(`📡 [Sync Subprocess] URL=${process.env.SUPABASE_URL} KEY=${process.env.SUPABASE_KEY ? 'present' : 'missing'}`);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY
      },
      signal: AbortSignal.timeout(15000)
    });

    if (res.status === 200) {
      const buffer = await res.arrayBuffer();
      // Ensure data directory exists
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, Buffer.from(buffer));
      console.log('✅ [Sync Subprocess] Database successfully downloaded and restored locally!');
    } else if (res.status === 404) {
      console.log('ℹ️ [Sync Subprocess] No existing database found on Supabase. A new database will be created and uploaded on the next write operation.');
    } else {
      const errText = await res.text();
      console.error(`⚠️ [Sync Subprocess] Failed to download database. Status: ${res.status}. Error: ${errText}`);
    }
  } catch (err) {
    console.error('❌ [Sync Subprocess] Network or file error while downloading database:', err);
  }
  process.exit(0);
}

download();
