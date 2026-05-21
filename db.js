const Database = require('better-sqlite3');
const path = require('path');
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

const DB_DIR = process.env.USER_DATA_PATH || path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'mobileshop.db');

// Ensure data directory exists and is writable
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
try {
  fs.chmodSync(DB_DIR, 0o777);
} catch (e) {}

// Ensure all database files are writable and not marked read-only (Windows protection)
['mobileshop.db', 'mobileshop.db-wal', 'mobileshop.db-shm'].forEach(file => {
  const p = path.join(DB_DIR, file);
  if (fs.existsSync(p)) {
    try {
      fs.chmodSync(p, 0o666);
    } catch (e) {}
  }
});

// Trigger synchronous database download from cloud before opening
const sync = require('./sync');
sync.downloadDbSync();

let dbInstance = new Database(DB_PATH);

// Enable WAL mode for better performance
dbInstance.pragma('journal_mode = WAL');
dbInstance.pragma('foreign_keys = ON');

const db = new Proxy({}, {
  get(target, prop) {
    if (prop === 'reopen') {
      return (newPath) => {
        console.log('🔄 [DB Proxy] Reopening database connection...');
        try {
          dbInstance.close();
        } catch(e) {
          console.error('⚠️ [DB Proxy] Error closing old db instance:', e);
        }
        dbInstance = new Database(newPath || DB_PATH);
        dbInstance.pragma('journal_mode = WAL');
        dbInstance.pragma('foreign_keys = ON');
        sync.setDatabaseInstance(dbInstance);
        console.log('✅ [DB Proxy] Database connection successfully reopened!');
      };
    }
    if (prop === 'close') {
      return () => dbInstance.close();
    }
    const val = dbInstance[prop];
    if (typeof val === 'function') {
      return val.bind(dbInstance);
    }
    return val;
  }
});

sync.setDatabaseInstance(dbInstance);

function initDatabase() {
  db.exec(`
    -- Users & Roles
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      permissions TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      full_name TEXT,
      role_id INTEGER REFERENCES roles(id),
      branch_id INTEGER,
      active INTEGER DEFAULT 1,
      permissions TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Branches
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      manager TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Products / Inventory
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      model TEXT,
      category_id INTEGER REFERENCES categories(id),
      brand TEXT,
      color TEXT,
      storage TEXT,
      barcode TEXT UNIQUE,
      imei TEXT,
      min_stock INTEGER DEFAULT 0,
      cost_price REAL DEFAULT 0,
      sell_price REAL DEFAULT 0,
      quantity INTEGER DEFAULT 0,
      branch_id INTEGER REFERENCES branches(id),
      image_path TEXT,
      notes TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      balance REAL DEFAULT 0,
      loyalty_points INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      balance REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sales
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER REFERENCES users(id),
      branch_id INTEGER REFERENCES branches(id),
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      paid REAL DEFAULT 0,
      remaining REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'completed',
      notes TEXT,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      total REAL DEFAULT 0
    );

    -- Purchases
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE,
      supplier_id INTEGER REFERENCES suppliers(id),
      user_id INTEGER REFERENCES users(id),
      branch_id INTEGER REFERENCES branches(id),
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      paid REAL DEFAULT 0,
      remaining REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      status TEXT DEFAULT 'received',
      notes TEXT,
      purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER REFERENCES purchases(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER DEFAULT 1,
      unit_cost REAL DEFAULT 0,
      total REAL DEFAULT 0
    );

    -- Repairs
    CREATE TABLE IF NOT EXISTS repairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      customer_name TEXT,
      customer_phone TEXT,
      phone TEXT DEFAULT "",
      device_type TEXT,
      device_brand TEXT,
      device_model TEXT,
      imei TEXT,
      problem TEXT,
      accessories TEXT,
      estimated_cost REAL DEFAULT 0,
      actual_cost REAL DEFAULT 0,
      advance_paid REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      technician_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'received',
      received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_date DATETIME,
      delivered_date DATETIME,
      notes TEXT,
      branch_id INTEGER REFERENCES branches(id)
    );

    -- Checks
    CREATE TABLE IF NOT EXISTS checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'incoming' or 'outgoing'
      check_number TEXT,
      bank TEXT,
      amount REAL DEFAULT 0,
      due_date DATE,
      issue_date DATE DEFAULT CURRENT_DATE,
      holder_name TEXT,
      customer_id INTEGER REFERENCES customers(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      status TEXT DEFAULT 'pending', -- pending, cleared, bounced, cancelled
      notes TEXT,
      notify_days INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      amount REAL DEFAULT 0,
      expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      category TEXT DEFAULT '',
      description TEXT,
      branch_id INTEGER REFERENCES branches(id),
      user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Income
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL DEFAULT 0,
      description TEXT,
      branch_id INTEGER REFERENCES branches(id),
      user_id INTEGER REFERENCES users(id),
      income_date DATE DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Cashbox
    CREATE TABLE IF NOT EXISTS cashbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, -- 'receipt' or 'payment'
      amount REAL DEFAULT 0,
      description TEXT,
      reference_type TEXT, -- 'sale', 'purchase', 'expense', 'repair', 'check', 'manual'
      reference_id INTEGER,
      user_id INTEGER REFERENCES users(id),
      branch_id INTEGER REFERENCES branches(id),
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Journal Entries
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date DATE DEFAULT CURRENT_DATE,
      description TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      account TEXT,
      reference_type TEXT,
      reference_id INTEGER,
      user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT,
      message TEXT,
      reference_type TEXT,
      reference_id INTEGER,
      is_read INTEGER DEFAULT 0,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Stock Transfers
    CREATE TABLE IF NOT EXISTS stock_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id),
      from_branch_id INTEGER REFERENCES branches(id),
      to_branch_id INTEGER REFERENCES branches(id),
      quantity INTEGER DEFAULT 0,
      notes TEXT,
      user_id INTEGER REFERENCES users(id),
      transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default roles
  const roleCount = db.prepare('SELECT COUNT(*) as c FROM roles').get();
  if (roleCount.c === 0) {
    const insertRole = db.prepare('INSERT INTO roles (name, permissions) VALUES (?, ?)');
    insertRole.run('admin', JSON.stringify({ all: true }));
    insertRole.run('cashier', JSON.stringify({ sales: true, pos: true, customers: true }));
    insertRole.run('technician', JSON.stringify({ repairs: true }));
    insertRole.run('accountant', JSON.stringify({ accounting: true, reports: true, expenses: true }));
    insertRole.run('storekeeper', JSON.stringify({ inventory: true, purchases: true }));
  }

  // Seed default admin user
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount.c === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password, full_name, role_id, active) VALUES (?, ?, ?, 1, 1)')
      .run('admin', hash, 'المدير العام');
  }

  // Seed default branch
  const branchCount = db.prepare('SELECT COUNT(*) as c FROM branches').get();
  if (branchCount.c === 0) {
    db.prepare('INSERT INTO branches (name, address) VALUES (?, ?)').run('الفرع الرئيسي', 'المقر الرئيسي');
  }

  // Seed default categories
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
  if (catCount.c === 0) {
    const cats = ['هواتف ذكية', 'إكسسوارات', 'شواحن', 'سماعات', 'حافظات', 'قطع غيار', 'أجهزة لوحية'];
    cats.forEach(c => db.prepare('INSERT INTO categories (name) VALUES (?)').run(c));
  }

  // Seed settings
  const settingsData = [
    ['shop_name', 'gonet phone'],
    ['shop_phone', ''],
    ['shop_address', ''],
    ['currency', 'شيكل'],
    ['tax_rate', '0'],
    ['check_notify_days', '3'],
    ['low_stock_notify', '1'],
    ['backup_auto', '1'],
    ['license_key', ''],
    ['license_expiry', ''],
    ['license_hwid', ''],
    ['admin_setup_completed', '0'],
    ['render_url', '']
  ];
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  settingsData.forEach(([k, v]) => insertSetting.run(k, v));

  // Dynamic Migrations for Safe Table Schema Compatibility
  
  // 1. Migrate repairs table columns if needed
  try {
    const tableInfo = db.prepare("PRAGMA table_info(repairs)").all();
    const hasPhone = tableInfo.some(col => col.name === 'phone');
    if (!hasPhone) {
      db.prepare('ALTER TABLE repairs ADD COLUMN phone TEXT DEFAULT ""').run();
      console.log('🔧 Migration: Added phone column to repairs table');
    }
    const hasCost = tableInfo.some(col => col.name === 'cost');
    if (!hasCost) {
      db.prepare('ALTER TABLE repairs ADD COLUMN cost REAL DEFAULT 0').run();
      console.log('🔧 Migration: Added cost column to repairs table');
    }
    const hasStatus = tableInfo.some(col => col.name === 'status');
    if (!hasStatus) {
      db.prepare('ALTER TABLE repairs ADD COLUMN status TEXT DEFAULT "pending"').run();
      console.log('🔧 Migration: Added status column to repairs table');
    }
    const hasAdvance = tableInfo.some(col => col.name === 'advance_paid');
    if (!hasAdvance) {
      db.prepare('ALTER TABLE repairs ADD COLUMN advance_paid REAL DEFAULT 0').run();
      console.log('🔧 Migration: Added advance_paid column to repairs table');
    }
    const hasNotes = tableInfo.some(col => col.name === 'notes');
    if (!hasNotes) {
      db.prepare('ALTER TABLE repairs ADD COLUMN notes TEXT DEFAULT ""').run();
      console.log('🔧 Migration: Added notes column to repairs table');
    }
  } catch (err) {
    console.error('Error during repairs table migration:', err);
  }

  // 2. Migrate expenses table columns safely
  try {
    const tableInfo = db.prepare("PRAGMA table_info(expenses)").all();
    const hasTitle = tableInfo.some(col => col.name === 'title');
    if (!hasTitle) {
      db.exec(`
        BEGIN TRANSACTION;
        ALTER TABLE expenses RENAME TO expenses_old;
        CREATE TABLE expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          amount REAL DEFAULT 0,
          expense_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          category TEXT DEFAULT '',
          description TEXT,
          branch_id INTEGER REFERENCES branches(id),
          user_id INTEGER REFERENCES users(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO expenses (id, title, amount, expense_date, category, description, branch_id, user_id, created_at)
        SELECT id, category, amount, expense_date, category, description, branch_id, user_id, created_at FROM expenses_old;
        DROP TABLE expenses_old;
        COMMIT;
      `);
      console.log('🔧 Migration: Successfully upgraded expenses table to title-based schema');
    }
  } catch (err) {
    console.error('Error during expenses table migration:', err);
  }

  // 3. Create audit_logs table safely
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('🔧 Migration: Ensured audit_logs table exists');
  } catch (err) {
    console.error('Error during audit_logs table migration:', err);
  }

  // 4. Migrate users table to add permissions column and set defaults
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const hasPermissions = tableInfo.some(col => col.name === 'permissions');
    if (!hasPermissions) {
      db.prepare("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '{}'").run();
      console.log('🔧 Migration: Added permissions column to users table');
    }
    
    // Set default permissions for existing users who have empty or null permissions
    const usersWithoutPermissions = db.prepare("SELECT id, role_id FROM users WHERE permissions IS NULL OR permissions = '{}' OR permissions = ''").all();
    const updatePerms = db.prepare("UPDATE users SET permissions = ? WHERE id = ?");
    
    usersWithoutPermissions.forEach(u => {
      let defaultPerms = {};
      if (u.role_id === 1) {
        defaultPerms = { all: true };
      } else if (u.role_id === 2) { // Cashier
        defaultPerms = { pos: true, saleshistory: true, customers: true };
      } else if (u.role_id === 3) { // Technician
        defaultPerms = { maintenance: true };
      } else if (u.role_id === 4) { // Accountant
        defaultPerms = { statements: true, expenses: true, reports: true, checks: true };
      } else if (u.role_id === 5) { // Storekeeper
        defaultPerms = { inventory: true, purchases: true, suppliers: true };
      }
      updatePerms.run(JSON.stringify(defaultPerms), u.id);
    });
    if (usersWithoutPermissions.length > 0) {
      console.log(`🔧 Migration: Seeded default permissions for ${usersWithoutPermissions.length} existing users`);
    }
  } catch (err) {
    console.error('Error during users table permissions migration:', err);
  }

  console.log('✅ Database initialized successfully');
}

initDatabase();

module.exports = db;
