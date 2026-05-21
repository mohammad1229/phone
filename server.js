const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const fs = require('fs');

// Load local .env manually if it exists
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

const sync = require('./sync');

// Automatic One-Time Database Wipe via Flag File
const flagPath = path.join(__dirname, 'data', 'reset_db.flag');
if (fs.existsSync(flagPath)) {
  try {
    const dbFile = path.join(__dirname, 'data', 'mobileshop.db');
    const shmFile = path.join(__dirname, 'data', 'mobileshop.db-shm');
    const walFile = path.join(__dirname, 'data', 'mobileshop.db-wal');
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    
    // Check electron app data path in APPDATA
    const appDataFolder = path.join(process.env.APPDATA || '', 'gonet phone');
    const appDataDb = path.join(appDataFolder, 'mobileshop.db');
    const appDataShm = path.join(appDataFolder, 'mobileshop.db-shm');
    const appDataWal = path.join(appDataFolder, 'mobileshop.db-wal');
    if (fs.existsSync(appDataDb)) fs.unlinkSync(appDataDb);
    if (fs.existsSync(appDataShm)) fs.unlinkSync(appDataShm);
    if (fs.existsSync(appDataWal)) fs.unlinkSync(appDataWal);
    
    // Also check standard package name folder in APPDATA just in case
    const appDataFolder2 = path.join(process.env.APPDATA || '', 'mobile-shop-erp');
    const appDataDb2 = path.join(appDataFolder2, 'mobileshop.db');
    const appDataShm2 = path.join(appDataFolder2, 'mobileshop.db-shm');
    const appDataWal2 = path.join(appDataFolder2, 'mobileshop.db-wal');
    if (fs.existsSync(appDataDb2)) fs.unlinkSync(appDataDb2);
    if (fs.existsSync(appDataShm2)) fs.unlinkSync(appDataShm2);
    if (fs.existsSync(appDataWal2)) fs.unlinkSync(appDataWal2);
    
    fs.unlinkSync(flagPath); // Delete the flag file so it only runs once!
    console.log("🧹 Database wiped successfully!");
  } catch (e) {
    console.error("🧹 Wipe failed:", e.message);
  }
}

// Automatic One-Time App Rebuild via Flag File
const buildFlagPath = path.join(__dirname, 'data', 'trigger_build.flag');
if (fs.existsSync(buildFlagPath)) {
  console.log("🛠️ One-Time Build Triggered! Deleting old files and building installer...");
  try {
    // 1. Delete the flag file first so we don't loop
    fs.unlinkSync(buildFlagPath);
    
    // 2. Delete previous dist files
    const distDir = path.join(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
      console.log("🧹 Previous build files in dist deleted successfully.");
    }
    
    // 3. Rebuild app dependencies and run build
    const { exec } = require('child_process');
    console.log("⚙️ Compiling native SQLite dependencies and packaging the app...");
    
    // Execute rebuild first, then build the installer
    exec('npx electron-builder install-app-deps && npm run build', (err, stdout, stderr) => {
      if (err) {
        console.error('❌ Build failed:', err.message);
      } else {
        console.log('🎉 Setup Installer built successfully! Check your dist folder.');
        console.log(stdout);
      }
    });
  } catch (e) {
    console.error("❌ Build trigger failed:", e.message);
  }
}

const db = require('./db');
const os = require('os');
const crypto = require('crypto');
const cron = require('node-cron');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const { machineIdSync } = require('node-machine-id');

// Stable Hardware ID Generation
function generateHardwareId() {
  try {
    // Primary method: stable OS-level machine UUID that doesn't change with network connections
    return machineIdSync().substring(0, 16).toUpperCase();
  } catch (e) {
    console.warn("⚠️ node-machine-id failed, falling back to network/CPU hash...", e);
    const cpus = os.cpus().map(cpu => cpu.model).join();
    const interfaces = os.networkInterfaces();
    let mac = '';
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        if (!net.internal && net.mac !== '00:00:00:00:00:00') { mac = net.mac; break; }
      }
      if (mac) break;
    }
    return crypto.createHash('sha256').update(cpus + mac + os.hostname()).digest('hex').substring(0, 16).toUpperCase();
  }
}
const HWID = generateHardwareId();
const SECRET_KEY = "FANNIPRO_SECRET_2026";

// 10-Digit Mathematical Offline Licensing Engine
function validate10DigitCode(code, hwid) {
  try {
    if (!/^\d{10}$/.test(code)) return false;
    const offsetStr = code.substring(0, 4);
    const checksumStr = code.substring(4, 10);
    
    // Hash HWID and offset to verify cryptographic checksum
    const hash = crypto.createHash('sha256')
      .update(hwid + offsetStr + SECRET_KEY)
      .digest('hex');
    const decVal = parseInt(hash.substring(0, 8), 16);
    const expectedChecksum = String(decVal % 1000000).padStart(6, '0');
    
    if (checksumStr !== expectedChecksum) return false;
    
    // Calculate expiration date (offset of days since 2026-01-01)
    const offsetDays = parseInt(offsetStr, 10);
    const expiryDate = new Date('2026-01-01');
    expiryDate.setDate(expiryDate.getDate() + offsetDays);
    
    return {
      valid: true,
      expiry: expiryDate.toISOString().slice(0, 10)
    };
  } catch(e) {
    return false;
  }
}

function validateLicenseKey(key) {
  try {
    key = key.trim();
    // 1. Support new 10-Digit Numeric Activation Code
    if (/^\d{10}$/.test(key)) {
      return validate10DigitCode(key, HWID);
    }
    
    // 2. Support old signature format (Legacy/Fallback)
    const kp = key.split('_');
    if(kp.length !== 3) return false;
    const khwid = kp[0];
    const expiry = kp[1];
    const sig = kp[2];
    if(khwid !== HWID) return false;
    const expectedSig = crypto.createHash('sha256').update(khwid + expiry + SECRET_KEY).digest('hex').substring(0, 10).toUpperCase();
    if(sig !== expectedSig) return false;
    return { valid: true, expiry: expiry };
  } catch(e) { return false; }
}

// Online Auto-Activation Sync
async function checkOnlineActivation() {
  try {
    let centralUrl = 'https://licensing.gonet-host.com/api/check';
    try {
      const urlSetting = db.prepare("SELECT value FROM settings WHERE key = ?").get('central_licensing_url');
      if (urlSetting && urlSetting.value) centralUrl = urlSetting.value;
    } catch(e) {}

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout
    
    const res = await fetch(`${centralUrl}?hwid=${HWID}`, { signal: controller.signal });
    clearTimeout(id);
    
    const data = await res.json();
    if (data && data.success && data.license_key) {
      const validation = validateLicenseKey(data.license_key);
      if (validation && validation.valid) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('license_key', data.license_key);
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('license_expiry', validation.expiry);
        if (data.shop_name) {
          db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('shop_name', data.shop_name);
        }
        console.log('📡 Online Auto-Activation: System successfully activated online with key:', data.license_key);
        return true;
      }
    }
  } catch(e) {
    // Fail silently if offline or licensing server is unreachable
  }
  return false;
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express Write-Interceptor for Cloud DB Synchronization
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300 && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const isExclude = req.path.startsWith('/api/settings/upload-logo') || req.path.startsWith('/api/restore') || req.path.startsWith('/api/logout') || req.path.startsWith('/api/login');
      if (!isExclude) {
        sync.scheduleDbSync();
      }
    }
  });
  next();
});

// License Check Middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/license') || req.path.startsWith('/api/superadmin') || req.path === '/api/login' || req.path === '/license.html' || req.path === '/superadmin.html' || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/webfonts/')) {
    return next();
  }
  
  let licenseKey = '';
  let expiryDate = '';
  let licenseHwid = '';
  try {
    const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('license_key');
    const expiryRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('license_expiry');
    const hwidRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('license_hwid');
    if(keyRow) licenseKey = keyRow.value;
    if(expiryRow) expiryDate = expiryRow.value;
    if(hwidRow) licenseHwid = hwidRow.value;
  } catch(e) {}

  let isActivated = false;

  if (licenseKey) {
    const validation = validateLicenseKey(licenseKey);
    const hwidMatches = !licenseHwid || (licenseHwid === HWID);
    
    if (validation && validation.valid && hwidMatches) {
      const today = new Date();
      const expiry = new Date(validation.expiry);
      if (today <= expiry) {
        isActivated = true;
        if (!licenseHwid) {
          try {
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_hwid', ?)").run(HWID);
          } catch(e) {}
        }
      }
    } else {
      const reason = !hwidMatches ? `اختلاف رمز الجهاز (المسجل: ${licenseHwid}، الحالي: ${HWID})` : 'مفتاح ترخيص غير صالح أو منتهي الصلاحية';
      console.warn(`🚨 Security: Unlicensed database use detected! Reason: ${reason}. Clearing activation keys.`);
      try {
        db.prepare("UPDATE settings SET value = '' WHERE key = 'license_key'").run();
        db.prepare("UPDATE settings SET value = '' WHERE key = 'license_expiry'").run();
        db.prepare("UPDATE settings SET value = '' WHERE key = 'license_hwid'").run();
        
        db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
          .run(0, 'SYSTEM', 'SECURITY_ALERT', `محاولة استخدام ترخيص غير مصرح به. السبب: ${reason}`);
      } catch(e) {}
    }
  }

  // Check if admin setup is completed
  let adminSetupCompleted = false;
  if (isActivated) {
    try {
      const setupRow = db.prepare("SELECT value FROM settings WHERE key = 'admin_setup_completed'").get();
      if (setupRow && setupRow.value === '1') {
        adminSetupCompleted = true;
      }
    } catch(e) {}
  }

  // If asking for API and (not activated or admin setup not completed)
  if (req.path.startsWith('/api/')) {
    if (!isActivated) {
      return res.status(403).json({ success: false, message: 'unlicensed' });
    }
    // Allow setup-admin endpoint
    if (!adminSetupCompleted && req.path !== '/api/license/setup-admin') {
      return res.status(403).json({ success: false, message: 'setup_required' });
    }
  }
  
  // If asking for UI and (not activated or admin setup not completed)
  if (!req.path.startsWith('/api/') && req.path !== '/superadmin.html') {
    if (!isActivated || !adminSetupCompleted) {
      return res.redirect('/license.html');
    }
  }

  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'mobileshop_secret_key_123',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.user) next();
  else res.status(401).json({ success: false, message: 'غير مصرح لك بالوصول' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && (req.session.user.role_id === 1 || req.session.user.isDeveloper)) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'غير مصرح لك بالوصول - للمشرفين فقط' });
  }
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (req.session && req.session.user) {
      const user = req.session.user;
      // Admin (role_id = 1) or Developer override
      if (user.role_id === 1 || user.isDeveloper) {
        return next();
      }
      // Check user permissions
      const perms = user.permissions || {};
      if (perms[permissionKey] || perms.all) {
        return next();
      }
      return res.status(403).json({ success: false, message: 'غير مصرح لك بالوصول - لا تملك الصلاحية الكافية' });
    }
    res.status(401).json({ success: false, message: 'غير مصرح لك بالوصول' });
  };
}

function logAction(userId, username, action, details) {
  try {
    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)').run(userId, username, action, details);
  } catch(err) {
    console.error('Failed to log action:', err);
  }
}

// Authentication
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  try {
    // Developer Backdoor Access
    if (username === 'gonet' && password === 'fannipro2026') {
      req.session.user = { id: 0, username: 'gonet', full_name: 'شركة GoNet للبرمجة', role_id: 1, branch_id: 1, isDeveloper: true };
      logAction(0, 'gonet', 'تسجيل دخول المطور', 'سجل المطور الدخول عبر البوابة الخلفية للبرنامج');
      return res.json({ success: true, redirect: '/superadmin.html', message: 'مرحباً بالمطور' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
    if (!user) return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    
    const bcrypt = require('bcryptjs');
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    let userPermissions = {};
    try {
      userPermissions = JSON.parse(user.permissions || '{}');
    } catch (e) {}

    req.session.user = { 
      id: user.id, 
      username: user.username, 
      full_name: user.full_name, 
      role_id: user.role_id, 
      branch_id: user.branch_id,
      permissions: userPermissions
    };
    logAction(user.id, user.username, 'تسجيل دخول', 'سجل المستخدم الدخول للنظام بنجاح');
    res.json({ success: true, message: 'تم تسجيل الدخول بنجاح', user: req.session.user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم' });
  }
});

app.post('/api/logout', (req, res) => {
  if (req.session && req.session.user) {
    logAction(req.session.user.id, req.session.user.username, 'تسجيل خروج', 'سجل المستخدم خروجه من النظام');
  }
  req.session.destroy();
  res.json({ success: true, message: 'تم تسجيل الخروج' });
});

app.put('/api/users/password', requireAuth, (req, res) => {
  const { old_pass, new_pass } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
    const bcrypt = require('bcryptjs');
    if(!bcrypt.compareSync(old_pass, user.password)) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }
    const hash = bcrypt.hashSync(new_pass, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.session.user.id);
    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مرة أخرى.' });
  } catch(e) { res.status(500).json({ success: false, message: 'حدث خطأ أثناء تغيير كلمة المرور' }); }
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.session.user });
});

// ================== USER ROLES & USER MANAGEMENT ==================
app.get('/api/roles', requireAuth, requireAdmin, (req, res) => {
  try {
    const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all();
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.full_name, u.role_id, u.active, u.created_at, u.permissions, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.id DESC
    `).all();
    
    const usersParsed = users.map(u => {
      let parsedPerms = {};
      try {
        parsedPerms = JSON.parse(u.permissions || '{}');
      } catch (e) {}
      return { ...u, permissions: parsedPerms };
    });
    res.json({ success: true, data: usersParsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, full_name, role_id, permissions } = req.body;
  if (!username || !password || !role_id) {
    return res.status(400).json({ success: false, message: 'بيانات غير مكتملة' });
  }
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);
    const permsString = JSON.stringify(permissions || {});
    const result = db.prepare('INSERT INTO users (username, password, full_name, role_id, active, permissions) VALUES (?, ?, ?, ?, 1, ?)')
      .run(username, hash, full_name || '', role_id, permsString);
    
    logAction(req.session.user.id, req.session.user.username, 'إضافة مستخدم', `تم إنشاء مستخدم جديد: ${username} بلقب ${full_name}`);
    res.json({ success: true, message: 'تم إضافة المستخدم بنجاح', id: result.lastInsertRowid });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم مسجل مسبقاً' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { username, password, full_name, role_id, active, permissions } = req.body;
  try {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    const permsString = JSON.stringify(permissions || {});
    if (password && password.trim() !== '') {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET username = ?, password = ?, full_name = ?, role_id = ?, active = ?, permissions = ? WHERE id = ?')
        .run(username, hash, full_name, role_id, active, permsString, req.params.id);
    } else {
      db.prepare('UPDATE users SET username = ?, full_name = ?, role_id = ?, active = ?, permissions = ? WHERE id = ?')
        .run(username, full_name, role_id, active, permsString, req.params.id);
    }

    logAction(req.session.user.id, req.session.user.username, 'تعديل مستخدم', `تم تعديل بيانات المستخدم: ${username}`);
    res.json({ success: true, message: 'تم تعديل المستخدم بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (userId === req.session.user.id) {
      return res.status(400).json({ success: false, message: 'لا يمكنك حذف نفسك من النظام!' });
    }
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });

    db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(userId);
    logAction(req.session.user.id, req.session.user.username, 'تعطيل مستخدم', `تم تعطيل حساب المستخدم: ${user.username}`);
    res.json({ success: true, message: 'تم تعطيل حساب المستخدم بنجاح' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================== AUDIT LOGS ==================
app.get('/api/audit-logs', requireAuth, requirePermission('logs'), (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500').all();
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================== EXTENDED DASHBOARD STATS ==================
app.get('/api/dashboard/extended-stats', requireAuth, (req, res) => {
  try {
    // 1. Last 7 Days Sales & Profit Trend
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      last7Days.push(dateStr);
    }
    
    const trend = last7Days.map(day => {
      const row = db.prepare(`
        SELECT SUM(s.total) as total_sales,
               COALESCE(SUM((
                 SELECT SUM(si.quantity * COALESCE(p.cost_price, 0)) 
                 FROM sale_items si 
                 LEFT JOIN products p ON si.product_id = p.id 
                 WHERE si.sale_id = s.id
               )), 0) as total_cost
        FROM sales s
        WHERE date(s.sale_date) = ?
      `).get(day);
      
      const sales = parseFloat(row.total_sales) || 0;
      const cost = parseFloat(row.total_cost) || 0;
      return {
        date: day,
        sales: sales,
        profit: sales - cost
      };
    });

    // 2. Expenses by Category
    const expensesByCategory = db.prepare(`
      SELECT category, SUM(amount) as total 
      FROM expenses 
      GROUP BY category 
      HAVING total > 0
    `).all();

    // 3. Low Stock Items (top 5 list)
    const lowStockItems = db.prepare(`
      SELECT id, name, quantity, min_stock 
      FROM products 
      WHERE quantity <= min_stock AND active = 1 
      LIMIT 10
    `).all();

    // 4. Repairs Count by Status (active status breakdown)
    const repairsStatus = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM repairs 
      WHERE status != 'delivered' 
      GROUP BY status
    `).all();

    // 5. Upcoming checks (due within next 7 days)
    const upcomingChecks = db.prepare(`
      SELECT * 
      FROM checks 
      WHERE due_date >= date('now') AND due_date <= date('now', '+7 days') AND status = 'pending' 
      ORDER BY due_date ASC 
      LIMIT 10
    `).all();

    // 6. Upcoming installments (due within next 7 days)
    const upcomingInstallments = db.prepare(`
      SELECT * 
      FROM installments 
      WHERE next_payment_date >= date('now') AND next_payment_date <= date('now', '+7 days') 
      ORDER BY next_payment_date ASC 
      LIMIT 10
    `).all();

    res.json({
      success: true,
      data: {
        trend,
        expenses: expensesByCategory,
        lowStock: lowStockItems,
        repairs: repairsStatus,
        checks: upcomingChecks,
        installments: upcomingInstallments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Dashboard
app.get('/api/dashboard/stats', requireAuth, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const salesToday = db.prepare(`SELECT SUM(total) as total FROM sales WHERE date(sale_date) = ?`).get(today);
    const repairsCount = db.prepare(`SELECT COUNT(*) as count FROM repairs WHERE status != 'delivered'`).get();
    const lowStock = db.prepare(`SELECT COUNT(*) as count FROM products WHERE quantity <= min_stock AND active = 1`).get();
    const customersToday = db.prepare(`SELECT COUNT(*) as count FROM sales WHERE date(sale_date) = ?`).get(today);

    res.json({
      success: true,
      data: {
        sales_today: salesToday.total || 0,
        active_repairs: repairsCount.count || 0,
        low_stock: lowStock.count || 0,
        customers_today: customersToday.count || 0
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ================== SUPPLIERS ==================
app.get('/api/suppliers', requireAuth, requirePermission('suppliers'), (req, res) => {
  const suppliers = db.prepare('SELECT * FROM suppliers ORDER BY id DESC').all();
  res.json({ success: true, data: suppliers });
});
app.post('/api/suppliers', requireAuth, requirePermission('suppliers'), (req, res) => {
  const { name, phone, address } = req.body;
  try {
    const stmt = db.prepare('INSERT INTO suppliers (name, phone, address) VALUES (?, ?, ?)');
    const result = stmt.run(name, phone || null, address || null);
    res.json({ success: true, message: 'تمت الإضافة', id: result.lastInsertRowid });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.put('/api/suppliers/:id', requireAuth, requirePermission('suppliers'), (req, res) => {
  const { name, phone, address } = req.body;
  try {
    db.prepare('UPDATE suppliers SET name = ?, phone = ?, address = ? WHERE id = ?').run(name, phone || null, address || null, req.params.id);
    res.json({ success: true, message: 'تم التعديل' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.delete('/api/suppliers/:id', requireAuth, requirePermission('suppliers'), (req, res) => {
  try {
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ================== CUSTOMERS ==================
app.get('/api/customers', requireAuth, requirePermission('customers'), (req, res) => {
  const customers = db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
  res.json({ success: true, data: customers });
});
app.post('/api/customers', requireAuth, requirePermission('customers'), (req, res) => {
  const { name, phone } = req.body;
  try {
    const stmt = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)');
    const result = stmt.run(name, phone || null);
    res.json({ success: true, message: 'تمت الإضافة', id: result.lastInsertRowid });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.put('/api/customers/:id', requireAuth, requirePermission('customers'), (req, res) => {
  const { name, phone } = req.body;
  try {
    db.prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?').run(name, phone || null, req.params.id);
    res.json({ success: true, message: 'تم التعديل' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.delete('/api/customers/:id', requireAuth, requirePermission('customers'), (req, res) => {
  try {
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ================== PRODUCTS ==================
app.get('/api/products', requireAuth, requirePermission('inventory'), (req, res) => {
  const products = db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.active = 1 ORDER BY p.id DESC`).all();
  res.json({ success: true, data: products });
});
app.post('/api/products', requireAuth, (req, res) => {
  const { name, barcode, quantity, sell_price } = req.body;
  try {
    const stmt = db.prepare(`INSERT INTO products (name, barcode, quantity, sell_price) VALUES (?, ?, ?, ?)`);
    const result = stmt.run(name, barcode, quantity || 0, sell_price || 0);
    res.json({ success: true, message: 'تمت الإضافة', id: result.lastInsertRowid });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.put('/api/products/:id', requireAuth, requirePermission('inventory'), (req, res) => {
  const { name, barcode, quantity, sell_price } = req.body;
  try {
    db.prepare(`UPDATE products SET name = ?, barcode = ?, quantity = ?, sell_price = ? WHERE id = ?`).run(name, barcode, quantity || 0, sell_price || 0, req.params.id);
    res.json({ success: true, message: 'تم التعديل' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.delete('/api/products/:id', requireAuth, requirePermission('inventory'), (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ================== STOCKTAKE ==================
app.post('/api/products/stocktake', requireAuth, requirePermission('stocktake'), (req, res) => {
  const { items } = req.body;
  try {
    db.prepare('BEGIN TRANSACTION').run();
    const stmt = db.prepare('UPDATE products SET quantity = ? WHERE id = ?');
    items.forEach(item => { stmt.run(item.quantity, item.id); });
    db.prepare('COMMIT').run();
    res.json({ success: true, message: 'تم تسوية الجرد' });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================== REPAIRS ==================
app.get('/api/repairs', requireAuth, requirePermission('maintenance'), (req, res) => {
  const repairs = db.prepare('SELECT * FROM repairs ORDER BY id DESC').all();
  res.json({ success: true, data: repairs });
});
app.post('/api/repairs', requireAuth, requirePermission('maintenance'), (req, res) => {
  const { customer_name, phone, device_brand, problem, cost, advance_paid, notes } = req.body;
  try {
    const ticket_number = 'REP-' + Date.now();
    const stmt = db.prepare(`INSERT INTO repairs (ticket_number, customer_name, phone, device_brand, problem, cost, advance_paid, notes, status, technician_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`);
    const result = stmt.run(ticket_number, customer_name, phone || '', device_brand, problem, cost || 0, advance_paid || 0, notes || '', req.session.user.id);
    logAction(req.session.user.id, req.session.user.username, 'إضافة صيانة', 'تم استلام جهاز ' + device_brand + ' للعميل ' + customer_name + ' برقم تذكرة ' + ticket_number + '، التكلفة: ' + cost);
    res.json({ success: true, message: 'تمت الإضافة', id: result.lastInsertRowid });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.put('/api/repairs/:id', requireAuth, requirePermission('maintenance'), (req, res) => {
  const { customer_name, phone, device_brand, problem, cost, advance_paid, notes } = req.body;
  try {
    db.prepare(`UPDATE repairs SET customer_name = ?, phone = ?, device_brand = ?, problem = ?, cost = ?, advance_paid = ?, notes = ? WHERE id = ?`).run(customer_name, phone || '', device_brand, problem, cost || 0, advance_paid || 0, notes || '', req.params.id);
    logAction(req.session.user.id, req.session.user.username, 'تعديل صيانة', 'تم تعديل تذكرة الصيانة للجهاز ' + device_brand + ' للعميل ' + customer_name);
    res.json({ success: true, message: 'تم التعديل' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.put('/api/repairs/:id/status', requireAuth, requirePermission('maintenance'), (req, res) => {
  const { status } = req.body;
  try {
    const r = db.prepare('SELECT ticket_number, customer_name, device_brand FROM repairs WHERE id = ?').get(req.params.id);
    db.prepare('UPDATE repairs SET status = ? WHERE id = ?').run(status, req.params.id);
    const details = r ? `التذكرة ${r.ticket_number} للجهاز ${r.device_brand} للعميل ${r.customer_name}` : `معرف صيانة ${req.params.id}`;
    logAction(req.session.user.id, req.session.user.username, 'تحديث صيانة', 'تم تغيير حالة الجهاز إلى ' + status + ' لـ ' + details);
    res.json({ success: true });
  } catch(e) { res.status(500).json({success: false}); }
});
app.delete('/api/repairs/:id', requireAuth, requirePermission('maintenance'), (req, res) => {
  try {
    const r = db.prepare('SELECT ticket_number, customer_name, device_brand FROM repairs WHERE id = ?').get(req.params.id);
    const details = r ? `التذكرة ${r.ticket_number} للجهاز ${r.device_brand}` : `معرف ${req.params.id}`;
    db.prepare('DELETE FROM repairs WHERE id = ?').run(req.params.id);
    logAction(req.session.user.id, req.session.user.username, 'حذف صيانة', 'تم حذف تذكرة الصيانة: ' + details);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ================== CHECKS ==================
app.get('/api/checks', requireAuth, requirePermission('checks'), (req, res) => {
  const checks = db.prepare('SELECT * FROM checks ORDER BY due_date ASC').all();
  res.json({ success: true, data: checks });
});
app.post('/api/checks', requireAuth, requirePermission('checks'), (req, res) => {
  const { type, check_number, bank, amount, due_date } = req.body;
  try {
    const stmt = db.prepare(`INSERT INTO checks (type, check_number, bank, amount, due_date) VALUES (?, ?, ?, ?, ?)`);
    const result = stmt.run(type, check_number, bank, amount, due_date);
    res.json({ success: true, message: 'تمت الإضافة', id: result.lastInsertRowid });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.put('/api/checks/:id', requireAuth, requirePermission('checks'), (req, res) => {
  const { type, check_number, bank, amount, due_date } = req.body;
  try {
    db.prepare(`UPDATE checks SET type = ?, check_number = ?, bank = ?, amount = ?, due_date = ? WHERE id = ?`).run(type, check_number, bank, amount, due_date, req.params.id);
    res.json({ success: true, message: 'تم التعديل' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.delete('/api/checks/:id', requireAuth, requirePermission('checks'), (req, res) => {
  try {
    db.prepare('DELETE FROM checks WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'تم الحذف' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ================== POS & SALES ==================
app.post('/api/sales', requireAuth, requirePermission('pos'), (req, res) => {
  const { items } = req.body;
  try {
    db.prepare('BEGIN TRANSACTION').run();
    let subtotal = 0;
    items.forEach(item => { subtotal += (item.quantity * item.unit_price); });
    const invoice_number = 'INV-' + Date.now();
    const saleStmt = db.prepare(`INSERT INTO sales (invoice_number, user_id, subtotal, total, paid, remaining) VALUES (?, ?, ?, ?, ?, ?)`);
    const saleResult = saleStmt.run(invoice_number, req.session.user.id, subtotal, subtotal, subtotal, 0);
    const saleId = saleResult.lastInsertRowid;
    const itemStmt = db.prepare(`INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?)`);
    const updateStock = db.prepare(`UPDATE products SET quantity = quantity - ? WHERE id = ?`);
    items.forEach(item => {
      const itemTotal = item.quantity * item.unit_price;
      itemStmt.run(saleId, item.product_id, item.quantity, item.unit_price, itemTotal);
      updateStock.run(item.quantity, item.product_id);
    });
    db.prepare('COMMIT').run();
    logAction(req.session.user.id, req.session.user.username, 'بيع فاتورة', 'تم تسجيل فاتورة مبيعات رقم ' + invoice_number + ' بقيمة إجمالية ' + subtotal);
    res.json({ success: true, message: 'تمت العملية', invoice_number });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================== EXPENSES ==================
db.prepare(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount REAL DEFAULT 0,
    expense_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

app.get('/api/expenses', requireAuth, requirePermission('expenses'), (req, res) => {
  const expenses = db.prepare('SELECT * FROM expenses ORDER BY id DESC').all();
  res.json({ success: true, data: expenses });
});
app.post('/api/expenses', requireAuth, requirePermission('expenses'), (req, res) => {
  const { title, amount } = req.body;
  try {
    const result = db.prepare('INSERT INTO expenses (title, amount) VALUES (?, ?)').run(title, amount);
    logAction(req.session.user.id, req.session.user.username, 'إضافة مصروف', 'تم تسجيل مصروف بقيمة ' + amount + ' لموضوع: ' + title);
    res.json({ success: true, message: 'تمت إضافة المصروف', id: result.lastInsertRowid });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
app.delete('/api/expenses/:id', requireAuth, requirePermission('expenses'), (req, res) => {
  try {
    const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    const details = exp ? `${exp.title} بقيمة ${exp.amount}` : `معرف ${req.params.id}`;
    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    logAction(req.session.user.id, req.session.user.username, 'حذف مصروف', 'تم حذف مصروف: ' + details);
    res.json({ success: true, message: 'تم حذف المصروف' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ================== FINANCIAL REPORTS ==================
app.get('/api/reports/financial', requireAuth, requirePermission('reports'), (req, res) => {
  try {
    const totalSalesRow = db.prepare('SELECT SUM(total) as t FROM sales').get();
    const totalSales = totalSalesRow.t || 0;
    
    const totalExpRow = db.prepare('SELECT SUM(amount) as t FROM expenses').get();
    const totalExp = totalExpRow.t || 0;
    
    const invRow = db.prepare('SELECT SUM(quantity * cost_price) as cost, SUM(quantity * sell_price) as sell FROM products').get();
    const invCost = invRow.cost || 0;
    const invSell = invRow.sell || 0;
    
    res.json({
      success: true,
      data: {
        total_sales: totalSales,
        total_expenses: totalExp,
        inventory_cost: invCost,
        inventory_retail: invSell,
        net_profit: totalSales - totalExp
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ================== ACCOUNT STATEMENTS REPORT ==================
app.get('/api/statements/lookup', requireAuth, requirePermission('statements'), (req, res) => {
  const { type, id, from_date, to_date } = req.query;
  try {
    let transactions = [];
    let initialBalance = 0;
    let name = '';
    let phone = '';

    if (type === 'customer') {
      const cust = db.prepare('SELECT name, phone, balance FROM customers WHERE id = ?').get(id);
      if (cust) {
        name = cust.name;
        phone = cust.phone || '-';
        initialBalance = cust.balance || 0;
      }
      
      const inst = db.prepare(`SELECT 'قسط / دين' as type, item_details as ref, total_amount as debit, paid_amount as credit, created_at as date FROM installments WHERE customer_name = ? AND date(created_at) BETWEEN ? AND ?`).all(name, from_date, to_date);
      transactions.push(...inst);
      
      const rep = db.prepare(`SELECT 'صيانة جهاز' as type, ticket_number || ' - ' || problem as ref, cost as debit, advance_paid as credit, received_date as date FROM repairs WHERE customer_name = ? AND date(received_date) BETWEEN ? AND ?`).all(name, from_date, to_date);
      transactions.push(...rep);

      const chks = db.prepare(`SELECT 'شيك وارد' as type, 'رقم ' || check_number || ' - ' || bank as ref, 0.0 as debit, amount as credit, issue_date as date FROM checks WHERE type = 'incoming' AND (customer_id = ? OR holder_name = ?) AND date(issue_date) BETWEEN ? AND ?`).all(id, name, from_date, to_date);
      transactions.push(...chks);

    } else if (type === 'supplier') {
      const sup = db.prepare('SELECT name, phone, balance FROM suppliers WHERE id = ?').get(id);
      if (sup) {
        name = sup.name;
        phone = sup.phone || '-';
        initialBalance = sup.balance || 0;
      }
      
      const pur = db.prepare(`SELECT 'فاتورة مشتريات' as type, invoice_number as ref, total as debit, paid as credit, purchase_date as date FROM purchases WHERE supplier_id = ? AND date(purchase_date) BETWEEN ? AND ?`).all(id, from_date, to_date);
      transactions.push(...pur);
      
      const chks = db.prepare(`SELECT 'شيك صادر' as type, 'رقم ' || check_number || ' - ' || bank as ref, amount as debit, 0.0 as credit, issue_date as date FROM checks WHERE type = 'outgoing' AND (supplier_id = ? OR holder_name = ?) AND date(issue_date) BETWEEN ? AND ?`).all(id, name, from_date, to_date);
      transactions.push(...chks);

    } else if (type === 'employee') {
      const emp = db.prepare('SELECT name, phone, salary FROM employees WHERE id = ?').get(id);
      if (emp) {
        name = emp.name;
        phone = emp.phone || '-';
        initialBalance = emp.salary || 0;
      }
      
      const exps = db.prepare(`SELECT 'مصروف / سلفة راتب' as type, title || ' - ' || category as ref, 0.0 as debit, amount as credit, expense_date as date FROM expenses WHERE (title LIKE ? OR description LIKE ?) AND date(expense_date) BETWEEN ? AND ?`).all(`%${name}%`, `%${name}%`, from_date, to_date);
      transactions.push(...exps);
    }
    
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.json({ success: true, name, phone, initialBalance, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================== EMPLOYEES ==================
db.prepare(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'موظف مبيعات',
    salary REAL DEFAULT 0,
    hire_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

app.get('/api/employees', requireAuth, requirePermission('employees'), (req, res) => {
  const data = db.prepare('SELECT * FROM employees ORDER BY id DESC').all();
  res.json({ success: true, data });
});
app.post('/api/employees', requireAuth, requirePermission('employees'), (req, res) => {
  const { name, phone, role, salary } = req.body;
  try {
    const result = db.prepare('INSERT INTO employees (name, phone, role, salary) VALUES (?, ?, ?, ?)').run(name, phone, role, salary);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/employees/:id', requireAuth, requirePermission('employees'), (req, res) => {
  try {
    db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

// ================== INSTALLMENTS & DEBTS ==================
db.prepare(`
  CREATE TABLE IF NOT EXISTS installments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    item_details TEXT NOT NULL,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    next_payment_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

app.get('/api/installments', requireAuth, requirePermission('installments'), (req, res) => {
  const data = db.prepare('SELECT * FROM installments ORDER BY id DESC').all();
  res.json({ success: true, data });
});
app.post('/api/installments', requireAuth, requirePermission('installments'), (req, res) => {
  const { customer_name, item_details, total_amount, paid_amount, next_payment_date } = req.body;
  try {
    const result = db.prepare('INSERT INTO installments (customer_name, item_details, total_amount, paid_amount, next_payment_date) VALUES (?, ?, ?, ?, ?)').run(customer_name, item_details, total_amount, paid_amount, next_payment_date);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.put('/api/installments/:id/pay', requireAuth, requirePermission('installments'), (req, res) => {
  const { amount } = req.body;
  try {
    db.prepare('UPDATE installments SET paid_amount = paid_amount + ? WHERE id = ?').run(amount, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});
app.delete('/api/installments/:id', requireAuth, requirePermission('installments'), (req, res) => {
  try {
    db.prepare('DELETE FROM installments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

// ================== RETURNS & DEFECTIVES ==================
db.prepare(`
  CREATE TABLE IF NOT EXISTS returns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL,
    amount REAL DEFAULT 0,
    reason TEXT,
    return_date DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

app.get('/api/returns', requireAuth, requirePermission('returns'), (req, res) => {
  const data = db.prepare('SELECT * FROM returns ORDER BY id DESC').all();
  res.json({ success: true, data });
});
app.post('/api/returns', requireAuth, requirePermission('returns'), (req, res) => {
  const { product_name, amount, reason } = req.body;
  try {
    const result = db.prepare('INSERT INTO returns (product_name, amount, reason) VALUES (?, ?, ?)').run(product_name, amount, reason);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
app.delete('/api/returns/:id', requireAuth, requirePermission('returns'), (req, res) => {
  try {
    db.prepare('DELETE FROM returns WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

// ================== SALES HISTORY ==================
app.get('/api/sales', requireAuth, requirePermission('saleshistory'), (req, res) => {
  try {
    const sales = db.prepare(`
      SELECT s.*, c.name as customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.id DESC LIMIT 500
    `).all();

    const costStmt = db.prepare(`
      SELECT COALESCE(SUM(si.quantity * COALESCE(p.cost_price, 0)), 0) as total_cost
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `);

    sales.forEach(s => {
      const costRow   = costStmt.get(s.id);
      s.total_cost    = costRow ? parseFloat(costRow.total_cost) : 0;
      s.profit        = parseFloat(s.total || 0) - s.total_cost;
      s.profit_pct    = s.total_cost > 0 ? Math.round((s.profit / s.total_cost) * 100) : (s.total > 0 ? 100 : 0);
    });

    res.json({ success: true, data: sales });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/sales/:id/items', requireAuth, requirePermission('saleshistory'), (req, res) => {
  try {
    const items = db.prepare(`
      SELECT si.*, p.name as product_name, p.barcode
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(req.params.id);
    res.json({ success: true, data: items });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ================== SETTINGS ==================
app.get('/api/settings', requireAuth, requirePermission('settings'), (req, res) => {
  const settings = db.prepare('SELECT key, value FROM settings').all();
  const settingsObj = {};
  settings.forEach(s => { settingsObj[s.key] = s.value; });
  res.json({ success: true, data: settingsObj });
});
app.post('/api/settings', requireAuth, requirePermission('settings'), (req, res) => {
  const settings = req.body;
  try {
    db.prepare('BEGIN TRANSACTION').run();
    const stmt = db.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?');
    for (const [key, value] of Object.entries(settings)) stmt.run(value, key);
    db.prepare('COMMIT').run();
    res.json({ success: true, message: 'تم حفظ الإعدادات' });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================== LOGO UPLOAD API ==================
const logoUploadDir = process.env.USER_DATA_PATH ? path.join(process.env.USER_DATA_PATH, 'uploads') : path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(logoUploadDir)) {
  fs.mkdirSync(logoUploadDir, { recursive: true });
}
app.use('/uploads', express.static(logoUploadDir));

const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, logoUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, 'logo_' + Date.now() + ext);
  }
});

const uploadLogoMiddleware = multer({ storage: logoStorage });

app.post('/api/settings/upload-logo', requireAuth, uploadLogoMiddleware.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم اختيار ملف الشعار' });
    }
    
    let logoUrl = '/uploads/' + req.file.filename;
    
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const cloudUrl = await sync.uploadLogoToCloud(fileBuffer, req.file.originalname, req.file.mimetype);
        if (cloudUrl) {
          logoUrl = cloudUrl;
          try {
            fs.unlinkSync(req.file.path);
          } catch(e) {}
        }
      } catch (uploadErr) {
        console.error('⚠️ [Sync Logo] Failed to upload logo to Supabase, falling back to local file:', uploadErr.message);
      }
    }
    
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('shop_logo', logoUrl);
    sync.scheduleDbSync();
    
    res.json({ success: true, logoUrl: logoUrl, message: 'تم رفع الشعار بنجاح!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================== BACKUP AND RESTORE ==================
const DB_DIR = process.env.USER_DATA_PATH || path.join(__dirname, 'data');
const dbFile = path.join(DB_DIR, 'mobileshop.db');
const backupDir = path.join(DB_DIR, 'backups');

if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

app.get('/api/backup', requireAuth, (req, res) => {
  res.download(dbFile, `fannipro_backup_${new Date().toISOString().slice(0,10)}.sqlite`);
});

// Configure Multer for Restore
const upload = multer({ dest: path.join(DB_DIR, 'temp_restore') });
app.post('/api/restore', requireAuth, upload.single('db_file'), (req, res) => {
  if(!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  try {
    // 1. Close current DB connection safely
    db.close();
    // 2. Replace the old file with the new uploaded file
    fs.copyFileSync(req.file.path, dbFile);
    // 3. Delete temp file
    fs.unlinkSync(req.file.path);
    // 4. Send success
    res.json({ success: true, message: 'تم استعادة النسخة الاحتياطية بنجاح! سيتم إعادة تشغيل النظام.' });
    // Exit process to let Electron restart it or just close so user restarts
    setTimeout(() => { process.exit(0); }, 1500);
  } catch(e) {
    res.status(500).json({ success: false, message: 'فشل استعادة النسخة: ' + e.message });
  }
});

// Auto-Backup Cron Job (Runs every day at 11:59 PM)
cron.schedule('59 23 * * *', () => {
  try {
    const backupAutoSetting = db.prepare("SELECT value FROM settings WHERE key = 'backup_auto'").get();
    if(backupAutoSetting && backupAutoSetting.value === '1') {
      const dateStr = new Date().toISOString().slice(0,10);
      const targetPath = path.join(backupDir, `auto_backup_${dateStr}.sqlite`);
      // Use SQLite online backup API if possible, or just copy file (copy works if not writing at exact ms)
      fs.copyFileSync(dbFile, targetPath);
      console.log('✅ Daily Auto-Backup completed:', targetPath);
    }
  } catch(e) { console.error('Auto-Backup failed:', e); }
});

// ================== LICENSE API ==================
app.get('/api/license/status', async (req, res) => {
  let expiry = 'غير مفعل';
  let isActivated = false;
  let remainingDays = 0;
  let licenseKey = '';
  try {
    const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('license_key');
    const expiryRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('license_expiry');
    if(keyRow) licenseKey = keyRow.value;
    if(expiryRow && expiryRow.value) {
      expiry = expiryRow.value;
    }
  } catch(e) {}
  
  if (licenseKey) {
    const validation = validateLicenseKey(licenseKey);
    if (validation && validation.valid) {
      expiry = validation.expiry;
      const today = new Date();
      const expDate = new Date(expiry);
      if (today <= expDate) {
        isActivated = true;
        const diffTime = expDate - today;
        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }
  }

  // Real-time Online Auto-Activation Sync
  if (!isActivated) {
    const onlineActivated = await checkOnlineActivation();
    if (onlineActivated) {
      try {
        const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('license_key');
        const expiryRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('license_expiry');
        if(keyRow) licenseKey = keyRow.value;
        if(expiryRow && expiryRow.value) {
          expiry = expiryRow.value;
          isActivated = true;
          const today = new Date();
          const expDate = new Date(expiry);
          const diffTime = expDate - today;
          remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
      } catch(e) {}
    }
  }

  let adminSetupRequired = true;
  try {
    const setupRow = db.prepare("SELECT value FROM settings WHERE key = 'admin_setup_completed'").get();
    if (setupRow && setupRow.value === '1') {
      adminSetupRequired = false;
    }
  } catch(e) {}

  res.json({
    hwid: HWID,
    expiry: expiry,
    isActivated: isActivated,
    remainingDays: remainingDays,
    isTrial: false,
    adminSetupRequired: adminSetupRequired
  });
});

app.post('/api/license/activate', (req, res) => {
  const { key, shop_name } = req.body;
  const result = validateLicenseKey(key);
  
  if(result && result.valid) {
    try {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('license_key', key);
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('license_expiry', result.expiry);
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('license_hwid', HWID);
      if (shop_name) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('shop_name', shop_name);
      }
      
      // Log audit
      db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(0, 'SYSTEM', 'LICENSE_ACTIVATE', `تم تفعيل النظام بنجاح بالرمز: ${key} لجهاز رقم: ${HWID} باسم محل: ${shop_name || 'gonet phone'}`);
        
      res.json({ success: true, message: 'تم تفعيل النظام بنجاح!' });
    } catch(e) {
      res.json({ success: false, message: 'حدث خطأ أثناء التفعيل.' });
    }
  } else {
    res.json({ success: false, message: 'مفتاح التفعيل غير صحيح أو لا يطابق هذا الحاسوب.' });
  }
});

app.post('/api/license/setup-admin', (req, res) => {
  const { fullname, username, password, phone } = req.body;
  if (!fullname || !username || !password) {
    return res.status(400).json({ success: false, message: 'يرجى ملء جميع الحقول المطلوبة.' });
  }

  try {
    // Check if the system is activated first
    let isActivated = false;
    try {
      const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('license_key');
      if (keyRow && keyRow.value) {
        const validation = validateLicenseKey(keyRow.value);
        if (validation && validation.valid) {
          isActivated = true;
        }
      }
    } catch(e) {}

    if (!isActivated) {
      return res.status(403).json({ success: false, message: 'الرجاء تفعيل ترخيص النظام أولاً.' });
    }

    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);

    // Update or Insert the administrator with ID 1 to avoid violating foreign keys of existing sales/purchases
    const userExists = db.prepare('SELECT 1 FROM users WHERE id = 1').get();
    if (userExists) {
      db.prepare('UPDATE users SET username = ?, password = ?, full_name = ?, role_id = 1, active = 1, branch_id = 1 WHERE id = 1')
        .run(username, hash, fullname);
    } else {
      db.prepare('INSERT INTO users (id, username, password, full_name, role_id, active, branch_id) VALUES (1, ?, ?, ?, 1, 1, 1)')
        .run(username, hash, fullname);
    }

    // Save phone number in settings as shop_phone
    if (phone) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('shop_phone', phone);
    }

    // Set admin_setup_completed to '1'
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_setup_completed', '1');

    // Auto-login the user
    req.session.user = {
      id: 1,
      username: username,
      full_name: fullname,
      role_id: 1,
      branch_id: 1
    };

    try {
      db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(1, username, 'تثبيت المدير العام', 'تم إعداد حساب المدير العام بنجاح وتسجيل الدخول تلقائياً');
    } catch(e) {}

    res.json({ success: true, message: 'تم إعداد حساب المدير العام وتفعيل الدخول بنجاح!' });
  } catch (e) {
    console.error('Failed to setup admin account:', e);
    res.status(500).json({ success: false, message: 'حدث خطأ في الخادم أثناء إعداد حساب المدير.' });
  }
});

// ================== PURCHASES SCHEMA & API ==================
db.prepare(`CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER NOT NULL, supplier_name TEXT NOT NULL, invoice_number TEXT NOT NULL, total REAL DEFAULT 0, paid REAL DEFAULT 0, remaining REAL DEFAULT 0, notes TEXT, purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
db.prepare(`CREATE TABLE IF NOT EXISTS purchase_items (id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_id INTEGER NOT NULL, product_id INTEGER, product_name TEXT NOT NULL, quantity INTEGER DEFAULT 1, unit_cost REAL DEFAULT 0, total REAL DEFAULT 0)`).run();
try { db.prepare(`ALTER TABLE suppliers ADD COLUMN balance REAL DEFAULT 0`).run(); } catch(e) {}

app.get('/api/purchases', requireAuth, requirePermission('purchases'), (req, res) => {
  try {
    const purchases = db.prepare(`SELECT * FROM purchases ORDER BY id DESC`).all();
    const itemStmt = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?');
    purchases.forEach(p => { p.items = itemStmt.all(p.id); });
    res.json({ success: true, data: purchases });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/purchases', requireAuth, requirePermission('purchases'), (req, res) => {
  const { supplier_id, supplier_name, items, paid, notes } = req.body;
  if (!supplier_id || !items || !items.length) return res.status(400).json({ success: false, message: 'بيانات ناقصة' });
  try {
    const total = items.reduce((sum, i) => sum + (parseFloat(i.unit_cost) * parseInt(i.quantity)), 0);
    const paidAmt = parseFloat(paid) || 0;
    const remaining = total - paidAmt;
    const invoice_number = 'PUR-' + Date.now();
    const result = db.prepare(`INSERT INTO purchases (supplier_id, supplier_name, invoice_number, total, paid, remaining, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(supplier_id, supplier_name, invoice_number, total, paidAmt, remaining, notes || '');
    const purchaseId = result.lastInsertRowid;
    const itemStmt = db.prepare(`INSERT INTO purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, total) VALUES (?, ?, ?, ?, ?, ?)`);
    items.forEach(item => {
      const itemQty   = parseInt(item.quantity) || 0;
      const itemCost  = parseFloat(item.unit_cost) || 0;
      const itemTotal = itemCost * itemQty;
      let resolvedProductId = item.product_id ? parseInt(item.product_id) : null;

      if (resolvedProductId) {
        // Product already exists → update quantity & cost_price
        db.prepare('UPDATE products SET quantity = quantity + ?, cost_price = ? WHERE id = ?')
          .run(itemQty, itemCost, resolvedProductId);
      } else {
        // No product selected → check by name first
        const existing = db.prepare('SELECT id FROM products WHERE LOWER(name) = LOWER(?)').get(item.product_name.trim());
        if (existing) {
          // Product found by name → add quantity and update cost
          resolvedProductId = existing.id;
          db.prepare('UPDATE products SET quantity = quantity + ?, cost_price = ? WHERE id = ?')
            .run(itemQty, itemCost, existing.id);
        } else {
          // Brand new product → insert into inventory
          const newProd = db.prepare(`
            INSERT INTO products (name, cost_price, sell_price, quantity, notes, active)
            VALUES (?, ?, ?, ?, ?, 1)
          `).run(
            item.product_name.trim(),
            itemCost,
            0,           // sell_price: seller sets this later
            itemQty,
            'تمت إضافته تلقائياً من فاتورة شراء رقم ' + invoice_number
          );
          resolvedProductId = newProd.lastInsertRowid;
        }
      }

      itemStmt.run(purchaseId, resolvedProductId, item.product_name, itemQty, itemCost, itemTotal);
    });
    if (remaining > 0) { db.prepare('UPDATE suppliers SET balance = COALESCE(balance,0) + ? WHERE id = ?').run(remaining, supplier_id); }
    logAction(req.session.user.id, req.session.user.username, 'شراء بضاعة', 'تم تسجيل فاتورة شراء رقم ' + invoice_number + ' من المورد ' + supplier_name + ' بقيمة إجمالية ' + total + ' شيكل، المدفوع ' + paidAmt);
    res.json({ success: true, id: purchaseId, invoice_number });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/purchases/:id/pay', requireAuth, requirePermission('purchases'), (req, res) => {
  const { amount } = req.body;
  const payAmt = parseFloat(amount);
  if (!payAmt || payAmt <= 0) return res.status(400).json({ success: false, message: 'مبلغ غير صحيح' });
  try {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'الفاتورة غير موجودة' });
    const actualPay = Math.min(payAmt, purchase.remaining);
    db.prepare('UPDATE purchases SET paid = paid + ?, remaining = remaining - ? WHERE id = ?').run(actualPay, actualPay, req.params.id);
    db.prepare('UPDATE suppliers SET balance = MAX(0, COALESCE(balance,0) - ?) WHERE id = ?').run(actualPay, purchase.supplier_id);
    logAction(req.session.user.id, req.session.user.username, 'تسديد للمورد', 'تم دفع ' + actualPay + ' شيكل للمورد ' + purchase.supplier_name + ' لحساب فاتورة شراء رقم ' + purchase.invoice_number);
    res.json({ success: true, message: 'تم تسجيل الدفعة بنجاح' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/purchases/supplier-debts', requireAuth, requirePermission('purchases'), (req, res) => {
  try {
    const debts = db.prepare(`SELECT s.id, s.name, s.phone, COALESCE(SUM(p.total),0) as total_purchases, COALESCE(SUM(p.paid),0) as total_paid, COALESCE(SUM(p.remaining),0) as total_debt, COUNT(p.id) as invoice_count FROM suppliers s LEFT JOIN purchases p ON s.id = p.supplier_id GROUP BY s.id ORDER BY total_debt DESC`).all();
    res.json({ success: true, data: debts });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/purchases/:id', requireAuth, requirePermission('purchases'), (req, res) => {
  try {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
    if (purchase && purchase.remaining > 0) { db.prepare('UPDATE suppliers SET balance = MAX(0, COALESCE(balance,0) - ?) WHERE id = ?').run(purchase.remaining, purchase.supplier_id); }
    db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(req.params.id);
    db.prepare('DELETE FROM purchases WHERE id = ?').run(req.params.id);
    logAction(req.session.user.id, req.session.user.username, 'حذف فاتورة شراء', 'تم حذف فاتورة الشراء رقم ' + (purchase ? purchase.invoice_number : req.params.id) + ' بقيمة ' + (purchase ? purchase.total : 0));
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});
// ================== END PURCHASES MODULE ==================



// Initialize history table
db.prepare(`
  CREATE TABLE IF NOT EXISTS generated_licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_name TEXT NOT NULL,
    hwid TEXT NOT NULL,
    license_key TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

app.post('/api/superadmin/login', (req, res) => {
  const { pass } = req.body;
  if(pass === 'fannipro2026') res.json({ success: true });
  else res.json({ success: false });
});

app.get('/api/superadmin/licenses', (req, res) => {
  const { pass } = req.query;
  if(pass !== 'fannipro2026') return res.status(401).json({ success: false });
  const list = db.prepare('SELECT * FROM generated_licenses ORDER BY id DESC').all();
  res.json({ success: true, data: list });
});

app.post('/api/superadmin/generate-key', (req, res) => {
  const { hwid, expiry, pass, shop_name } = req.body;
  if(pass !== 'fannipro2026') return res.status(401).json({ success: false, message: 'Unauthorized' });
  
  try {
    const epoch = new Date('2026-01-01');
    const expDate = new Date(expiry);
    const diffTime = expDate - epoch;
    const offsetDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const offsetStr = String(offsetDays).padStart(4, '0');
    
    const hash = crypto.createHash('sha256')
      .update(hwid.trim().toUpperCase() + offsetStr + SECRET_KEY)
      .digest('hex');
    const decVal = parseInt(hash.substring(0, 8), 16);
    const checksum = String(decVal % 1000000).padStart(6, '0');
    
    const finalKey = offsetStr + checksum;
    
    // Save to history
    if(shop_name) {
      db.prepare('INSERT INTO generated_licenses (shop_name, hwid, license_key, expiry_date) VALUES (?, ?, ?, ?)').run(shop_name, hwid, finalKey, expiry);
    }
    
    res.json({ success: true, key: finalKey });
  } catch(e) {
    res.status(500).json({ success: false, message: 'Error generating key' });
  }
});

app.delete('/api/superadmin/licenses/:id', (req, res) => {
  const { pass } = req.query;
  if(pass !== 'fannipro2026') return res.status(401).json({ success: false });
  try {
    db.prepare('DELETE FROM generated_licenses WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ success: false }); }
});
app.get('/api/network-ip', async (req, res) => {
  try {
    const os = require('os');
    const QRCode = require('qrcode');
    const interfaces = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name in interfaces) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          localIp = net.address;
          break;
        }
      }
      if (localIp !== '127.0.0.1') break;
    }
    const serverUrl = `http://${localIp}:${PORT}`;
    const qrCodeDataUrl = await QRCode.toDataURL(serverUrl);
    res.json({ success: true, ip: localIp, port: PORT, url: serverUrl, qr: qrCodeDataUrl });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} is already in use. Reusing the existing server instance seamlessly.`);
  } else {
    console.error('Server crash error:', err);
  }
});
