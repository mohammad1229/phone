let currentUser = null;
let posCart = [];
let allProducts = [];
let allSuppliers = [];
let allCustomers = [];
let allRepairs = [];
let allChecks = [];
let allExpenses = [];
let allEmployees = [];
let allInstallments = [];
let allSalesHistory = [];
let allReturns = [];
let allPurchases = [];
let purItemRowCount = 0;
let currentPrintProduct = null;
let globalShopName    = "gonet phone";
let globalShopLogo    = null;
let globalShopPhone   = "";
let globalShopAddress = "";
let stocktakeCart = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            try {
                const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
                const data = await response.json();
                if (data.success) {
                    if (data.redirect) {
                        window.location.href = data.redirect;
                    } else {
                        showDashboard(data.user);
                    }
                }
                else document.getElementById('login-error').textContent = data.message;
            } catch (error) { document.getElementById('login-error').textContent = 'خطأ اتصال'; }
        });
    }

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        showLogin();
    });

    const navItems = document.querySelectorAll('.nav-item');
    const viewPanels = document.querySelectorAll('.view-panel');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-target');
            if (['suppliers', 'customers', 'inventory', 'pos', 'checks', 'maintenance', 'dashboard', 'settings', 'barcodes', 'stocktake', 'expenses', 'reports', 'installments', 'employees', 'saleshistory', 'returns', 'statements', 'purchases', 'users', 'supplierdebts', 'logs'].includes(sectionId)) {
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                viewPanels.forEach(panel => panel.classList.remove('active-view'));
                const view = document.getElementById(`view-${sectionId}`);
                if(view) view.classList.add('active-view');
                
                pageTitle.textContent = item.textContent.trim();
                
                if (sectionId === 'pos') loadPOS();
                if (sectionId === 'settings') loadSettings();
                if (sectionId === 'reports') loadFinancialReports();
                if (sectionId === 'saleshistory') loadSalesHistory();
                if (sectionId === 'statements') loadStatementsPanel();
                if (sectionId === 'purchases') loadPurchases();
                if (sectionId === 'users') loadUsers();
                if (sectionId === 'supplierdebts') loadSupplierDebts();
                if (sectionId === 'logs') loadAuditLogs();
            }
        });
    });

    document.getElementById('pos-search')?.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            const val = e.target.value.trim();
            if(!val) return;
            const product = allProducts.find(p => p.barcode === val);
            if (product) {
                addToCart(product.id);
                e.target.value = '';
                renderPOSProducts(allProducts);
            }
        }
    });

    document.getElementById('stocktake-search')?.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            e.preventDefault();
            const val = e.target.value.trim();
            if(!val) return;
            const product = allProducts.find(p => p.barcode === val);
            if (product) {
                addStocktakeItem(product);
                e.target.value = '';
            } else {
                alert('لم يتم العثور على منتج بهذا الباركود في النظام!');
            }
        }
    });

    document.getElementById('pos-search')?.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const filtered = allProducts.filter(p => p.name.toLowerCase().includes(val) || (p.barcode && p.barcode.includes(val)));
        renderPOSProducts(filtered);
    });

    document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            shop_name: document.getElementById('set-shop-name').value,
            shop_phone: document.getElementById('set-shop-phone').value,
            shop_address: document.getElementById('set-shop-address').value,
            currency: document.getElementById('set-currency').value,
            render_url: document.getElementById('set-render-url')?.value || ''
        };
        const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if(data.success) {
            alert('تم الحفظ');
            loadSettings();
        }
    });

    document.getElementById('password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const old_pass = document.getElementById('old-pass').value;
        const new_pass = document.getElementById('new-pass').value;
        const confirm_pass = document.getElementById('confirm-pass').value;

        if (new_pass !== confirm_pass) {
            return alert('كلمة المرور الجديدة غير متطابقة!');
        }

        try {
            const res = await fetch('/api/users/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_pass, new_pass })
            });
            const data = await res.json();
            alert(data.message);
            if(data.success) {
                e.target.reset();
                await fetch('/api/logout', { method: 'POST' });
                window.location.reload();
            }
        } catch(err) { alert('خطأ في الاتصال بالخادم'); }
    });

    document.getElementById('user-role-field')?.addEventListener('change', (e) => {
        const roleId = parseInt(e.target.value);
        document.querySelectorAll('.user-perm-checkbox').forEach(cb => cb.checked = false);
        if (roleId === 1) {
            document.querySelectorAll('.user-perm-checkbox').forEach(cb => cb.checked = true);
        } else if (roleId === 2) {
            document.getElementById('perm-pos').checked = true;
            document.getElementById('perm-saleshistory').checked = true;
            document.getElementById('perm-customers').checked = true;
        } else if (roleId === 3) {
            document.getElementById('perm-maintenance').checked = true;
        } else if (roleId === 4) {
            document.getElementById('perm-statements').checked = true;
            document.getElementById('perm-expenses').checked = true;
            document.getElementById('perm-reports').checked = true;
            document.getElementById('perm-checks').checked = true;
        } else if (roleId === 5) {
            document.getElementById('perm-inventory').checked = true;
            document.getElementById('perm-purchases').checked = true;
            document.getElementById('perm-suppliers').checked = true;
        }
    });
});

async function checkAuthStatus() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        if (data.success && data.user) showDashboard(data.user);
        else showLogin();
    } catch (error) { showLogin(); }
}

function showDashboard(user) {
    currentUser = user;
    document.getElementById('login-section').classList.replace('active-section', 'hidden-section');
    document.getElementById('dashboard-section').classList.replace('hidden-section', 'active-section');
    
    // Set user's name
    const userNameEl = document.getElementById('current-user-name');
    if (userNameEl) userNameEl.textContent = user.full_name;
    
    // Map role_id to Arabic translation and set it on top
    let roleText = 'موظف';
    if (user.role_id === 1) {
        roleText = 'المدير العام';
    } else if (user.role_id === 2) {
        roleText = 'كاشير المبيعات';
    } else if (user.role_id === 3) {
        roleText = 'فني صيانة';
    } else if (user.role_id === 4) {
        roleText = 'محاسب';
    } else if (user.role_id === 5) {
        roleText = 'أمين مخزن';
    }
    const roleEl = document.getElementById('current-user-role');
    if (roleEl) roleEl.textContent = roleText;
    
    // Filter sidebar navigation items based on granular permissions
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const perms = user.permissions || {};
    const isAdmin = user.role_id === 1;

    const targetPermMap = {
        'pos': 'pos',
        'saleshistory': 'saleshistory',
        'inventory': 'inventory',
        'returns': 'returns',
        'maintenance': 'maintenance',
        'installments': 'installments',
        'purchases': 'purchases',
        'suppliers': 'suppliers',
        'supplierdebts': 'purchases',
        'customers': 'customers',
        'employees': 'employees',
        'statements': 'statements',
        'expenses': 'expenses',
        'checks': 'checks',
        'stocktake': 'stocktake',
        'barcodes': 'inventory',
        'reports': 'reports',
        'settings': 'settings',
        'users': 'settings',
        'logs': 'logs'
    };

    navItems.forEach(item => {
        const target = item.getAttribute('data-target');
        if (target === 'dashboard') {
            item.style.display = 'block';
            return;
        }
        
        const requiredPerm = targetPermMap[target];
        if (isAdmin || perms.all || (requiredPerm && perms[requiredPerm])) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });

    const activeNav = document.querySelector('.sidebar-nav .nav-item.active');
    if (activeNav && activeNav.style.display === 'none') {
        navItems.forEach(nav => nav.classList.remove('active'));
        const dashNav = Array.from(navItems).find(nav => nav.getAttribute('data-target') === 'dashboard');
        if (dashNav) {
            dashNav.classList.add('active');
            const pageTitle = document.getElementById('page-title');
            if (pageTitle) pageTitle.textContent = dashNav.textContent.trim();
        }
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active-view'));
        const dashView = document.getElementById('view-dashboard');
        if (dashView) dashView.classList.add('active-view');
    }
    
    loadAllData();
}

function showLogin() {
    currentUser = null;
    document.getElementById('dashboard-section').classList.replace('active-section', 'hidden-section');
    document.getElementById('login-section').classList.replace('hidden-section', 'active-section');
}

// Secret Super Admin Access
let secretClickCount = 0;
let secretClickTimer = null;
window.handleSecretClick = function() {
    secretClickCount++;
    if(secretClickTimer) clearTimeout(secretClickTimer);
    
    if(secretClickCount >= 5) {
        secretClickCount = 0;
        const pass = prompt("الرجاء إدخال كلمة مرور المطور:");
        if(pass === "fannipro2026") {
            window.location.href = '/superadmin.html';
        } else if (pass) {
            alert("كلمة المرور غير صحيحة!");
        }
    } else {
        secretClickTimer = setTimeout(() => { secretClickCount = 0; }, 2000);
    }
}

window.loadAllData = async function() {
    if (!currentUser) return;
    loadDashboardStats();
    
    const perms = currentUser.permissions || {};
    const isAdmin = currentUser.role_id === 1;

    if (isAdmin || perms.all || perms.suppliers) loadSuppliers();
    if (isAdmin || perms.all || perms.customers) loadCustomers();
    if (isAdmin || perms.all || perms.inventory) await loadProducts();
    if (isAdmin || perms.all || perms.maintenance) loadRepairs();
    if (isAdmin || perms.all || perms.checks) loadChecks();
    if (isAdmin || perms.all || perms.expenses) loadExpenses();
    if (isAdmin || perms.all || perms.employees) loadEmployees();
    if (isAdmin || perms.all || perms.installments) await loadInstallments();
    if (isAdmin || perms.all || perms.returns) loadReturns();
    generateSmartAlerts();
    checkTrialStatus();
    if (isAdmin || perms.all || perms.settings) loadSettings();
}

async function checkTrialStatus() {
    try {
        const res = await fetch('/api/license/status');
        const data = await res.json();
        const banner = document.getElementById('trial-banner');
        if(banner) {
            if(data.isTrial && data.isActivated) {
                banner.style.display = 'flex';
                document.getElementById('trial-days').textContent = data.remainingDays;
            } else {
                banner.style.display = 'none';
            }
        }
    } catch(e) {}
}

window.loadSalesHistory = async function() {
    try {
        const res = await fetch('/api/sales');
        const data = await res.json();
        if(data.success) { allSalesHistory = data.data; renderSalesHistory(); }
    } catch(e){}
}

async function loadReturns() {
    try {
        const res = await fetch('/api/returns');
        const data = await res.json();
        if(data.success) { allReturns = data.data; renderReturns(); }
    } catch(e){}
}

async function loadEmployees() {
    try {
        const res = await fetch('/api/employees');
        const data = await res.json();
        if(data.success) { allEmployees = data.data; renderEmployees(); }
    } catch(e){}
}

async function loadInstallments() {
    try {
        const res = await fetch('/api/installments');
        const data = await res.json();
        if(data.success) { allInstallments = data.data; renderInstallments(); }
    } catch(e){}
}

async function loadExpenses() {
    try {
        const res = await fetch('/api/expenses');
        const data = await res.json();
        if(data.success) { allExpenses = data.data; renderExpenses(); }
    } catch(e){}
}

async function loadDashboardStats() {
    try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        if (data.success) {
            document.getElementById('stat-sales').textContent = data.data.sales_today;
            document.getElementById('stat-repairs').textContent = data.data.active_repairs;
            document.getElementById('stat-stock').textContent = data.data.low_stock;
            document.getElementById('stat-customers').textContent = data.data.customers_today;
        }

        // Extended stats for charts & alerts
        const resExt = await fetch('/api/dashboard/extended-stats');
        const dataExt = await resExt.json();
        if (dataExt.success) {
            initializeDashboardCharts(dataExt.data);
            populateDashboardAlerts(dataExt.data);
        }
    } catch(e) { console.error('Dashboard Stats Error:', e); }
}

async function loadSuppliers() {
    const res = await fetch('/api/suppliers');
    const data = await res.json();
    allSuppliers = data.data;
    const tbody = document.getElementById('suppliers-list');
    tbody.innerHTML = '';
    allSuppliers.forEach((s, i) => {
        tbody.innerHTML += `<tr><td>${i+1}</td><td>${s.name}</td><td>${s.phone||'-'}</td><td>${s.address||'-'}</td>
        <td>
            <button class="icon-btn text-primary" onclick="editSupplier(${s.id})"><i class="fa-solid fa-edit"></i></button>
            <button class="icon-btn text-danger" onclick="deleteItem('suppliers', ${s.id})"><i class="fa-solid fa-trash"></i></button>
        </td></tr>`;
    });
}

async function loadCustomers() {
    const res = await fetch('/api/customers');
    const data = await res.json();
    allCustomers = data.data;
    const tbody = document.getElementById('customers-list');
    tbody.innerHTML = '';
    allCustomers.forEach((c, i) => {
        tbody.innerHTML += `<tr><td>${i+1}</td><td>${c.name}</td><td>${c.phone||'-'}</td><td>${c.balance}</td>
        <td>
            <button class="icon-btn text-primary" onclick="editCustomer(${c.id})"><i class="fa-solid fa-edit"></i></button>
            <button class="icon-btn text-danger" onclick="deleteItem('customers', ${c.id})"><i class="fa-solid fa-trash"></i></button>
        </td></tr>`;
    });
}

async function loadProducts() {
    const res = await fetch('/api/products');
    const data = await res.json();
    allProducts = data.data;
    const tbody = document.getElementById('inventory-list');
    tbody.innerHTML = '';
    
    const bgSelect = document.getElementById('bg-select-product');
    if(bgSelect) bgSelect.innerHTML = '<option value="">-- منتج مخصص (أدخل البيانات يدوياً) --</option>';
    
    allProducts.forEach(p => {
        if(bgSelect) bgSelect.innerHTML += `<option value="${p.id}">${p.name} - ${p.barcode||'-'}</option>`;
        tbody.innerHTML += `<tr><td>${p.barcode||'-'}</td><td>${p.name}</td><td>${p.quantity}</td><td>${p.sell_price}</td>
        <td>
            <button class="icon-btn text-success" title="طباعة باركود" onclick="openPrintBarcode(${p.id})"><i class="fa-solid fa-barcode"></i></button>
            <button class="icon-btn text-primary" onclick="editProduct(${p.id})"><i class="fa-solid fa-edit"></i></button>
            <button class="icon-btn text-danger" onclick="deleteItem('products', ${p.id})"><i class="fa-solid fa-trash"></i></button>
        </td></tr>`;
    });
}

async function loadRepairs() {
    const res = await fetch('/api/repairs');
    const data = await res.json();
    allRepairs = data.data;
    const tbody = document.getElementById('repairs-list');
    tbody.innerHTML = '';
    allRepairs.forEach(r => {
        let statusBadge = '';
        if(r.status === 'pending' || !r.status) statusBadge = '<span class="badge" style="background:var(--warning); color:black;">قيد الانتظار</span>';
        else if(r.status === 'working') statusBadge = '<span class="badge" style="background:var(--primary); color:white;">جاري العمل</span>';
        else if(r.status === 'ready') statusBadge = '<span class="badge" style="background:var(--success); color:white;">جاهز للاستلام</span>';
        
        let waBtn = '';
        if(r.phone) {
            waBtn = `<button class="icon-btn text-success" title="إرسال إشعار العميل عبر واتساب" onclick="sendRepairWhatsApp(${r.id})"><i class="fa-brands fa-whatsapp"></i></button>`;
        }

        tbody.innerHTML += `<tr>
        <td>${r.ticket_number}</td>
        <td>${r.customer_name}</td>
        <td style="direction:ltr;">${r.phone || '-'}</td>
        <td>${r.device_brand}</td>
        <td>${r.problem}</td>
        <td>${r.cost || 0}</td>
        <td>
            ${statusBadge}
            <select onchange="updateRepairStatus(${r.id}, this.value)" style="margin-right:5px; padding:2px; font-size:0.8rem; border-radius:3px;">
                <option value="">تغيير..</option>
                <option value="pending">انتظار</option>
                <option value="working">عمل</option>
                <option value="ready">جاهز</option>
            </select>
        </td>
        <td>
            ${waBtn}
            <button class="icon-btn text-warning" title="طباعة الوصل" onclick="printRepairReceipt(${r.id})"><i class="fa-solid fa-print"></i></button>
            <button class="icon-btn text-primary" onclick="editRepair(${r.id})"><i class="fa-solid fa-edit"></i></button>
            <button class="icon-btn text-danger" onclick="deleteItem('repairs', ${r.id})"><i class="fa-solid fa-trash"></i></button>
        </td></tr>`;
    });
}

async function loadChecks() {
    const res = await fetch('/api/checks');
    const data = await res.json();
    allChecks = data.data;
    const tbody = document.getElementById('checks-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    allChecks.forEach(c => {
        const typeText = c.type === 'incoming' ? '<span class="text-success">وارد</span>' : '<span class="text-danger">صادر</span>';
        tbody.innerHTML += `<tr><td>${typeText}</td><td>${c.check_number}</td><td>${c.bank}</td><td>${c.amount}</td><td>${c.due_date}</td>
        <td>
            <button class="icon-btn text-primary" onclick="editCheck(${c.id})"><i class="fa-solid fa-edit"></i></button>
            <button class="icon-btn text-danger" onclick="deleteItem('checks', ${c.id})"><i class="fa-solid fa-trash"></i></button>
        </td></tr>`;
    });
}

async function loadSettings() {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if(data.success && data.data) {
        document.getElementById('set-shop-name').value = data.data.shop_name || '';
        document.getElementById('set-shop-phone').value = data.data.shop_phone || '';
        document.getElementById('set-shop-address').value = data.data.shop_address || '';
        document.getElementById('set-currency').value = data.data.currency || 'شيكل';
        if (document.getElementById('set-render-url')) {
            document.getElementById('set-render-url').value = data.data.render_url || '';
        }
        globalShopName    = data.data.shop_name    || "FanniPro";
        globalShopPhone   = data.data.shop_phone   || "";
        globalShopAddress = data.data.shop_address || "";
        
        const sidebarName = document.getElementById('sidebar-shop-name');
        if(sidebarName) sidebarName.textContent = globalShopName;

        // Dynamic Shop Logo Handling
        const logoUrl = data.data.shop_logo;
        globalShopLogo = logoUrl;
        
        // 1. Sidebar Logo
        const sidebarLogoContainer = document.getElementById('sidebar-logo-container');
        const sidebarLogoImg = document.getElementById('sidebar-logo');
        const sidebarPlaceholder = document.getElementById('sidebar-logo-placeholder');
        
        if (logoUrl) {
            if (sidebarLogoImg) sidebarLogoImg.src = logoUrl + '?t=' + Date.now();
            if (sidebarLogoContainer) sidebarLogoContainer.style.display = 'flex';
            if (sidebarPlaceholder) sidebarPlaceholder.style.display = 'none';
        } else {
            if (sidebarLogoContainer) sidebarLogoContainer.style.display = 'none';
            if (sidebarPlaceholder) sidebarPlaceholder.style.display = 'block';
        }
        
        // 2. Login Screen Logo
        const loginLogoContainer = document.getElementById('login-logo-container');
        const loginLogoImg = document.getElementById('login-logo');
        const loginPlaceholder = document.getElementById('login-logo-placeholder');
        
        if (logoUrl) {
            if (loginLogoImg) loginLogoImg.src = logoUrl + '?t=' + Date.now();
            if (loginLogoContainer) loginLogoContainer.style.display = 'flex';
            if (loginPlaceholder) loginPlaceholder.style.display = 'none';
        } else {
            if (loginLogoContainer) loginLogoContainer.style.display = 'none';
            if (loginPlaceholder) loginPlaceholder.style.display = 'block';
        }
        
        // 3. Settings Preview
        const setPreview = document.getElementById('set-logo-preview');
        const setPlaceholder = document.getElementById('set-logo-placeholder');
        
        if (logoUrl) {
            if (setPreview) {
                setPreview.src = logoUrl + '?t=' + Date.now();
                setPreview.style.display = 'block';
            }
            if (setPlaceholder) setPlaceholder.style.display = 'none';
        } else {
            if (setPreview) setPreview.style.display = 'none';
            if (setPlaceholder) setPlaceholder.style.display = 'block';
        }
        
        // Fetch Mobile App Connection details
        try {
            const netRes = await fetch('/api/network-ip');
            const netData = await netRes.json();
            if (netData.success) {
                const qrContainer = document.getElementById('settings-mobile-qr');
                const urlSpan = document.getElementById('settings-mobile-url');
                if (qrContainer) {
                    qrContainer.innerHTML = `<img src="${netData.qr}" style="width: 100%; height: 100%; object-fit: contain;">`;
                }
                if (urlSpan) {
                    urlSpan.textContent = netData.url;
                }
            } else {
                const urlSpan = document.getElementById('settings-mobile-url');
                if (urlSpan) urlSpan.textContent = 'فشل جلب عنوان IP للشبكة';
            }
        } catch (netErr) {
            console.error('Error loading network IP for QR:', netErr);
            const urlSpan = document.getElementById('settings-mobile-url');
            if (urlSpan) urlSpan.textContent = 'خطأ اتصال بالشبكة';
        }
    }
}

window.previewShopLogo = async function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        // Show local preview instantly
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('set-logo-preview');
            const placeholder = document.getElementById('set-logo-placeholder');
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = 'block';
            }
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
        
        // Upload file instantly to server
        const formData = new FormData();
        formData.append('logo', file);
        
        try {
            const res = await fetch('/api/settings/upload-logo', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                alert('تم حفظ ورفع شعار البرنامج الجديد بنجاح!');
                loadSettings();
            } else {
                alert('فشل رفع الشعار: ' + data.message);
            }
        } catch(err) {
            alert('حدث خطأ في الاتصال بالخادم أثناء رفع الشعار.');
        }
    }
}

// Global Delete
window.deleteItem = async function(entity, id) {
    if(!confirm('هل أنت متأكد من الحذف؟')) return;
    await fetch(`/api/${entity}/${id}`, { method: 'DELETE' });
    loadAllData();
}

// Modals
window.openModal = function(id) { 
    document.getElementById(id).classList.add('active'); 
    const form = document.querySelector(`#${id} form`);
    if(form) {
        form.reset();
        const hiddenId = form.querySelector('input[type="hidden"]');
        if(hiddenId) hiddenId.value = '';
    }
}
window.closeModal = function(id) { document.getElementById(id).classList.remove('active'); }

// Edit Helpers
window.editSupplier = function(id) {
    const s = allSuppliers.find(x => x.id === id);
    if(!s) return;
    document.getElementById('sup-id').value = s.id;
    document.getElementById('sup-name').value = s.name;
    document.getElementById('sup-phone').value = s.phone || '';
    document.getElementById('sup-address').value = s.address || '';
    document.getElementById('sup-modal-title').textContent = 'تعديل مورد';
    document.getElementById('supplier-modal').classList.add('active');
}
window.editCustomer = function(id) {
    const c = allCustomers.find(x => x.id === id);
    if(!c) return;
    document.getElementById('cust-id').value = c.id;
    document.getElementById('cust-name').value = c.name;
    document.getElementById('cust-phone').value = c.phone || '';
    document.getElementById('cust-modal-title').textContent = 'تعديل عميل';
    document.getElementById('customer-modal').classList.add('active');
}
window.editProduct = function(id) {
    const p = allProducts.find(x => x.id === id);
    if(!p) return;
    document.getElementById('prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-barcode').value = p.barcode || '';
    document.getElementById('prod-qty').value = p.quantity || 0;
    document.getElementById('prod-price').value = p.sell_price || 0;
    document.getElementById('prod-modal-title').textContent = 'تعديل منتج';
    document.getElementById('product-modal').classList.add('active');
}
window.editRepair = function(id) {
    const r = allRepairs.find(x => x.id === id);
    if(!r) return;
    document.getElementById('rep-id').value = r.id;
    document.getElementById('rep-cust').value = r.customer_name;
    document.getElementById('rep-phone').value = r.phone || '';
    document.getElementById('rep-device').value = r.device_brand;
    document.getElementById('rep-prob').value = r.problem;
    document.getElementById('rep-cost').value = r.cost || 0;
    document.getElementById('rep-advance').value = r.advance_paid || 0;
    document.getElementById('rep-notes').value = r.notes || '';
    document.getElementById('rep-modal-title').textContent = 'تعديل تذكرة صيانة';
    document.getElementById('repair-modal').classList.add('active');
}
window.editCheck = function(id) {
    const c = allChecks.find(x => x.id === id);
    if(!c) return;
    document.getElementById('chk-id').value = c.id;
    document.getElementById('chk-type').value = c.type;
    document.getElementById('chk-number').value = c.check_number;
    document.getElementById('chk-bank').value = c.bank;
    document.getElementById('chk-amount').value = c.amount;
    document.getElementById('chk-date').value = c.due_date;
    document.getElementById('chk-modal-title').textContent = 'تعديل شيك';
    document.getElementById('check-modal').classList.add('active');
}

// Form Submits with Create/Update Support
async function handleFormSubmit(entity, payload, idVal, modalId) {
    const url = idVal ? `/api/${entity}/${idVal}` : `/api/${entity}`;
    const method = idVal ? 'PUT' : 'POST';
    try {
        const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            closeModal(modalId);
            loadAllData();
            return true;
        } else {
            alert('حدث خطأ أثناء الحفظ: ' + (data.message || 'فشلت العملية'));
            return false;
        }
    } catch(err) {
        alert('حدث خطأ في الاتصال بالخادم. يرجى المحاولة مرة أخرى.');
        return false;
    }
}

// Print Barcode Logic
window.openPrintBarcode = function(id) {
    const p = allProducts.find(x => x.id === id);
    if(!p) return;
    currentPrintProduct = p;
    document.getElementById('print-qty').value = 1;
    openModal('print-barcode-modal');
}
window.executePrintBarcode = function() {
    const qty = parseInt(document.getElementById('print-qty').value) || 1;
    if(!currentPrintProduct || qty < 1) return;
    const printArea = document.getElementById('print-area');
    printArea.innerHTML = '';
    for(let i = 0; i < qty; i++) {
        const label = document.createElement('div');
        label.className = 'barcode-label';
        
        const shopDiv = document.createElement('div');
        shopDiv.className = 'bl-shop';
        shopDiv.textContent = globalShopName;
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'bl-name';
        nameDiv.textContent = currentPrintProduct.name + (currentPrintProduct.category_name ? ` (${currentPrintProduct.category_name})` : '');
        
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const svgId = 'barcode-' + i;
        svg.id = svgId;
        
        const priceDiv = document.createElement('div');
        priceDiv.className = 'bl-price';
        priceDiv.textContent = currentPrintProduct.sell_price + ' ' + (document.getElementById('set-currency').value || 'شيكل');
        
        label.appendChild(shopDiv);
        label.appendChild(nameDiv);
        label.appendChild(svg);
        label.appendChild(priceDiv);
        printArea.appendChild(label);
        
        JsBarcode(svg, currentPrintProduct.barcode || currentPrintProduct.id.toString(), {
            format: "CODE128",
            width: 1.5,
            height: 40,
            displayValue: true,
            fontSize: 14,
            margin: 5
        });
    }
    closeModal('print-barcode-modal');
    setTimeout(() => { window.print(); }, 200); // slight delay to render SVGs
}

// Dedicated Barcode Generator Logic
window.generateRandomBarcode = function() {
    // Generate a random 12 digit number for EAN-13/UPC compatibility
    const code = Math.floor(Math.random() * 900000000000) + 100000000000;
    document.getElementById('bg-code').value = code.toString();
    previewBarcode();
}

function previewBarcode() {
    const errorBox = document.getElementById('bg-error');
    if(errorBox) errorBox.textContent = '';
    
    const showShop = document.getElementById('bg-show-shop')?.checked ?? true;
    const showName = document.getElementById('bg-show-name')?.checked ?? true;
    const showPrice = document.getElementById('bg-show-price')?.checked ?? true;
    
    const shopDiv = document.getElementById('bg-prev-shop');
    const nameDiv = document.getElementById('bg-prev-name');
    const priceDiv = document.getElementById('bg-prev-price');
    
    shopDiv.textContent = globalShopName;
    nameDiv.textContent = document.getElementById('bg-name').value || 'اسم المنتج';
    priceDiv.textContent = (document.getElementById('bg-price').value || '0') + ' ' + (document.getElementById('set-currency').value || 'شيكل');
    
    shopDiv.style.display = showShop ? 'block' : 'none';
    nameDiv.style.display = showName ? 'block' : 'none';
    priceDiv.style.display = showPrice ? 'block' : 'none';
    
    const code = document.getElementById('bg-code').value || '0000000000';
    const format = document.getElementById('bg-format')?.value || 'CODE128';
    const size = document.getElementById('bg-size')?.value || '5x3';
    
    const previewBox = document.getElementById('bg-preview-box');
    if(size === '5x3') { previewBox.style.width = '5cm'; previewBox.style.height = '3cm'; }
    else if(size === '4x2.5') { previewBox.style.width = '4cm'; previewBox.style.height = '2.5cm'; }
    else if(size === '3.5x2') { previewBox.style.width = '3.5cm'; previewBox.style.height = '2cm'; }
    
    try {
        JsBarcode("#bg-prev-svg", code, { 
            format: format, 
            width: 1.5, 
            height: size === '3.5x2' ? 25 : 40, 
            displayValue: true, 
            fontSize: size === '3.5x2' ? 10 : 14, 
            margin: 2,
            valid: function(valid) {
                if(!valid && format === 'EAN13' && errorBox) {
                    errorBox.textContent = 'تحذير: باركود EAN-13 يجب أن يتكون من 12 أو 13 رقماً فقط.';
                }
            }
        });
    } catch(e) {
        if(errorBox) errorBox.textContent = 'تنسيق الباركود غير صالح للنوع المختار.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ['bg-name', 'bg-code', 'bg-price'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', previewBarcode);
    });
});

window.fillBarcodeForm = function() {
    const id = document.getElementById('bg-select-product').value;
    if(id) {
        const p = allProducts.find(x => x.id == id);
        if(p) {
            document.getElementById('bg-name').value = p.name;
            document.getElementById('bg-code').value = p.barcode || p.id;
            document.getElementById('bg-price').value = p.sell_price;
            previewBarcode();
        }
    } else {
        document.getElementById('bg-name').value = '';
        document.getElementById('bg-code').value = '';
        document.getElementById('bg-price').value = '';
        previewBarcode();
    }
}

window.generateCustomBarcode = function(e) {
    e.preventDefault();
    const qty = parseInt(document.getElementById('bg-qty').value) || 1;
    const name = document.getElementById('bg-name').value;
    const code = document.getElementById('bg-code').value;
    const price = document.getElementById('bg-price').value;
    
    const showShop = document.getElementById('bg-show-shop')?.checked ?? true;
    const showName = document.getElementById('bg-show-name')?.checked ?? true;
    const showPrice = document.getElementById('bg-show-price')?.checked ?? true;
    const format = document.getElementById('bg-format')?.value || 'CODE128';
    const size = document.getElementById('bg-size')?.value || '5x3';
    
    const printArea = document.getElementById('print-area');
    printArea.innerHTML = '';
    
    for(let i = 0; i < qty; i++) {
        const label = document.createElement('div');
        label.className = 'barcode-label';
        
        if(size === '5x3') { label.style.width = '5cm'; label.style.height = '3cm'; }
        else if(size === '4x2.5') { label.style.width = '4cm'; label.style.height = '2.5cm'; }
        else if(size === '3.5x2') { label.style.width = '3.5cm'; label.style.height = '2cm'; }
        
        const shopDiv = document.createElement('div');
        shopDiv.className = 'bl-shop';
        shopDiv.textContent = globalShopName;
        shopDiv.style.display = showShop ? 'block' : 'none';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'bl-name';
        nameDiv.textContent = name;
        nameDiv.style.display = showName ? 'block' : 'none';
        
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const svgId = 'barcode-cust-' + i;
        svg.id = svgId;
        
        const priceDiv = document.createElement('div');
        priceDiv.className = 'bl-price';
        priceDiv.textContent = price + ' ' + (document.getElementById('set-currency').value || 'شيكل');
        priceDiv.style.display = showPrice ? 'block' : 'none';
        
        label.appendChild(shopDiv);
        label.appendChild(nameDiv);
        label.appendChild(svg);
        label.appendChild(priceDiv);
        printArea.appendChild(label);
        
        try {
            JsBarcode(svg, code, { 
                format: format, 
                width: 1.5, 
                height: size === '3.5x2' ? 25 : 40, 
                displayValue: true, 
                fontSize: size === '3.5x2' ? 10 : 14, 
                margin: 2 
            });
        } catch(err) {
            // fallback if ean13 is typed wrong but force print clicked
            JsBarcode(svg, code, { format: "CODE128", width: 1.5, height: 25, displayValue: true, fontSize: 10, margin: 2 });
        }
    }
    
    setTimeout(() => { window.print(); }, 200);
}

window.submitSupplier = function(e) {
    e.preventDefault();
    const id = document.getElementById('sup-id').value;
    const payload = { name: document.getElementById('sup-name').value, phone: document.getElementById('sup-phone').value, address: document.getElementById('sup-address').value };
    handleFormSubmit('suppliers', payload, id, 'supplier-modal');
}
window.submitCustomer = function(e) {
    e.preventDefault();
    const id = document.getElementById('cust-id').value;
    const payload = { name: document.getElementById('cust-name').value, phone: document.getElementById('cust-phone').value };
    handleFormSubmit('customers', payload, id, 'customer-modal');
}
window.submitProduct = function(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const payload = { name: document.getElementById('prod-name').value, barcode: document.getElementById('prod-barcode').value, quantity: parseInt(document.getElementById('prod-qty').value), sell_price: parseFloat(document.getElementById('prod-price').value) };
    handleFormSubmit('products', payload, id, 'product-modal');
}
window.updateRepairStatus = async function(id, status) {
    if(!status) return;
    try {
        await fetch(`/api/repairs/${id}/status`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({status}) });
        loadRepairs();
    } catch(e) {}
}

window.submitRepair = function(e) {
    e.preventDefault();
    const id = document.getElementById('rep-id').value;
    const payload = { 
        customer_name: document.getElementById('rep-cust').value, 
        phone: document.getElementById('rep-phone').value,
        device_brand: document.getElementById('rep-device').value, 
        problem: document.getElementById('rep-prob').value,
        cost: parseFloat(document.getElementById('rep-cost').value) || 0,
        advance_paid: parseFloat(document.getElementById('rep-advance').value) || 0,
        notes: document.getElementById('rep-notes').value || ''
    };
    handleFormSubmit('repairs', payload, id, 'repair-modal');
}
window.submitCheck = function(e) {
    e.preventDefault();
    const id = document.getElementById('chk-id').value;
    const payload = { type: document.getElementById('chk-type').value, check_number: document.getElementById('chk-number').value, bank: document.getElementById('chk-bank').value, amount: parseFloat(document.getElementById('chk-amount').value), due_date: document.getElementById('chk-date').value };
    handleFormSubmit('checks', payload, id, 'check-modal');
}

window.submitRestore = async function(e) {
    e.preventDefault();
    if(!confirm("تحذير خطير: استعادة النسخة الاحتياطية ستمسح كل بياناتك الحالية وتستبدلها ببيانات النسخة المرفوعة. هل أنت متأكد من رغبتك بالاستمرار؟")) return;
    
    const fileInput = document.getElementById('restore-file');
    if(!fileInput.files.length) return alert('يرجى اختيار ملف النسخة الاحتياطية أولاً');
    
    const formData = new FormData();
    formData.append('db_file', fileInput.files[0]);
    
    try {
        const res = await fetch('/api/restore', { method: 'POST', body: formData });
        const data = await res.json();
        if(data.success) {
            alert(data.message + ' (سيتم إغلاق النظام لتطبيق التغييرات. يرجى فتحه من جديد)');
            setTimeout(() => { window.close(); }, 2000); // Attempt to close electron window
        } else {
            alert('فشل الاستعادة: ' + data.message);
        }
    } catch(err) {
        alert('حدث خطأ أثناء الاستعادة');
    }
}

// POS Logic
window.loadPOS = function() {
    renderPOSProducts(allProducts);
    renderCart();
}
function renderPOSProducts(products) {
    const grid = document.getElementById('pos-product-grid');
    grid.innerHTML = '';
    products.forEach(p => {
        grid.innerHTML += `<div class="product-card" onclick="addToCart(${p.id})"><h4>${p.name}</h4><div class="text-primary" style="font-weight:bold">${p.sell_price}</div><small class="text-muted">الكمية: ${p.quantity}</small></div>`;
    });
}
window.addToCart = function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    if (product.quantity <= 0) return alert('غير متوفر');
    const existing = posCart.find(i => i.product_id === productId);
    if (existing) {
        if(existing.quantity < product.quantity) existing.quantity++;
        else alert('الكمية غير متوفرة');
    } else {
        posCart.push({ product_id: product.id, name: product.name, unit_price: product.sell_price, quantity: 1 });
    }
    renderCart();
}
function renderCart() {
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let total = 0;
    posCart.forEach((item, index) => {
        const itemTotal = item.unit_price * item.quantity;
        total += itemTotal;
        container.innerHTML += `<div class="cart-item"><div><strong>${item.name}</strong><div><small>${item.unit_price} x ${item.quantity}</small></div></div><div><span style="font-weight:bold; margin-left:10px">${itemTotal}</span><button class="icon-btn text-danger" onclick="removeFromCart(${index})"><i class="fa-solid fa-trash"></i></button></div></div>`;
    });
    document.getElementById('cart-total').textContent = total;
}
window.removeFromCart = function(index) {
    posCart.splice(index, 1);
    renderCart();
}
window.checkout = async function() {
    if(posCart.length === 0) return alert('السلة فارغة');
    try {
        const res = await fetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: posCart }) });
        const data = await res.json();
        if(data.success) {
            const printArea = document.getElementById('print-area');
            let total = 0;
            let itemsHtml = '';
            posCart.forEach(item => {
                const itemTotal = item.unit_price * item.quantity;
                total += itemTotal;
                itemsHtml += `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${itemTotal}</td></tr>`;
            });
            
            let logoHtml = '';
            if (globalShopLogo) {
                logoHtml = `<div style="text-align:center; margin-bottom:10px;"><img src="${globalShopLogo}" style="max-height: 50px; object-fit: contain;"></div>`;
            }
            
            let contactHtml = '';
            if (globalShopPhone) contactHtml += `<p style="margin: 2px 0; font-size: 11px;">📞 هاتف: ${globalShopPhone}</p>`;
            if (globalShopAddress) contactHtml += `<p style="margin: 2px 0; font-size: 11px;">📍 العنوان: ${globalShopAddress}</p>`;
            
            printArea.innerHTML = `
                <div class="thermal-receipt">
                    ${logoHtml}
                    <h2>${globalShopName}</h2>
                    ${contactHtml}
                    <div class="divider"></div>
                    <p>رقم الفاتورة: #${data.invoice_number || Math.floor(Math.random() * 10000)}</p>
                    <p>التاريخ: ${new Date().toLocaleString()}</p>
                    <div class="divider"></div>
                    <table>
                        <thead><tr><th>الصنف</th><th>الكمية</th><th>المجموع</th></tr></thead>
                        <tbody>${itemsHtml}</tbody>
                    </table>
                    <div class="divider"></div>
                    <div class="total-row">الإجمالي الصافي: ${total}</div>
                    <div class="divider"></div>
                    <p>شكراً لزيارتكم!</p>
                </div>
            `;
            setTimeout(() => { window.print(); }, 200);

            posCart = [];
            renderCart();
            loadAllData();
        } else alert(data.message);
    } catch(e) { alert('خطأ في العملية'); }
}

// Stocktake Logic
window.addStocktakeItem = function(product) {
    const existing = stocktakeCart.find(i => i.id === product.id);
    if(existing) {
        existing.counted++;
    } else {
        stocktakeCart.unshift({
            id: product.id,
            barcode: product.barcode,
            name: product.name,
            system_qty: product.quantity,
            counted: 1
        });
    }
    renderStocktake();
}

window.updateStocktakeQty = function(id, val) {
    const item = stocktakeCart.find(i => i.id === id);
    if(item) {
        item.counted = parseInt(val) || 0;
        renderStocktake();
    }
}

window.removeStocktakeItem = function(id) {
    stocktakeCart = stocktakeCart.filter(i => i.id !== id);
    renderStocktake();
}

window.renderStocktake = function() {
    const tbody = document.getElementById('stocktake-list');
    if(!tbody) return;
    if(stocktakeCart.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 30px;">لم يتم جرد أي عنصر بعد. قم بمسح باركود منتج للبدء.</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    stocktakeCart.forEach(item => {
        const diff = item.counted - item.system_qty;
        const diffSpan = diff === 0 ? `<span class="text-success"><i class="fa-solid fa-check"></i> 0</span>` : 
                         (diff > 0 ? `<span class="text-primary"><i class="fa-solid fa-arrow-up"></i> +${diff}</span>` : 
                                     `<span class="text-danger"><i class="fa-solid fa-arrow-down"></i> ${diff}</span>`);
                         
        tbody.innerHTML += `<tr>
            <td>${item.barcode || '-'}</td>
            <td>${item.name}</td>
            <td style="font-size: 1.1rem;">${item.system_qty}</td>
            <td>
                <input type="number" value="${item.counted}" onchange="updateStocktakeQty(${item.id}, this.value)" 
                style="width: 100px; padding: 8px; border-radius: 5px; border: 2px solid var(--primary); text-align: center; font-size: 1.1rem; font-weight: bold; background: white;">
            </td>
            <td style="font-weight: bold; font-size: 1.1rem;">${diffSpan}</td>
            <td><button class="icon-btn text-danger" onclick="removeStocktakeItem(${item.id})"><i class="fa-solid fa-times-circle" style="font-size: 1.2rem;"></i></button></td>
        </tr>`;
    });
}

window.submitStocktake = async function() {
    if(stocktakeCart.length === 0) return alert('قائمة الجرد فارغة!');
    if(!confirm('سيتم تعديل رصيد هذه المنتجات في النظام لتطابق الرصيد الفعلي الذي أدخلته. هل أنت متأكد؟')) return;
    
    const payload = {
        items: stocktakeCart.map(i => ({ id: i.id, quantity: i.counted }))
    };
    
    try {
        const res = await fetch('/api/products/stocktake', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
            alert('تم تسوية واعتماد الجرد بنجاح! تم تحديث المخزون.');
            stocktakeCart = [];
            renderStocktake();
            loadAllData(); // Refresh the rest of the application data
        } else {
            alert(data.message);
        }
    } catch(e) {
        alert('حدث خطأ في الاتصال بالخادم.');
    }
}

// ================== EXPENSES & REPORTS ==================
function renderExpenses() {
    const tbody = document.getElementById('expenses-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    allExpenses.forEach(e => {
        tbody.innerHTML += `<tr>
            <td>${e.title}</td>
            <td style="font-weight: bold; color: var(--danger);">${e.amount}</td>
            <td>${new Date(e.expense_date).toLocaleDateString()}</td>
            <td><button class="icon-btn text-danger" onclick="deleteExpense(${e.id})"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
}

window.submitExpense = async function(e) {
    e.preventDefault();
    const payload = {
        title: document.getElementById('exp-title').value,
        amount: document.getElementById('exp-amount').value
    };
    try {
        const res = await fetch('/api/expenses', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(data.success) {
            closeModal('expense-modal');
            loadAllData();
            e.target.reset();
        } else alert('خطأ في الإضافة');
    } catch(err) { alert('خطأ في الاتصال'); }
}

window.deleteExpense = async function(id) {
    if(!confirm('هل أنت متأكد من الحذف؟')) return;
    try {
        const res = await fetch('/api/expenses/' + id, { method: 'DELETE' });
        const data = await res.json();
        if(data.success) loadAllData();
    } catch(e) {}
}

window.loadFinancialReports = async function() {
    try {
        const res = await fetch('/api/reports/financial');
        const data = await res.json();
        if(data.success) {
            document.getElementById('rep-sales').textContent = data.data.total_sales;
            document.getElementById('rep-exp').textContent = data.data.total_expenses;
            document.getElementById('rep-profit').textContent = data.data.net_profit;
            document.getElementById('rep-inv-cost').textContent = data.data.inventory_cost;
            document.getElementById('rep-inv-sell').textContent = data.data.inventory_retail;
        }
    } catch(e) {}
}

// ================== EMPLOYEES ==================
function renderEmployees() {
    const tbody = document.getElementById('employees-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    allEmployees.forEach(e => {
        tbody.innerHTML += `<tr>
            <td><strong>${e.name}</strong></td>
            <td>${e.phone || '-'}</td>
            <td>${e.role}</td>
            <td style="color:var(--primary); font-weight:bold;">${e.salary}</td>
            <td>${new Date(e.hire_date).toLocaleDateString()}</td>
            <td><button class="icon-btn text-danger" onclick="deleteEmployee(${e.id})"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
}
window.submitEmployee = async function(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('emp-name').value,
        phone: document.getElementById('emp-phone').value,
        role: document.getElementById('emp-role').value,
        salary: document.getElementById('emp-salary').value
    };
    try {
        const res = await fetch('/api/employees', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if(data.success) { 
            closeModal('employee-modal'); 
            loadAllData(); 
            e.target.reset(); 
        } else {
            alert('حدث خطأ أثناء إضافة الموظف: ' + (data.message || 'فشلت العملية'));
        }
    } catch(err) {
        alert('حدث خطأ في الاتصال بالخادم.');
    }
}
window.deleteEmployee = async function(id) {
    if(!confirm('حذف هذا الموظف؟')) return;
    await fetch('/api/employees/' + id, { method: 'DELETE' });
    loadAllData();
}

// ================== INSTALLMENTS & DEBTS ==================
function renderInstallments() {
    const tbody = document.getElementById('installments-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    allInstallments.forEach(i => {
        const remaining = i.total_amount - i.paid_amount;
        const isPaidOff = remaining <= 0;
        
        let actions = isPaidOff 
            ? `<span class="badge" style="background:var(--success);color:white;">مكتمل</span>` 
            : `<button class="btn-primary btn-sm" onclick="payInstallment(${i.id})"><i class="fa-solid fa-money-bill"></i> تسديد</button>`;
            
        actions += ` <button class="icon-btn text-danger" onclick="deleteInstallment(${i.id})"><i class="fa-solid fa-trash"></i></button>`;

        tbody.innerHTML += `<tr style="${isPaidOff ? 'opacity: 0.7; background: rgba(16, 185, 129, 0.05);' : ''}">
            <td><strong>${i.customer_name}</strong></td>
            <td>${i.item_details}</td>
            <td>${i.total_amount}</td>
            <td style="color:var(--success);">${i.paid_amount}</td>
            <td style="color:var(--danger); font-weight:bold;">${remaining}</td>
            <td>${i.next_payment_date ? new Date(i.next_payment_date).toLocaleDateString() : '-'}</td>
            <td>${actions}</td>
        </tr>`;
    });
}

window.submitInstallment = async function(e) {
    e.preventDefault();
    const payload = {
        customer_name: document.getElementById('inst-cust').value,
        item_details: document.getElementById('inst-item').value,
        total_amount: document.getElementById('inst-total').value,
        paid_amount: document.getElementById('inst-paid').value,
        next_payment_date: document.getElementById('inst-date').value
    };
    try {
        const res = await fetch('/api/installments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if(data.success) { 
            closeModal('installment-modal'); 
            loadAllData(); 
            e.target.reset(); 
        } else {
            alert('حدث خطأ أثناء إضافة القسط / الدين: ' + (data.message || 'فشلت العملية'));
        }
    } catch(err) {
        alert('حدث خطأ في الاتصال بالخادم.');
    }
}

window.payInstallment = function(id) {
    document.getElementById('pay-inst-id').value = id;
    openModal('payment-modal');
}

window.submitPayment = async function(e) {
    e.preventDefault();
    const id = document.getElementById('pay-inst-id').value;
    const amount = document.getElementById('pay-amount').value;
    try {
        const res = await fetch('/api/installments/' + id + '/pay', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({amount}) });
        const data = await res.json();
        if(data.success) { 
            closeModal('payment-modal'); 
            loadAllData(); 
            e.target.reset(); 
        } else {
            alert('حدث خطأ أثناء تسجيل الدفع: ' + (data.message || 'فشلت العملية'));
        }
    } catch(err) {
        alert('حدث خطأ في الاتصال بالخادم.');
    }
}

window.deleteInstallment = async function(id) {
    if(!confirm('حذف هذا السجل؟')) return;
    await fetch('/api/installments/' + id, { method: 'DELETE' });
    loadAllData();
}

// ================== SALES HISTORY & RETURNS ==================
let shFilteredData = []; // Current filtered sales for export

function renderSalesHistory() {
    // On initial load (no filter), set default date range to this month
    const fromEl = document.getElementById('sh-from-date');
    const toEl = document.getElementById('sh-to-date');
    if (fromEl && !fromEl.value) {
        const now = new Date();
        fromEl.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        toEl.value = now.toISOString().split('T')[0];
    }
    applySalesFilter();
}

window.shSetRange = function(range) {
    const now = new Date();
    let from, to = now.toISOString().split('T')[0];
    if (range === 'today') {
        from = to;
    } else if (range === 'week') {
        const d = new Date(now); d.setDate(d.getDate() - 6);
        from = d.toISOString().split('T')[0];
    } else if (range === 'month') {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    } else {
        from = '2020-01-01'; to = '2099-12-31';
    }
    document.getElementById('sh-from-date').value = from;
    document.getElementById('sh-to-date').value = to;
    applySalesFilter();
}

window.applySalesFilter = function() {
    const tbody = document.getElementById('saleshistory-list');
    if (!tbody) return;
    const from = document.getElementById('sh-from-date')?.value || '';
    const to   = document.getElementById('sh-to-date')?.value   || '';
    const currency = document.getElementById('set-currency')?.value || 'شيكل';

    let filtered = allSalesHistory;
    if (from) filtered = filtered.filter(s => (s.sale_date || s.created_at || '').split('T')[0] >= from);
    if (to)   filtered = filtered.filter(s => (s.sale_date || s.created_at || '').split('T')[0] <= to);

    shFilteredData = filtered;
    tbody.innerHTML = '';

    // Compute totals
    const totalRevenue = filtered.reduce((a, s) => a + parseFloat(s.total      || 0), 0);
    const totalCost    = filtered.reduce((a, s) => a + parseFloat(s.total_cost || 0), 0);
    const totalProfit  = totalRevenue - totalCost;
    const avgProfitPct = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted);">
            <i class="fa-solid fa-inbox" style="font-size:2.5rem;display:block;margin-bottom:12px;opacity:0.4;"></i>
            لا توجد فواتير في الفترة المحددة
        </td></tr>`;
    } else {
        filtered.forEach((s, i) => {
            const date    = new Date(s.sale_date || s.created_at).toLocaleDateString('ar');
            const revenue = parseFloat(s.total      || 0);
            const cost    = parseFloat(s.total_cost || 0);
            const profit  = revenue - cost;
            const pct     = cost > 0 ? Math.round((profit / cost) * 100) : (revenue > 0 ? 100 : 0);
            const profitColor = profit >= 0 ? '#10b981' : '#f43f5e';
            const pctColor    = pct >= 0    ? '#10b981' : '#f43f5e';
            tbody.innerHTML += `<tr>
                <td style="color:var(--text-muted);font-size:0.85rem;">${i+1}</td>
                <td style="font-family:monospace;color:#6366f1;font-weight:bold;">${s.invoice_number || '#INV-'+s.id}</td>
                <td>${s.customer_name || '<span style="color:var(--text-muted)">نقدي</span>'}</td>
                <td style="color:var(--success);font-weight:800;">${revenue.toLocaleString()} ${currency}</td>
                <td style="color:#f59e0b;font-weight:600;">${cost.toLocaleString()} ${currency}</td>
                <td style="color:${profitColor};font-weight:800;">${profit.toLocaleString()} ${currency}</td>
                <td><span style="padding:3px 10px;border-radius:20px;background:${pct>=0?'rgba(16,185,129,0.12)':'rgba(244,63,94,0.12)'};color:${pctColor};font-weight:700;font-size:0.85rem;">${pct >= 0 ? '+' : ''}${pct}%</span></td>
                <td style="color:var(--text-muted);font-size:0.85rem;">${date}</td>
                <td>
                    <button class="icon-btn text-success" title="إرسال الفاتورة عبر واتساب" onclick="sendInvoiceWhatsApp(${s.id})"><i class="fa-brands fa-whatsapp"></i></button>
                    <button class="icon-btn text-warning" title="طباعة الفاتورة" onclick="reprintInvoice(${s.id})"><i class="fa-solid fa-print"></i></button>
                </td>
            </tr>`;
        });
    }

    // KPI cards
    const cards = document.getElementById('sh-summary-cards');
    if (cards) {
        cards.style.display = filtered.length > 0 ? 'grid' : 'none';
        const max = filtered.length > 0 ? Math.max(...filtered.map(s => parseFloat(s.total||0))) : 0;
        document.getElementById('sh-total-revenue').textContent = totalRevenue.toLocaleString() + ' ' + currency;
        document.getElementById('sh-total-invoices').textContent = filtered.length;
        document.getElementById('sh-avg-invoice').textContent = filtered.length > 0 ? Math.round(totalRevenue/filtered.length).toLocaleString() + ' ' + currency : '0';
        document.getElementById('sh-max-invoice').textContent   = max.toLocaleString() + ' ' + currency;

        // Update/add profit card
        let profitCard = document.getElementById('sh-profit-card');
        if (!profitCard) {
            profitCard = document.createElement('div');
            profitCard.id = 'sh-profit-card';
            profitCard.className = 'glass-card';
            profitCard.style.cssText = 'padding:18px;border-right:4px solid #10b981;text-align:center;';
            cards.appendChild(profitCard);
        }
        profitCard.innerHTML = `
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:6px;">صافي الربح</div>
            <div style="font-size:1.5rem;font-weight:900;color:${totalProfit>=0?'#10b981':'#f43f5e'}">${totalProfit.toLocaleString()} ${currency}</div>
            <div style="font-size:0.8rem;margin-top:4px;color:${avgProfitPct>=0?'#10b981':'#f43f5e'};font-weight:700;">${avgProfitPct>=0?'+':''}${avgProfitPct}% معدل الربح</div>`;
    }

    // Footer
    const footer = document.getElementById('sh-footer');
    const countLabel = document.getElementById('sh-count-label');
    const sumLabel   = document.getElementById('sh-sum-label');
    if (footer && filtered.length > 0) {
        footer.style.display = 'flex';
        const profitColor = totalProfit >= 0 ? 'var(--success)' : 'var(--danger)';
        countLabel.textContent = `الفواتير: ${filtered.length} | التكلفة: ${totalCost.toLocaleString()} ${currency}`;
        sumLabel.innerHTML = `الإيراد: <b>${totalRevenue.toLocaleString()} ${currency}</b> &nbsp;|&nbsp; الربح: <b style="color:${profitColor};">${totalProfit.toLocaleString()} ${currency}</b>`;
    } else if (footer) {
        footer.style.display = 'none';
    }
}

// Export to Excel (CSV)
window.exportSalesExcel = function() {
    if (!shFilteredData.length) return alert('لا توجد بيانات للتصدير. يرجى تطبيق الفلتر أولاً.');
    const currency = document.getElementById('set-currency')?.value || 'شيكل';
    let csv = '\uFEFF';
    csv += 'رقم,رقم الفاتورة,اسم العميل,إجمالي البيع,التكلفة الأصلية,صافي الربح,معدل الربح %,تاريخ البيع\n';
    shFilteredData.forEach((s, i) => {
        const date     = new Date(s.sale_date || s.created_at).toLocaleDateString('ar');
        const customer = (s.customer_name || 'نقدي').replace(/,/g, '،');
        const revenue  = parseFloat(s.total      || 0);
        const cost     = parseFloat(s.total_cost || 0);
        const profit   = revenue - cost;
        const pct      = cost > 0 ? Math.round((profit / cost) * 100) : (revenue > 0 ? 100 : 0);
        csv += `${i+1},${s.invoice_number||'#INV-'+s.id},${customer},${revenue.toFixed(2)} ${currency},${cost.toFixed(2)} ${currency},${profit.toFixed(2)} ${currency},${pct}%,${date}\n`;
    });
    const totalRev  = shFilteredData.reduce((a,s) => a + parseFloat(s.total||0), 0);
    const totalCost = shFilteredData.reduce((a,s) => a + parseFloat(s.total_cost||0), 0);
    const totalProfit = totalRev - totalCost;
    const avgPct = totalCost > 0 ? Math.round((totalProfit/totalCost)*100) : 0;
    csv += `,,الإجمالي,${totalRev.toFixed(2)} ${currency},${totalCost.toFixed(2)} ${currency},${totalProfit.toFixed(2)} ${currency},${avgPct}%,\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const from = document.getElementById('sh-from-date')?.value || 'all';
    const to   = document.getElementById('sh-to-date')?.value   || 'all';
    a.download = `تقرير_مبيعات_${from}_${to}.csv`;
    a.click();
}

// Export to PDF (print-based)
window.exportSalesPDF = function() {
    if (!shFilteredData.length) return alert('لا توجد بيانات للتصدير. يرجى تطبيق الفلتر أولاً.');
    printSalesReport();
}

// Print Sales Report
window.printSalesReport = function() {
    if (!shFilteredData.length) return alert('لا توجد بيانات للطباعة. يرجى تطبيق الفلتر أولاً.');
    const currency    = document.getElementById('set-currency')?.value || 'شيكل';
    const from        = document.getElementById('sh-from-date')?.value || '-';
    const to          = document.getElementById('sh-to-date')?.value   || '-';
    const totalRevenue = shFilteredData.reduce((a, s) => a + parseFloat(s.total      || 0), 0);
    const totalCost    = shFilteredData.reduce((a, s) => a + parseFloat(s.total_cost || 0), 0);
    const totalProfit  = totalRevenue - totalCost;
    const avgProfitPct = totalCost > 0 ? Math.round((totalProfit / totalCost) * 100) : 0;
    const profitColor  = totalProfit >= 0 ? '#16a34a' : '#dc2626';

    let rows = shFilteredData.map((s, i) => {
        const date    = new Date(s.sale_date || s.created_at).toLocaleDateString('ar');
        const revenue = parseFloat(s.total      || 0);
        const cost    = parseFloat(s.total_cost || 0);
        const profit  = revenue - cost;
        const pct     = cost > 0 ? Math.round((profit / cost) * 100) : (revenue > 0 ? 100 : 0);
        const pc = profit >= 0 ? '#16a34a' : '#dc2626';
        const bgRow   = i % 2 === 0 ? 'white' : '#f9fafb';
        return `<tr style="background:${bgRow};">
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;color:#888;">${i+1}</td>
            <td style="padding:8px;font-family:monospace;border-bottom:1px solid #eee;color:#6366f1;font-weight:bold;">${s.invoice_number || '#INV-'+s.id}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${s.customer_name || 'نقدي'}</td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;font-weight:bold;color:#16a34a;">${revenue.toLocaleString()} ${currency}</td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;color:#d97706;">${cost.toLocaleString()} ${currency}</td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;font-weight:bold;color:${pc};">${profit.toLocaleString()} ${currency}</td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;"><span style="padding:2px 8px;border-radius:20px;background:${pct>=0?'#f0fdf4':'#fef2f2'};color:${pc};font-weight:700;font-size:0.85rem;">${pct>=0?'+':''}${pct}%</span></td>
            <td style="padding:8px;text-align:center;border-bottom:1px solid #eee;color:#888;">${date}</td>
        </tr>`;
    }).join('');

    const printArea = document.getElementById('print-area');
    printArea.innerHTML = '<div style="font-family:Arial,sans-serif;direction:rtl;padding:30px;color:#111;background:white;max-width:980px;margin:0 auto;">'

        // ── Shared Header with shop name, logo, phone, address ──
        + buildPrintHeader({ title: 'تقرير المبيعات والأرباح المفصّل', from: from, to: to })

        + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">'
        + '<div style="background:#f0fdf4;border:2px solid #86efac;border-radius:12px;padding:16px;text-align:center;"><div style="font-size:0.78rem;color:#166534;margin-bottom:4px;">&#128200; إجمالي الإيرادات</div><div style="font-size:1.5rem;font-weight:900;color:#16a34a;">' + totalRevenue.toLocaleString() + '</div><div style="font-size:0.75rem;color:#166534;">' + currency + '</div></div>'
        + '<div style="background:#fef3c7;border:2px solid #fcd34d;border-radius:12px;padding:16px;text-align:center;"><div style="font-size:0.78rem;color:#92400e;margin-bottom:4px;">&#127991;&#65039; التكلفة الأصلية</div><div style="font-size:1.5rem;font-weight:900;color:#d97706;">' + totalCost.toLocaleString() + '</div><div style="font-size:0.75rem;color:#92400e;">' + currency + '</div></div>'
        + '<div style="background:' + (totalProfit>=0?'#f0fdf4':'#fff1f2') + ';border:2px solid ' + (totalProfit>=0?'#86efac':'#fca5a5') + ';border-radius:12px;padding:16px;text-align:center;"><div style="font-size:0.78rem;color:' + profitColor + ';margin-bottom:4px;">&#128176; صافي الربح</div><div style="font-size:1.5rem;font-weight:900;color:' + profitColor + ';">' + totalProfit.toLocaleString() + '</div><div style="font-size:0.75rem;color:' + profitColor + ';">' + currency + '</div></div>'
        + '<div style="background:#eff6ff;border:2px solid #93c5fd;border-radius:12px;padding:16px;text-align:center;"><div style="font-size:0.78rem;color:#1e40af;margin-bottom:4px;">&#128202; معدل الربح</div><div style="font-size:1.5rem;font-weight:900;color:#2563eb;">' + (avgProfitPct>=0?'+':'') + avgProfitPct + '%</div><div style="font-size:0.75rem;color:#1e40af;">' + shFilteredData.length + ' فاتورة</div></div>'
        + '</div>'

        + '<table style="width:100%;border-collapse:collapse;font-size:0.9rem;"><thead><tr style="background:#6366f1;color:white;">'
        + '<th style="padding:11px;text-align:center;">#</th><th style="padding:11px;">رقم الفاتورة</th><th style="padding:11px;">العميل</th>'
        + '<th style="padding:11px;text-align:center;">إجمالي البيع</th><th style="padding:11px;text-align:center;">التكلفة الأصلية</th>'
        + '<th style="padding:11px;text-align:center;">صافي الربح</th><th style="padding:11px;text-align:center;">معدل الربح</th>'
        + '<th style="padding:11px;text-align:center;">التاريخ</th></tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '<tfoot><tr style="background:#f1f5f9;font-weight:bold;font-size:1rem;">'
        + '<td colspan="3" style="padding:13px;border-top:3px solid #6366f1;">الإجمالي الكلي للفترة</td>'
        + '<td style="padding:13px;text-align:center;border-top:3px solid #6366f1;color:#16a34a;font-size:1.05rem;">' + totalRevenue.toLocaleString() + ' ' + currency + '</td>'
        + '<td style="padding:13px;text-align:center;border-top:3px solid #6366f1;color:#d97706;">' + totalCost.toLocaleString() + ' ' + currency + '</td>'
        + '<td style="padding:13px;text-align:center;border-top:3px solid #6366f1;color:' + profitColor + ';font-size:1.1rem;">' + totalProfit.toLocaleString() + ' ' + currency + '</td>'
        + '<td style="padding:13px;text-align:center;border-top:3px solid #6366f1;color:#2563eb;">' + (avgProfitPct>=0?'+':'') + avgProfitPct + '%</td>'
        + '<td style="border-top:3px solid #6366f1;"></td></tr></tfoot></table>'

        // ── Shared Footer with shop info ──
        + buildPrintFooter()
        + '</div>';
    setTimeout(() => window.print(), 200);
}



function renderReturns() {
    const tbody = document.getElementById('returns-list');
    if(!tbody) return;
    tbody.innerHTML = '';
    allReturns.forEach(r => {
        tbody.innerHTML += `<tr>
            <td><strong>${r.product_name}</strong></td>
            <td>${r.reason}</td>
            <td style="color:var(--danger); font-weight:bold;">${r.amount}</td>
            <td>${new Date(r.return_date).toLocaleDateString()}</td>
            <td><button class="icon-btn text-danger" onclick="deleteReturn(${r.id})"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
}

window.submitReturn = async function(e) {
    e.preventDefault();
    const payload = {
        product_name: document.getElementById('ret-name').value,
        reason: document.getElementById('ret-reason').value,
        amount: document.getElementById('ret-amount').value
    };
    try {
        const res = await fetch('/api/returns', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if(data.success) { 
            closeModal('return-modal'); 
            loadAllData(); 
            e.target.reset(); 
        } else {
            alert('حدث خطأ أثناء تسجيل المرتجع: ' + (data.message || 'فشلت العملية'));
        }
    } catch(err) {
        alert('حدث خطأ في الاتصال بالخادم.');
    }
}

window.deleteReturn = async function(id) {
    if(!confirm('حذف هذا المرتجع من السجل؟')) return;
    await fetch('/api/returns/' + id, { method: 'DELETE' });
    loadAllData();
}

// ================== REPAIR PRINTING & QUICK LOOKUP ==================
window.printRepairReceipt = function(id) {
    const r = allRepairs.find(x => x.id === id);
    if(!r) return alert('التذكرة غير موجودة');
    
    const printArea = document.getElementById('print-area');
    const currency = document.getElementById('set-currency')?.value || 'شيكل';
    let logoHtml = '';
    if (globalShopLogo) {
        logoHtml = `<div style="text-align: center; margin-bottom: 5px;"><img src="${globalShopLogo}" style="max-height: 40px; object-fit: contain;"></div>`;
    }
    
    let contactHtml = '';
    if (globalShopPhone) contactHtml += `<div style="font-size: 0.8rem; color: #555; margin-top: 3px;">📞 ${globalShopPhone}</div>`;
    if (globalShopAddress) contactHtml += `<div style="font-size: 0.8rem; color: #555; margin-top: 2px;">📍 ${globalShopAddress}</div>`;

    printArea.innerHTML = `
        <div class="repair-print-container" style="font-family: Arial, sans-serif; direction: rtl; padding: 10px;">
            <!-- COPY 1: SHOP COPY -->
            <div class="receipt-copy" style="border: 1px dashed #000; padding: 15px; margin-bottom: 30px; background: white; color: black; border-radius: 5px;">
                <div style="text-align: center; margin-bottom: 10px;">
                    ${logoHtml}
                    <h2 style="margin: 0; font-size: 1.6rem; font-weight: bold;">${globalShopName}</h2>
                    ${contactHtml}
                    <h4 style="margin: 8px 0 0 0; background: #000; color: #fff; display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 0.9rem;">نسخة المحل (سند استلام)</h4>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.9rem; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    <span>رقم التذكرة: <strong>${r.ticket_number}</strong></span>
                    <span>التاريخ: ${new Date().toLocaleDateString()}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 10px;">
                    <tr><td style="padding: 4px 0; font-weight: bold; width: 35%;">العميل:</td><td style="padding: 4px 0;">${r.customer_name}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">الهاتف:</td><td style="padding: 4px 0; direction: ltr; text-align: right;">${r.phone || '-'}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">الجهاز:</td><td style="padding: 4px 0;">${r.device_brand}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">العطل / المشكلة:</td><td style="padding: 4px 0;">${r.problem}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">التكلفة المقدرة:</td><td style="padding: 4px 0; font-weight: bold; color: var(--danger);">${r.cost || 0} ${currency}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">المدفوع مقدماً:</td><td style="padding: 4px 0; color: var(--success);">${r.advance_paid || 0} ${currency}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">حالة الجهاز:</td><td style="padding: 4px 0;">${r.status === 'ready' ? 'جاهز للاستلام' : (r.status === 'working' ? 'جاري العمل' : 'قيد الانتظار')}</td></tr>
                </table>
                <div style="text-align: center; margin-top: 10px;">
                    <svg id="barcode-shop-${r.id}"></svg>
                </div>
            </div>

            <!-- CUTTING LINE -->
            <div style="border-top: 2px dashed #000; text-align: center; margin: 20px 0; position: relative;">
                <span style="position: absolute; top: -12px; background: white; padding: 0 10px; font-size: 0.8rem; color: #555;"><i class="fa-solid fa-scissors"></i> خط القص</span>
            </div>

            <!-- COPY 2: CUSTOMER COPY -->
            <div class="receipt-copy" style="border: 1px dashed #000; padding: 15px; background: white; color: black; border-radius: 5px;">
                <div style="text-align: center; margin-bottom: 10px;">
                    ${logoHtml}
                    <h2 style="margin: 0; font-size: 1.6rem; font-weight: bold;">${globalShopName}</h2>
                    ${contactHtml}
                    <h4 style="margin: 8px 0 0 0; background: #000; color: #fff; display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 0.9rem;">نسخة الزبون (سند استلام)</h4>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.9rem; border-bottom: 1px solid #ddd; padding-bottom: 5px;">
                    <span>رقم التذكرة: <strong>${r.ticket_number}</strong></span>
                    <span>التاريخ: ${new Date().toLocaleDateString()}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 10px;">
                    <tr><td style="padding: 4px 0; font-weight: bold; width: 35%;">العميل:</td><td style="padding: 4px 0;">${r.customer_name}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">الهاتف:</td><td style="padding: 4px 0; direction: ltr; text-align: right;">${r.phone || '-'}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">الجهاز:</td><td style="padding: 4px 0;">${r.device_brand}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">العطل / المشكلة:</td><td style="padding: 4px 0;">${r.problem}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">التكلفة المقدرة:</td><td style="padding: 4px 0; font-weight: bold; color: var(--danger);">${r.cost || 0} ${currency}</td></tr>
                    <tr><td style="padding: 4px 0; font-weight: bold;">المدفوع مقدماً:</td><td style="padding: 4px 0; color: var(--success);">${r.advance_paid || 0} ${currency}</td></tr>
                </table>
                <div style="border-top: 1px solid #eee; padding-top: 8px; margin-top: 8px; font-size: 0.75rem; color: #555; line-height: 1.4;">
                    <strong>شروط الصيانة:</strong>
                    <ol style="margin: 5px 0 0 15px; padding: 0;">
                        <li>يرجى إحضار هذا الوصل عند استلام الجهاز.</li>
                        <li>المحل غير مسؤول عن الأجهزة التي تترك لأكثر من 30 يوماً من تاريخ الإنجاز.</li>
                        <li>لا توجد كفالة على الأجهزة التي تعرضت لسوائل أو كسر خارجي بعد الاستلام.</li>
                    </ol>
                </div>
                <div style="text-align: center; margin-top: 15px;">
                    <svg id="barcode-cust-${r.id}"></svg>
                </div>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        try {
            JsBarcode(`#barcode-shop-${r.id}`, r.ticket_number, {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 12
            });
            JsBarcode(`#barcode-cust-${r.id}`, r.ticket_number, {
                format: "CODE128",
                width: 1.5,
                height: 40,
                displayValue: true,
                fontSize: 12
            });
        } catch(e) { console.error('Error generating receipt barcodes', e); }
        window.print();
    }, 200);
}

window.lookupRepairTicket = function(barcode) {
    if(!barcode) return alert('الرجاء إدخال رقم التذكرة أو مسح الباركود');
    
    const searchInput = document.getElementById('repair-barcode-input');
    if(searchInput) searchInput.value = '';
    
    const r = allRepairs.find(x => x.ticket_number.trim() === barcode.trim());
    if(!r) {
        alert('لم يتم العثور على تذكرة صيانة بهذا الرقم: ' + barcode);
        return;
    }
    
    const currency = document.getElementById('set-currency')?.value || 'شيكل';
    
    document.getElementById('rep-status-ticket').textContent = r.ticket_number;
    document.getElementById('rep-status-cust').textContent = r.customer_name;
    document.getElementById('rep-status-device').textContent = r.device_brand;
    document.getElementById('rep-status-problem').textContent = r.problem;
    document.getElementById('rep-status-details').textContent = r.notes || 'لم يتم البدء أو لم تُسجل ملاحظات صيانة بعد.';
    document.getElementById('rep-status-cost').textContent = (r.cost || 0) + ' ' + currency;
    document.getElementById('rep-status-paid').textContent = (r.advance_paid || 0) + ' ' + currency;
    
    const alertBox = document.getElementById('rep-status-alert-box');
    if(r.status === 'ready') {
        alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
        alertBox.style.color = '#10b981';
        alertBox.innerHTML = '<i class="fa-solid fa-circle-check" style="font-size:1.5rem;"></i> <strong>تمت الصيانة بنجاح! الجهاز جاهز للاستلام.</strong>';
    } else if(r.status === 'working') {
        alertBox.style.background = 'rgba(59, 130, 246, 0.15)';
        alertBox.style.color = '#3b82f6';
        alertBox.innerHTML = '<i class="fa-solid fa-clock-rotate-left" style="font-size:1.5rem;"></i> <strong>الجهاز قيد الصيانة حالياً (جاري العمل عليه).</strong>';
    } else {
        alertBox.style.background = 'rgba(245, 158, 11, 0.15)';
        alertBox.style.color = '#f59e0b';
        alertBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;"></i> <strong>الجهاز قيد الانتظار في طابور الصيانة.</strong>';
    }
    
    openModal('repair-status-modal');
}

// ================== INTEGRATED ACCOUNT STATEMENTS SYSTEM ==================
let statementLastLookup = null; // Store query results globally for quick printing

window.loadStatementsPanel = function() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    
    const fromInput = document.getElementById('stmt-from-date');
    const toInput = document.getElementById('stmt-to-date');
    if (fromInput) fromInput.value = firstDay;
    if (toInput) toInput.value = today;
    
    const typeSelect = document.getElementById('stmt-type');
    if (typeSelect) typeSelect.value = 'customer';
    
    onStatementTypeChange();
}

window.onStatementTypeChange = async function() {
    const type = document.getElementById('stmt-type').value;
    const select = document.getElementById('stmt-entity-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">جاري تحميل القائمة...</option>';
    
    try {
        let url = '';
        if (type === 'customer') url = '/api/customers';
        else if (type === 'supplier') url = '/api/suppliers';
        else if (type === 'employee') url = '/api/employees';
        
        const res = await fetch(url);
        const data = await res.json();
        const items = data.data || [];
        
        if (items.length === 0) {
            select.innerHTML = '<option value="">لا توجد سجلات مضافة بعد</option>';
            return;
        }
        
        select.innerHTML = '<option value="">-- اختر الاسم من القائمة --</option>';
        items.forEach(item => {
            select.innerHTML += `<option value="${item.id}">${item.name} (${item.phone || '-'})</option>`;
        });
    } catch (e) {
        select.innerHTML = '<option value="">خطأ في تحميل البيانات</option>';
    }
}

window.lookupStatement = async function() {
    const type = document.getElementById('stmt-type').value;
    const entityId = document.getElementById('stmt-entity-select').value;
    const fromDate = document.getElementById('stmt-from-date').value;
    const toDate = document.getElementById('stmt-to-date').value;
    const currency = document.getElementById('set-currency')?.value || 'شيكل';
    
    if (!entityId) {
        alert('الرجاء اختيار الاسم من القائمة للاستعلام!');
        return;
    }
    
    try {
        const res = await fetch(`/api/statements/lookup?type=${type}&id=${entityId}&from_date=${fromDate}&to_date=${toDate}`);
        const data = await res.json();
        
        if (!data.success) {
            alert('فشل جلب البيانات: ' + data.message);
            return;
        }
        
        statementLastLookup = data;
        
        const infoCard = document.getElementById('stmt-account-details-card');
        infoCard.style.display = 'block';
        document.getElementById('stmt-card-name').textContent = data.name;
        document.getElementById('stmt-card-phone').textContent = data.phone;
        document.getElementById('stmt-card-from').textContent = fromDate;
        document.getElementById('stmt-card-to').textContent = toDate;
        document.getElementById('stmt-card-init').textContent = data.initialBalance + ' ' + currency;
        
        const tbody = document.getElementById('statements-list');
        tbody.innerHTML = '';
        
        if (data.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding: 30px;">لا توجد حركات مالية مسجلة لهذا الحساب خلال الفترة المحددة.</td></tr>`;
            return;
        }
        
        let cumulativeBalance = 0;
        let totalDebit = 0;
        let totalCredit = 0;
        
        data.data.forEach(tr => {
            const debit = parseFloat(tr.debit) || 0;
            const credit = parseFloat(tr.credit) || 0;
            
            totalDebit += debit;
            totalCredit += credit;
            cumulativeBalance += (debit - credit);
            
            const dateFormatted = new Date(tr.date).toLocaleString('ar-EG', { hour12: true });
            
            tbody.innerHTML += `
                <tr>
                    <td style="font-family: monospace;">${dateFormatted}</td>
                    <td><span class="badge" style="background: rgba(99,102,241,0.1); color: var(--primary); font-weight: bold; padding: 4px 8px;">${tr.type}</span></td>
                    <td>${tr.ref || '-'}</td>
                    <td style="color: var(--danger); font-weight: bold;">${debit > 0 ? debit + ' ' + currency : '-'}</td>
                    <td style="color: var(--success); font-weight: bold;">${credit > 0 ? credit + ' ' + currency : '-'}</td>
                    <td style="font-weight: bold; color: ${cumulativeBalance >= 0 ? '#10b981' : '#ef4444'};">${cumulativeBalance} ${currency}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML += `
            <tr style="background: rgba(0, 0, 0, 0.05); border-top: 2px solid #ddd; font-weight: bold;">
                <td colspan="3" class="text-left" style="font-size: 1.1rem; padding: 12px;">المجموع الإجمالي للفترة:</td>
                <td style="color: var(--danger); font-size: 1.1rem;">${totalDebit} ${currency}</td>
                <td style="color: var(--success); font-size: 1.1rem;">${totalCredit} ${currency}</td>
                <td style="font-size: 1.1rem; color: ${cumulativeBalance >= 0 ? '#10b981' : '#ef4444'};">${cumulativeBalance} ${currency}</td>
            </tr>
        `;
        
    } catch(err) {
        alert('حدث خطأ أثناء إجراء الاستعلام.');
    }
}

window.printStatementReport = function() {
    if (!statementLastLookup) {
        alert('الرجاء الضغط على "احتساب وعرض" أولاً لتوليد كشف الحساب قبل طباعته!');
        return;
    }
    
    const d = statementLastLookup;
    const currency = document.getElementById('set-currency')?.value || 'شيكل';
    const fromDate = document.getElementById('stmt-from-date').value;
    const toDate = document.getElementById('stmt-to-date').value;
    
    let trHtml = '';
    let cumulativeBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    
    d.data.forEach(tr => {
        const debit = parseFloat(tr.debit) || 0;
        const credit = parseFloat(tr.credit) || 0;
        totalDebit += debit;
        totalCredit += credit;
        cumulativeBalance += (debit - credit);
        
        const dateFormatted = new Date(tr.date).toLocaleDateString('ar-EG');
        
        trHtml += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 8px; text-align: center;">${dateFormatted}</td>
                <td style="padding: 8px; text-align: center;">${tr.type}</td>
                <td style="padding: 8px; text-align: right;">${tr.ref || '-'}</td>
                <td style="padding: 8px; text-align: center; color: #ef4444; font-weight: bold;">${debit > 0 ? debit + ' ' + currency : '-'}</td>
                <td style="padding: 8px; text-align: center; color: #10b981; font-weight: bold;">${credit > 0 ? credit + ' ' + currency : '-'}</td>
                <td style="padding: 8px; text-align: center; font-weight: bold;">${cumulativeBalance} ${currency}</td>
            </tr>
        `;
    });
    
    if (d.data.length === 0) {
        trHtml = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: #777;">لا توجد حركات مالية مسجلة للفترة المحددة.</td></tr>`;
    }
    
    const printArea = document.getElementById('print-area');
    
    let logoHtml = '';
    if (globalShopLogo) {
        logoHtml = `<div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; background: white; padding: 2px; border: 1px solid #ddd; margin-left: 15px; display: flex; align-items: center; justify-content: center;"><img src="${globalShopLogo}" style="max-width: 100%; max-height: 100%; object-fit: contain;"></div>`;
    }

    let contactInfoHtml = '';
    if (globalShopPhone) contactInfoHtml += `<p style="margin: 3px 0 0 0; font-size: 0.85rem; color: #555;">📞 ${globalShopPhone}</p>`;
    if (globalShopAddress) contactInfoHtml += `<p style="margin: 2px 0 0 0; font-size: 0.85rem; color: #555;">📍 ${globalShopAddress}</p>`;

    printArea.innerHTML = `
        <div style="font-family: Arial, sans-serif; direction: rtl; padding: 25px; color: black; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center;">
                    ${logoHtml}
                    <div>
                        <h1 style="margin: 0; font-size: 2.2rem; font-weight: bold;">${globalShopName}</h1>
                        ${contactInfoHtml}
                        <p style="margin: 5px 0 0 0; font-size: 1rem; color: #444;"><i class="fa-solid fa-mobile-screen-button"></i> المركز المعتمد لإصدار كشوفات الحساب الفورية</p>
                    </div>
                </div>
                <div style="text-align: left;">
                    <h2 style="margin: 0 0 5px 0; color: #1e3a8a; font-size: 1.6rem; font-weight: bold;">كشف حساب مالي تفصيلي</h2>
                    <span style="background: #1e3a8a; color: white; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 0.95rem;">
                        ${document.getElementById('stmt-type').value === 'customer' ? 'كشف حساب عميل' : (document.getElementById('stmt-type').value === 'supplier' ? 'كشف حساب مورد' : 'كشف حساب موظف')}
                    </span>
                </div>
            </div>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 15px; font-size: 1.05rem;">
                <div>
                    <p style="margin: 3px 0;">اسم الحساب: <strong>${d.name}</strong></p>
                    <p style="margin: 3px 0;">رقم الهاتف: <strong>${d.phone}</strong></p>
                </div>
                <div>
                    <p style="margin: 3px 0;">تاريخ الكشف: <strong>${new Date().toLocaleDateString('ar-EG')}</strong></p>
                    <p style="margin: 3px 0;">الفترة المحددة: من <strong>${fromDate}</strong> إلى <strong>${toDate}</strong></p>
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 1rem;">
                <thead>
                    <tr style="background: #1e3a8a; color: white;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">التاريخ</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">نوع الحركة</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right; width: 35%;">البيان / المرجع</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center; color: white;">مدين (+)</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center; color: white;">دائن (-)</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">الرصيد التراكمي</th>
                    </tr>
                </thead>
                <tbody>
                    ${trHtml}
                    <tr style="background: #e2e8f0; font-weight: bold; border-top: 2px solid #333;">
                        <td colspan="3" style="padding: 10px; text-align: left; font-size: 1.1rem;">المجموع الكلي:</td>
                        <td style="padding: 10px; text-align: center; color: #ef4444; font-size: 1.1rem;">${totalDebit} ${currency}</td>
                        <td style="padding: 10px; text-align: center; color: #10b981; font-size: 1.1rem;">${totalCredit} ${currency}</td>
                        <td style="padding: 10px; text-align: center; font-size: 1.1rem;">${cumulativeBalance} ${currency}</td>
                    </tr>
                </tbody>
            </table>
            
            <div style="margin-top: 20px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; text-align: center; background: #f8fafc;">
                <p style="margin: 0; font-size: 1.25rem; font-weight: bold; color: #1e3a8a;">
                    الرصيد النهائي المستحق حتى تاريخ اليوم:
                    <span style="font-size: 1.45rem; color: ${cumulativeBalance >= 0 ? '#10b981' : '#ef4444'}; margin-right: 10px;">
                        ${cumulativeBalance} ${currency}
                    </span>
                </p>
                <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #555;">
                    (${cumulativeBalance > 0 ? 'مبلغ مستحق لنا بذمة الحساب' : (cumulativeBalance < 0 ? 'مبلغ مستحق للحساب علينا' : 'الحساب متوازن بالكامل')})
                </p>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 60px; font-size: 1.05rem;">
                <div style="text-align: center; width: 200px; border-top: 1px solid #555; padding-top: 8px;">توقيع المحاسب / فني الأنظمة</div>
                <div style="text-align: center; width: 200px; border-top: 1px solid #555; padding-top: 8px;">توقيع صاحب الحساب</div>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        window.print();
    }, 200);
}


// ================== PURCHASES MODULE JS ==================
window.loadPurchases = async function() {
    try {
        const supSel = document.getElementById('pur-supplier');
        if (supSel && allSuppliers.length > 0) {
            supSel.innerHTML = '<option value="">-- اختر مورداً --</option>';
            allSuppliers.forEach(s => {
                supSel.innerHTML += '<option value="' + s.id + '" data-name="' + s.name + '">' + s.name + (s.phone ? ' - ' + s.phone : '') + '</option>';
            });
        }
        const debtRes = await fetch('/api/purchases/supplier-debts');
        const debtData = await debtRes.json();
        if (debtData.success) renderSupplierDebts(debtData.data);
        const purRes = await fetch('/api/purchases');
        const purData = await purRes.json();
        if (purData.success) { allPurchases = purData.data; renderPurchasesTable(allPurchases); }
        const itemsList = document.getElementById('pur-items-list');
        if (itemsList && itemsList.children.length === 0) purAddItemRow();
    } catch(e) { console.error(e); }
}

function renderSupplierDebts(debts) {
    const container = document.getElementById('pur-debts-list');
    if (!container) return;
    const currency = document.getElementById('set-currency')?.value || 'شيكل';
    const totalDebt = debts.reduce((a,d) => a + parseFloat(d.total_debt||0), 0);
    const totalPur  = debts.reduce((a,d) => a + parseFloat(d.total_purchases||0), 0);
    const cardsEl = document.getElementById('pur-debt-cards');
    if (cardsEl) {
        cardsEl.innerHTML =
            '<div class="glass-card" style="padding:18px;border-right:4px solid #f43f5e;text-align:center;">'
          + '<div style="font-size:0.85rem;color:#94a3b8;margin-bottom:6px;">اجمالي الديون</div>'
          + '<div style="font-size:1.8rem;font-weight:900;color:#f43f5e;">' + totalDebt.toLocaleString() + ' ' + currency + '</div></div>'
          + '<div class="glass-card" style="padding:18px;border-right:4px solid #6366f1;text-align:center;">'
          + '<div style="font-size:0.85rem;color:#94a3b8;margin-bottom:6px;">اجمالي المشتريات</div>'
          + '<div style="font-size:1.8rem;font-weight:900;color:#6366f1;">' + totalPur.toLocaleString() + ' ' + currency + '</div></div>'
          + '<div class="glass-card" style="padding:18px;border-right:4px solid #10b981;text-align:center;">'
          + '<div style="font-size:0.85rem;color:#94a3b8;margin-bottom:6px;">الموردون</div>'
          + '<div style="font-size:1.8rem;font-weight:900;color:#10b981;">' + debts.filter(d => d.invoice_count > 0).length + '</div></div>';
    }
    if (!debts.some(d => d.total_debt > 0 || d.invoice_count > 0)) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;">لا توجد فواتير بعد</div>';
        return;
    }
    let html = '';
    debts.forEach(s => {
        if (s.invoice_count === 0) return;
        const pct = s.total_purchases > 0 ? Math.round((s.total_paid / s.total_purchases) * 100) : 0;
        const isDebt = s.total_debt > 0;
        const debtColor = isDebt ? '#f43f5e' : '#10b981';
        const borderColor = isDebt ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)';
        html += '<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid ' + borderColor + ';margin-bottom:10px;">'
              + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
              + '<div><div style="font-weight:700;color:#f1f5f9;">' + s.name + '</div>'
              + '<div style="font-size:0.78rem;color:#94a3b8;">' + (s.phone||'') + ' - ' + s.invoice_count + ' فاتورة</div></div>'
              + '<div style="text-align:left;"><div style="font-weight:900;font-size:1.1rem;color:' + debtColor + ';">' + parseFloat(s.total_debt).toLocaleString() + ' ' + currency + '</div>'
              + '<div style="font-size:0.75rem;color:#94a3b8;">اجمالي الشراء: ' + parseFloat(s.total_purchases).toLocaleString() + '</div></div></div>'
              + '<div style="height:6px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">'
              + '<div style="width:' + pct + '%;height:100%;background:#10b981;border-radius:4px;"></div></div>'
              + '<div style="font-size:0.75rem;color:#94a3b8;margin-top:4px;display:flex;justify-content:space-between;">'
              + '<span>مدفوع: ' + parseFloat(s.total_paid).toLocaleString() + ' (' + pct + '%)</span>'
              + (isDebt ? '<button onclick="purPaySupplier(' + s.id + ')" style="font-size:0.75rem;padding:3px 10px;border-radius:6px;border:1px solid #10b981;background:rgba(16,185,129,0.1);color:#10b981;cursor:pointer;font-family:Tajawal;">تسديد دفعة</button>' : '')
              + '</div></div>';
    });
    container.innerHTML = html;
}

function renderPurchasesTable(purchases) {
    const tbody = document.getElementById('purchases-list');
    if (!tbody) return;
    const currency = document.getElementById('set-currency')?.value || 'شيكل';
    tbody.innerHTML = '';
    if (!purchases.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:#94a3b8;">لا توجد فواتير شراء بعد</td></tr>';
        return;
    }
    purchases.forEach((p, i) => {
        const date = new Date(p.purchase_date).toLocaleDateString('ar');
        const isDebt = parseFloat(p.remaining) > 0;
        const debtColor = isDebt ? '#f43f5e' : '#10b981';
        tbody.innerHTML += '<tr>'
            + '<td style="font-family:monospace;color:#6366f1;font-weight:bold;">' + p.invoice_number + '</td>'
            + '<td><strong>' + p.supplier_name + '</strong></td>'
            + '<td>' + parseFloat(p.total).toLocaleString() + ' ' + currency + '</td>'
            + '<td style="color:#10b981;">' + parseFloat(p.paid).toLocaleString() + ' ' + currency + '</td>'
            + '<td style="color:' + debtColor + ';font-weight:bold;">' + (isDebt ? parseFloat(p.remaining).toLocaleString() + ' ' + currency : 'مسدد بالكامل') + '</td>'
            + '<td style="color:#94a3b8;">' + date + '</td>'
            + '<td>' + (isDebt ? '<button class="icon-btn" style="color:#10b981;" onclick="purPayInvoice(' + p.id + ',' + p.remaining + ')" title="تسديد"><i class="fa-solid fa-money-bill-wave"></i></button>' : '')
            + '<button class="icon-btn" style="color:#f43f5e;" onclick="deletePurchase(' + p.id + ')" title="حذف"><i class="fa-solid fa-trash"></i></button>'
            + '</td></tr>';
    });
}

let purRowId = 0;
window.purAddItemRow = function() {
    purRowId++;
    const id = purRowId;
    const container = document.getElementById('pur-items-list');
    if (!container) return;
    let opts = '<option value="">-- صنف حر --</option>';
    allProducts.forEach(p => { opts += '<option value="' + p.id + '" data-name="' + p.name + '">' + p.name + '</option>'; });
    const row = document.createElement('div');
    row.id = 'pur-row-' + id;
    row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:start;margin-bottom:4px;';
    const s = 'width:100%;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#f1f5f9;font-family:Tajawal;font-size:0.9rem;';
    row.innerHTML = '<div>'
        + '<select id="pur-prod-' + id + '" onchange="purFillProductName(' + id + ')" style="' + s + 'margin-bottom:5px;">' + opts + '</select>'
        + '<input type="text" id="pur-name-' + id + '" placeholder="اسم الصنف" oninput="purUpdateSummary()" style="' + s + '"></div>'
        + '<input type="number" id="pur-qty-' + id + '" value="1" min="1" oninput="purUpdateSummary()" style="' + s + 'text-align:center;">'
        + '<input type="number" id="pur-cost-' + id + '" placeholder="سعر الوحدة" min="0" oninput="purUpdateSummary()" style="' + s + 'text-align:center;">'
        + '<button style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(244,63,94,0.3);background:rgba(244,63,94,0.1);color:#f43f5e;cursor:pointer;"><i class="fa-solid fa-times"></i></button>';
    row.querySelector('button').onclick = function() { row.remove(); purUpdateSummary(); };
    container.appendChild(row);
}

window.purFillProductName = function(id) {
    const sel = document.getElementById('pur-prod-' + id);
    const nameInput = document.getElementById('pur-name-' + id);
    if (sel && nameInput) { const opt = sel.options[sel.selectedIndex]; nameInput.value = opt.getAttribute('data-name') || ''; }
    purUpdateSummary();
}

window.purUpdateSummary = function() {
    let total = 0;
    document.querySelectorAll('[id^="pur-row-"]').forEach(row => {
        const rid = row.id.replace('pur-row-', '');
        const qty  = parseInt(document.getElementById('pur-qty-'  + rid)?.value) || 0;
        const cost = parseFloat(document.getElementById('pur-cost-' + rid)?.value) || 0;
        total += qty * cost;
    });
    const paid = parseFloat(document.getElementById('pur-paid')?.value) || 0;
    const remaining = Math.max(0, total - paid);
    const currency = document.getElementById('set-currency')?.value || 'شيكل';
    const totEl = document.getElementById('pur-total-display');
    const remEl = document.getElementById('pur-remaining-display');
    if (totEl) totEl.textContent = total.toLocaleString() + ' ' + currency;
    if (remEl) remEl.textContent = remaining.toLocaleString() + ' ' + currency;
}

window.submitPurchase = async function() {
    const supSel = document.getElementById('pur-supplier');
    const supplier_id = supSel?.value;
    if (!supplier_id) return alert('يرجى اختيار المورد اولاً');
    const supplier_name = supSel?.options[supSel.selectedIndex]?.text?.split(' - ')[0] || '';
    const items = [];
    let hasError = false;
    document.querySelectorAll('[id^="pur-row-"]').forEach(row => {
        const rid = row.id.replace('pur-row-', '');
        const product_id   = document.getElementById('pur-prod-' + rid)?.value || null;
        const product_name = document.getElementById('pur-name-' + rid)?.value?.trim();
        const quantity     = parseInt(document.getElementById('pur-qty-'  + rid)?.value) || 0;
        const unit_cost    = parseFloat(document.getElementById('pur-cost-' + rid)?.value) || 0;
        if (!product_name) { hasError = true; return; }
        items.push({ product_id, product_name, quantity, unit_cost });
    });
    if (hasError || !items.length) return alert('يرجى إدخال بيانات الاصناف (الاسم والكمية والسعر)');
    const paid  = parseFloat(document.getElementById('pur-paid')?.value) || 0;
    const notes = document.getElementById('pur-notes')?.value || '';
    try {
        const res  = await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier_id, supplier_name, items, paid, notes }) });
        const data = await res.json();
        if (data.success) {
            alert('تم حفظ فاتورة الشراء بنجاح!\nرقم الفاتورة: ' + data.invoice_number);
            document.getElementById('pur-supplier').value     = '';
            document.getElementById('pur-items-list').innerHTML = '';
            document.getElementById('pur-paid').value         = '';
            document.getElementById('pur-notes').value        = '';
            purRowId = 0;
            purUpdateSummary();
            loadPurchases();
            loadProducts();
        } else { alert('حدث خطأ: ' + data.message); }
    } catch(e) { alert('خطأ في الاتصال بالخادم'); }
}

window.purPayInvoice = async function(id, remaining) {
    const amt = prompt('المبلغ المتبقي: ' + remaining + '\nادخل مبلغ الدفعة:', remaining);
    if (!amt || isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) return;
    try {
        const res  = await fetch('/api/purchases/' + id + '/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: parseFloat(amt) }) });
        const data = await res.json();
        alert(data.message);
        if (data.success) loadPurchases();
    } catch(e) { alert('خطأ في الاتصال'); }
}

window.purPaySupplier = async function(supplierId) {
    const purs = allPurchases.filter(p => p.supplier_id == supplierId && parseFloat(p.remaining) > 0);
    if (!purs.length) return alert('لا يوجد دين لهذا المورد');
    const totalRem = purs.reduce((a, p) => a + parseFloat(p.remaining), 0);
    const amt = prompt('اجمالي الدين: ' + totalRem + '\nادخل مبلغ الدفعة:', totalRem);
    if (!amt || isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) return;
    let leftToApply = parseFloat(amt);
    for (const p of purs) {
        if (leftToApply <= 0) break;
        const pay = Math.min(leftToApply, parseFloat(p.remaining));
        await fetch('/api/purchases/' + p.id + '/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: pay }) });
        leftToApply -= pay;
    }
    alert('تم تسجيل الدفعة بنجاح');
    loadPurchases();
}

window.deletePurchase = async function(id) {
    if (!confirm('هل انت متأكد من حذف هذه الفاتورة؟')) return;
    const res  = await fetch('/api/purchases/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) loadPurchases();
}

window.printPurchasesReport = function() {
    if (!allPurchases.length) return alert('لا توجد فواتير للطباعة');
    const currency  = document.getElementById('set-currency')?.value || 'شيكل';
    const totalDebt = allPurchases.reduce((a, p) => a + parseFloat(p.remaining||0), 0);
    const totalAll  = allPurchases.reduce((a, p) => a + parseFloat(p.total||0), 0);
    let rows = allPurchases.map((p, i) => {
        const date   = new Date(p.purchase_date).toLocaleDateString('ar');
        const isDebt = parseFloat(p.remaining) > 0;
        return '<tr>'
            + '<td style="padding:9px;border-bottom:1px solid #eee;">' + (i+1) + '</td>'
            + '<td style="padding:9px;border-bottom:1px solid #eee;font-family:monospace;">' + p.invoice_number + '</td>'
            + '<td style="padding:9px;border-bottom:1px solid #eee;font-weight:bold;">' + p.supplier_name + '</td>'
            + '<td style="padding:9px;border-bottom:1px solid #eee;text-align:center;">' + parseFloat(p.total).toLocaleString() + ' ' + currency + '</td>'
            + '<td style="padding:9px;border-bottom:1px solid #eee;text-align:center;color:#16a34a;">' + parseFloat(p.paid).toLocaleString() + ' ' + currency + '</td>'
            + '<td style="padding:9px;border-bottom:1px solid #eee;text-align:center;color:' + (isDebt ? '#dc2626' : '#16a34a') + ';font-weight:bold;">' + (isDebt ? parseFloat(p.remaining).toLocaleString() + ' ' + currency : 'مسدد') + '</td>'
            + '<td style="padding:9px;border-bottom:1px solid #eee;color:#666;">' + date + '</td></tr>';
    }).join('');
    
    const printArea = document.getElementById('print-area');
    printArea.innerHTML = '<div style="font-family:Arial,sans-serif;direction:rtl;padding:30px;background:white;color:#111;max-width:980px;margin:0 auto;">'
        + buildPrintHeader({ 
            title: 'تقرير المشتريات وديون الموردين', 
            subtitle: '<span style="color:#dc2626;font-weight:bold;">إجمالي الديون: ' + totalDebt.toLocaleString() + ' ' + currency + '</span>'
        })
        + '<table style="width:100%;border-collapse:collapse;margin-top:10px;"><thead><tr style="background:#6366f1;color:white;">'
        + '<th style="padding:12px;text-align:right;">#</th><th style="padding:12px;text-align:right;">رقم الفاتورة</th><th style="padding:12px;text-align:right;">المورد</th>'
        + '<th style="padding:12px;text-align:center;">الاجمالي</th><th style="padding:12px;text-align:center;">المدفوع</th>'
        + '<th style="padding:12px;text-align:center;">المتبقي</th><th style="padding:12px;text-align:right;">التاريخ</th></tr></thead>'
        + '<tbody>' + rows + '</tbody>'
        + '<tfoot><tr style="background:#f8fafc;font-weight:bold;">'
        + '<td colspan="3" style="padding:14px;border-top:2px solid #6366f1;">الاجمالي الكلي</td>'
        + '<td style="padding:14px;border-top:2px solid #6366f1;text-align:center;">' + totalAll.toLocaleString() + ' ' + currency + '</td>'
        + '<td style="padding:14px;border-top:2px solid #6366f1;text-align:center;color:#16a34a;">' + (totalAll-totalDebt).toLocaleString() + ' ' + currency + '</td>'
        + '<td style="padding:14px;border-top:2px solid #6366f1;text-align:center;color:#dc2626;font-size:1.1rem;">' + totalDebt.toLocaleString() + ' ' + currency + '</td>'
        + '<td style="border-top:2px solid #6366f1;"></td></tr></tfoot></table>'
        + buildPrintFooter()
        + '</div>';
    setTimeout(() => window.print(), 200);
}
// ================== END PURCHASES MODULE JS ==================


// ================== SHARED PRINT HEADER HELPER ==================
function buildPrintHeader(opts) {
    opts = opts || {};
    const title    = opts.title    || '';
    const subtitle = opts.subtitle || '';
    const from     = opts.from     || '';
    const to       = opts.to       || '';

    const sn     = (typeof globalShopName    !== 'undefined') ? globalShopName    : 'gonet phone';
    const sPhone = (typeof globalShopPhone   !== 'undefined') ? globalShopPhone   : '';
    const sAddr  = (typeof globalShopAddress !== 'undefined') ? globalShopAddress : '';
    const logo   = (typeof globalShopLogo    !== 'undefined') ? globalShopLogo    : null;

    const logoHtml = logo
        ? '<img src="' + logo + '" style="max-height:70px;max-width:130px;object-fit:contain;border-radius:8px;">'
        : '<div style="width:58px;height:58px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;font-size:1.8rem;">&#128241;</div>';

    let contactHtml = '';
    if (sPhone) contactHtml += '<div style="margin-top:3px;color:#475569;font-size:0.85rem;">&#128222;&nbsp;' + sPhone + '</div>';
    if (sAddr)  contactHtml += '<div style="margin-top:2px;color:#475569;font-size:0.85rem;">&#128205;&nbsp;' + sAddr  + '</div>';

    let periodHtml = '';
    if (from && to) periodHtml = '<div>&#128197; الفترة: <strong>' + from + '</strong> إلى <strong>' + to + '</strong></div>';

    return '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #6366f1;padding-bottom:18px;margin-bottom:24px;">'
        + '<div style="display:flex;align-items:center;gap:16px;">'
        + logoHtml
        + '<div>'
        + '<div style="font-size:1.7rem;font-weight:900;color:#1e293b;line-height:1.1;">' + sn + '</div>'
        + '<div style="font-size:1rem;color:#6366f1;font-weight:700;margin-top:2px;">' + title + '</div>'
        + contactHtml
        + '</div>'
        + '</div>'
        + '<div style="text-align:left;color:#64748b;font-size:0.88rem;line-height:2;">'
        + periodHtml
        + (subtitle ? '<div>' + subtitle + '</div>' : '')
        + '<div>تاريخ الطباعة: <strong>' + new Date().toLocaleDateString('ar-SA') + '</strong></div>'
        + '<div style="margin-top:4px;padding:3px 10px;background:#f1f5f9;border-radius:20px;font-size:0.78rem;display:inline-block;color:#6366f1;font-weight:700;">' + sn + ' &mdash; FanniPro ERP</div>'
        + '</div>'
        + '</div>';
}

function buildPrintFooter() {
    const sn     = (typeof globalShopName    !== 'undefined') ? globalShopName    : 'gonet phone';
    const sPhone = (typeof globalShopPhone   !== 'undefined' && globalShopPhone)   ? ' | ' + globalShopPhone   : '';
    const sAddr  = (typeof globalShopAddress !== 'undefined' && globalShopAddress) ? ' | ' + globalShopAddress : '';
    return '<div style="margin-top:32px;padding-top:14px;border-top:1px dashed #cbd5e1;text-align:center;color:#94a3b8;font-size:0.8rem;line-height:2;">'
        + '<div style="font-weight:600;color:#475569;">' + sn + sPhone + sAddr + '</div>'
        + '<div>تم إنشاء هذا المستند بواسطة نظام FanniPro ERP</div>'
        + '</div>';
}
// ================== END SHARED PRINT HEADER HELPER ==================

// ================== DASHBOARD CHARTS & ALERTS LOGIC ==================
let salesProfitChartInstance = null;
let expensesBreakdownChartInstance = null;

function initializeDashboardCharts(stats) {
    const ctxSales = document.getElementById('salesProfitChart');
    if (ctxSales) {
        if (salesProfitChartInstance) salesProfitChartInstance.destroy();
        
        const labels = stats.salesTrend.map(t => t.date);
        const salesData = stats.salesTrend.map(t => t.sales);
        const profitData = stats.salesTrend.map(t => t.profit);
        
        salesProfitChartInstance = new Chart(ctxSales, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'إجمالي المبيعات (شيكل)',
                        data: salesData,
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'صافي الأرباح (شيكل)',
                        data: profitData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { font: { family: 'Tajawal' }, color: '#94a3b8' }
                    }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { font: { family: 'Tajawal' }, color: '#94a3b8' }
                    },
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { font: { family: 'Tajawal' }, color: '#94a3b8' }
                    }
                }
            }
        });
    }

    const ctxExp = document.getElementById('expensesBreakdownChart');
    if (ctxExp) {
        if (expensesBreakdownChartInstance) expensesBreakdownChartInstance.destroy();
        
        if (!stats.expensesBreakdown || stats.expensesBreakdown.length === 0) {
            ctxExp.style.display = 'none';
            let placeholder = document.getElementById('expenses-chart-placeholder');
            if (!placeholder) {
                placeholder = document.createElement('p');
                placeholder.id = 'expenses-chart-placeholder';
                placeholder.style.color = '#94a3b8';
                placeholder.style.textAlign = 'center';
                placeholder.style.padding = '30px 10px';
                placeholder.innerText = 'لا توجد مصروفات مسجلة لعرضها حالياً.';
                ctxExp.parentNode.appendChild(placeholder);
            } else {
                placeholder.style.display = 'block';
            }
        } else {
            ctxExp.style.display = 'block';
            const placeholder = document.getElementById('expenses-chart-placeholder');
            if (placeholder) placeholder.style.display = 'none';

            const labels = stats.expensesBreakdown.map(e => e.title || 'أخرى');
            const data = stats.expensesBreakdown.map(e => e.total);
            
            expensesBreakdownChartInstance = new Chart(ctxExp, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { font: { family: 'Tajawal' }, color: '#94a3b8' }
                        }
                    }
                }
            });
        }
    }
}

function populateDashboardAlerts(stats) {
    // Low Stock
    const lowStockContainer = document.getElementById('dashboard-low-stock-list');
    if (lowStockContainer) {
        lowStockContainer.innerHTML = '';
        if (!stats.lowStockItems || stats.lowStockItems.length === 0) {
            lowStockContainer.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 15px; font-size: 0.9rem;">لا توجد نواقص في المخزون حالياً.</p>`;
        } else {
            stats.lowStockItems.forEach(item => {
                lowStockContainer.innerHTML += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(239, 68, 68, 0.08); padding:10px 14px; border-radius:8px; border-right:4px solid var(--danger); margin-bottom: 8px;">
                        <span style="font-weight:600; color: #fff;">${item.name}</span>
                        <span style="color:var(--danger); font-size:0.85rem; font-weight:bold;">الكمية: ${item.quantity} (الحد: 5)</span>
                    </div>
                `;
            });
        }
    }

    // Checks
    const checksContainer = document.getElementById('dashboard-checks-list');
    if (checksContainer) {
        checksContainer.innerHTML = '';
        if (!stats.upcomingChecks || stats.upcomingChecks.length === 0) {
            checksContainer.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 15px; font-size: 0.9rem;">لا توجد شيكات مستحقة قريباً.</p>`;
        } else {
            stats.upcomingChecks.forEach(chk => {
                const isOut = chk.type === 'outgoing';
                const typeText = isOut ? 'صادر للمورد' : 'وارد من عميل';
                const color = isOut ? 'var(--danger)' : 'var(--success)';
                const bg = isOut ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)';
                checksContainer.innerHTML += `
                    <div style="display:flex; flex-direction:column; background:${bg}; padding:10px 14px; border-radius:8px; border-right:4px solid ${color}; margin-bottom: 8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:600; color:#fff;">شيك رقم: ${chk.check_number}</span>
                            <span style="color:${color}; font-weight:bold; font-size:1.1rem;">${chk.amount} شيكل</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:#94a3b8; margin-top:4px;">
                            <span>${typeText} (${chk.owner_name})</span>
                            <span>تاريخ الاستحقاق: ${chk.due_date}</span>
                        </div>
                    </div>
                `;
            });
        }
    }

    // Installments
    const installmentsContainer = document.getElementById('dashboard-installments-list');
    if (installmentsContainer) {
        installmentsContainer.innerHTML = '';
        if (!stats.upcomingInstallments || stats.upcomingInstallments.length === 0) {
            installmentsContainer.innerHTML = `<p style="color: #94a3b8; text-align: center; padding: 15px; font-size: 0.9rem;">لا توجد أقساط مستحقة قريباً.</p>`;
        } else {
            stats.upcomingInstallments.forEach(inst => {
                installmentsContainer.innerHTML += `
                    <div style="display:flex; flex-direction:column; background:rgba(59, 130, 246, 0.08); padding:10px 14px; border-radius:8px; border-right:4px solid var(--primary); margin-bottom: 8px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:600; color:#fff;">${inst.customer_name}</span>
                            <span style="color:var(--primary); font-weight:bold; font-size:1.1rem;">قسط: ${inst.installment_amount} شيكل</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:#94a3b8; margin-top:4px;">
                            <span>متبقي: ${inst.remaining} شيكل</span>
                            <span>تاريخ الاستحقاق: ${inst.due_date}</span>
                        </div>
                    </div>
                `;
            });
        }
    }
}

// ================== USER MANAGEMENT LOGIC ==================
window.loadUsers = async function() {
    try {
        const res = await fetch('/api/users');
        const data = await res.json();
        if (!data.success) return;
        const tbody = document.getElementById('users-list-tbody');
        tbody.innerHTML = '';
        const roleNames = {
            1: 'مدير النظام (Admin)',
            2: 'كاشير المبيعات (Cashier)',
            3: 'فني صيانة (Technician)',
            4: 'محاسب (Accountant)',
            5: 'أمين مخزن (Storekeeper)'
        };
        data.data.forEach(u => {
            const statusText = u.active ? '<span class="badge badge-success">نشط</span>' : '<span class="badge badge-danger">معطل</span>';
            const actionBtn = u.id === currentUser.id ? '' : `
                <button class="icon-btn text-primary" onclick="editUser(${u.id})" title="تعديل"><i class="fa-solid fa-user-pen"></i></button>
                <button class="icon-btn ${u.active ? 'text-warning' : 'text-success'}" onclick="toggleUserStatus(${u.id}, ${u.active})" title="${u.active ? 'تعطيل الحساب' : 'تنشيط الحساب'}"><i class="fa-solid ${u.active ? 'fa-user-slash' : 'fa-user-check'}"></i></button>
                <button class="icon-btn text-danger" onclick="deleteUser(${u.id})" title="حذف نهائي"><i class="fa-solid fa-user-xmark"></i></button>
            `;
            tbody.innerHTML += `
                <tr>
                    <td><strong>${u.username}</strong></td>
                    <td>${u.full_name}</td>
                    <td><span class="text-primary font-weight-bold">${roleNames[u.role_id] || 'مستخدم'}</span></td>
                    <td>${statusText}</td>
                    <td>${new Date(u.created_at).toLocaleDateString('ar-EG')}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        });
    } catch(e) { console.error('Error loading users:', e); }
};

window.openAddUserModal = function() {
    document.getElementById('form-user').reset();
    document.getElementById('user-id-field').value = '';
    document.getElementById('user-modal-title').textContent = 'إضافة مستخدم جديد';
    document.getElementById('user-username-field').readOnly = false;
    document.getElementById('user-username-field').style.background = 'transparent';
    document.getElementById('user-password-field').required = true;
    document.getElementById('user-pass-note').style.display = 'none';
    
    // Default to admin with all checked
    document.getElementById('user-role-field').value = "1";
    document.querySelectorAll('.user-perm-checkbox').forEach(cb => cb.checked = true);
    
    openModal('user-modal');
};

window.editUser = async function(id) {
    try {
        const res = await fetch('/api/users');
        const data = await res.json();
        const user = data.data.find(u => u.id === id);
        if (!user) return;
        
        document.getElementById('user-id-field').value = user.id;
        document.getElementById('user-username-field').value = user.username;
        document.getElementById('user-username-field').readOnly = true;
        document.getElementById('user-username-field').style.background = 'rgba(255,255,255,0.05)';
        document.getElementById('user-fullname-field').value = user.full_name;
        document.getElementById('user-role-field').value = user.role_id;
        document.getElementById('user-active-field').checked = !!user.active;
        document.getElementById('user-password-field').value = '';
        document.getElementById('user-password-field').required = false;
        document.getElementById('user-pass-note').style.display = 'block';
        document.getElementById('user-modal-title').textContent = 'تعديل بيانات المستخدم';
        
        // Populating checkbox state based on saved permissions JSON
        let perms = {};
        if (user.permissions) {
            try {
                perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
            } catch(e) { console.error('Failed to parse user permissions:', e); }
        }
        document.querySelectorAll('.user-perm-checkbox').forEach(cb => {
            cb.checked = !!(perms[cb.value] || perms.all);
        });
        
        openModal('user-modal');
    } catch(e) { console.error(e); }
};

window.submitUserForm = async function(e) {
    e.preventDefault();
    const id = document.getElementById('user-id-field').value;
    const username = document.getElementById('user-username-field').value;
    const full_name = document.getElementById('user-fullname-field').value;
    const password = document.getElementById('user-password-field').value;
    const role_id = parseInt(document.getElementById('user-role-field').value);
    const active = document.getElementById('user-active-field').checked ? 1 : 0;

    // Collect permissions from checked inputs
    const permissions = {};
    document.querySelectorAll('.user-perm-checkbox').forEach(cb => {
        if (cb.checked) {
            permissions[cb.value] = true;
        }
    });

    const payload = { username, full_name, role_id, active, permissions };
    if (password) payload.password = password;

    const url = id ? `/api/users/${id}` : '/api/users';
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeModal('user-modal');
            loadUsers();
            alert('تم حفظ بيانات المستخدم بنجاح');
        } else {
            alert('فشل حفظ المستخدم: ' + data.message);
        }
    } catch(err) { alert('خطأ في الاتصال بالخادم'); }
};

window.toggleUserStatus = async function(id, currentActive) {
    if(!confirm('هل أنت متأكد من تغيير حالة نشاط هذا الحساب؟')) return;
    try {
        const res = await fetch(`/api/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: currentActive ? 0 : 1 })
        });
        const data = await res.json();
        if(data.success) {
            loadUsers();
        } else {
            alert(data.message);
        }
    } catch(e) { alert('خطأ في الاتصال'); }
};

window.deleteUser = async function(id) {
    if(!confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً من النظام؟ لا يمكن التراجع عن هذا الإجراء!')) return;
    try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            loadUsers();
            alert('تم حذف المستخدم بنجاح');
        } else {
            alert('فشل الحذف: ' + data.message);
        }
    } catch(e) { alert('خطأ في الاتصال'); }
};

// ================== SUPPLIER DEBTS LOGIC ==================
let selectedSupplierDebtId = null;
let selectedSupplierDebtName = '';

window.loadSupplierDebts = async function() {
    try {
        const res = await fetch('/api/purchases/supplier-debts');
        const data = await res.json();
        if (!data.success) return;
        
        let totalDebts = 0;
        const tbody = document.getElementById('supplier-debts-tbody');
        tbody.innerHTML = '';
        
        data.data.forEach(s => {
            totalDebts += s.total_debt;
            tbody.innerHTML += `
                <tr style="cursor:pointer;" onclick="selectSupplierForDebts(${s.id}, '${s.name}')" class="${selectedSupplierDebtId === s.id ? 'active-row' : ''}">
                    <td><strong>${s.name}</strong><br><small style="color:#888;">${s.phone||'-'}</small></td>
                    <td class="text-danger font-weight-bold">${s.total_debt.toFixed(2)} شيكل</td>
                    <td>
                        <button class="btn-primary btn-xs" onclick="event.stopPropagation(); selectSupplierForDebts(${s.id}, '${s.name}')"><i class="fa-solid fa-eye"></i> عرض</button>
                    </td>
                </tr>
            `;
        });
        
        document.getElementById('supplier-debts-total-sum').textContent = totalDebts.toFixed(2) + ' شيكل';
        
        if (selectedSupplierDebtId) {
            selectSupplierForDebts(selectedSupplierDebtId, selectedSupplierDebtName);
        }
    } catch(e) { console.error('Error loading supplier debts:', e); }
};

window.selectSupplierForDebts = function(supplierId, name) {
    selectedSupplierDebtId = supplierId;
    selectedSupplierDebtName = name;
    
    const rows = document.querySelectorAll('#supplier-debts-tbody tr');
    rows.forEach(r => r.classList.remove('active-row'));
    
    document.getElementById('supplier-debts-title').innerHTML = `📄 فواتير المورد: <span class="text-primary">${name}</span>`;
    document.getElementById('btn-pay-supplier-general').style.display = 'block';
    
    loadSupplierInvoices(supplierId);
};

window.loadSupplierInvoices = async function(supplierId) {
    try {
        const res = await fetch('/api/purchases');
        const data = await res.json();
        if (!data.success) return;
        
        const container = document.getElementById('supplier-invoices-container');
        container.innerHTML = '';
        
        const invoices = data.data.filter(p => p.supplier_id === supplierId && p.remaining > 0);
        
        if (invoices.length === 0) {
            container.innerHTML = `<p style="color:var(--success); text-align:center; padding:30px; font-weight:bold;"><i class="fa-solid fa-circle-check"></i> لا توجد فواتير مستحقة الدفع لهذا المورد. رصيد الدين: 0 شيكل.</p>`;
            return;
        }
        
        let tableHtml = `
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>رقم الفاتورة</th>
                        <th>التاريخ</th>
                        <th>المجموع</th>
                        <th>المدفوع</th>
                        <th>المتبقي</th>
                        <th>الإجراء</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        invoices.forEach(inv => {
            tableHtml += `
                <tr>
                    <td><strong>${inv.invoice_number}</strong></td>
                    <td>${new Date(inv.date).toLocaleDateString('ar-EG')}</td>
                    <td>${inv.total}</td>
                    <td>${inv.paid}</td>
                    <td class="text-danger font-weight-bold">${inv.remaining} شيكل</td>
                    <td>
                        <button class="btn-success btn-xs" onclick="openInvoicePayModal(${inv.id}, '${inv.invoice_number}', ${inv.remaining}, '${selectedSupplierDebtName}', ${supplierId})"><i class="fa-solid fa-money-bill-wave"></i> دفع</button>
                    </td>
                </tr>
            `;
        });
        
        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    } catch(e) { console.error(e); }
};

window.openInvoicePayModal = function(purchaseId, invoiceNumber, remaining, supplierName, supplierId) {
    document.getElementById('supplier-pay-id-field').value = purchaseId;
    document.getElementById('supplier-pay-invoice-field').value = invoiceNumber;
    document.getElementById('supplier-pay-name-field').value = supplierName;
    document.getElementById('supplier-pay-invoice-display').value = invoiceNumber;
    document.getElementById('supplier-pay-invoice-group').style.display = 'block';
    document.getElementById('supplier-pay-remaining-display').value = remaining.toFixed(2) + ' شيكل';
    document.getElementById('supplier-pay-amount-field').value = remaining;
    document.getElementById('supplier-pay-amount-field').max = remaining;
    document.getElementById('supplier-pay-limit-label').textContent = 'المبلغ المتبقي بالفاتورة';
    document.getElementById('supplier-pay-modal-title').textContent = 'تسديد فاتورة شراء محددة';
    openModal('supplier-pay-modal');
};

window.openSupplierGeneralPayModal = async function() {
    try {
        const res = await fetch('/api/purchases/supplier-debts');
        const data = await res.json();
        const sup = data.data.find(s => s.id === selectedSupplierDebtId);
        if (!sup) return;
        
        document.getElementById('supplier-pay-id-field').value = '';
        document.getElementById('supplier-pay-invoice-field').value = '';
        document.getElementById('supplier-pay-name-field').value = selectedSupplierDebtName;
        document.getElementById('supplier-pay-invoice-group').style.display = 'none';
        document.getElementById('supplier-pay-remaining-display').value = sup.total_debt.toFixed(2) + ' شيكل';
        document.getElementById('supplier-pay-amount-field').value = sup.total_debt;
        document.getElementById('supplier-pay-amount-field').removeAttribute('max');
        document.getElementById('supplier-pay-limit-label').textContent = 'إجمالي الديون القائمة';
        document.getElementById('supplier-pay-modal-title').textContent = 'تسديد دفعة عامة للمورد';
        openModal('supplier-pay-modal');
    } catch(e) { console.error(e); }
};

window.submitSupplierPayment = async function(e) {
    e.preventDefault();
    const purchaseId = document.getElementById('supplier-pay-id-field').value;
    const amount = parseFloat(document.getElementById('supplier-pay-amount-field').value);
    
    if (!amount || amount <= 0) return alert('الرجاء إدخال مبلغ صحيح');
    
    try {
        if (purchaseId) {
            const res = await fetch(`/api/purchases/${purchaseId}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: amount })
            });
            const data = await res.json();
            if (data.success) {
                closeModal('supplier-pay-modal');
                loadSupplierDebts();
                alert('تم تسجيل دفعة السداد بنجاح');
            } else {
                alert(data.message);
            }
        } else {
            const resPur = await fetch('/api/purchases');
            const dataPur = await resPur.json();
            if (!dataPur.success) return;
            
            const invoices = dataPur.data
                .filter(p => p.supplier_id === selectedSupplierDebtId && p.remaining > 0)
                .sort((a, b) => new Date(a.date) - new Date(b.date));
                
            let remainingPay = amount;
            for (let i = 0; i < invoices.length && remainingPay > 0; i++) {
                const inv = invoices[i];
                const payForThis = Math.min(remainingPay, inv.remaining);
                
                await fetch(`/api/purchases/${inv.id}/pay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: payForThis })
                });
                
                remainingPay -= payForThis;
            }
            
            closeModal('supplier-pay-modal');
            loadSupplierDebts();
            alert('تم توزيع الدفعة وسداد الفواتير الأقدم بنجاح');
        }
    } catch(err) {
        alert('حدث خطأ أثناء الاتصال بالخادم');
    }
};

// ================== AUDIT LOG HISTORY LOGIC ==================
let allAuditLogs = [];

window.loadAuditLogs = async function() {
    try {
        const res = await fetch('/api/audit-logs');
        const data = await res.json();
        if (!data.success) return;
        
        allAuditLogs = data.data;
        renderLogsTable(allAuditLogs);
    } catch(e) { console.error('Error loading logs:', e); }
};

function renderLogsTable(logs) {
    const tbody = document.getElementById('logs-list-tbody');
    tbody.innerHTML = '';
    
    logs.forEach(l => {
        tbody.innerHTML += `
            <tr>
                <td><small class="text-muted">#${l.id}</small></td>
                <td><strong>${l.username}</strong> <span style="font-size:0.75rem; color:#888;">(ID: ${l.user_id})</span></td>
                <td><span class="badge" style="background:rgba(56, 189, 248, 0.15); color:#38bdf8; font-weight:bold;">${l.action}</span></td>
                <td style="max-width:400px; white-space:normal; line-height:1.4;">${l.details}</td>
                <td><small>${new Date(l.created_at).toLocaleString('ar-EG')}</small></td>
            </tr>
        `;
    });
}

window.filterLogsTable = function(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        renderLogsTable(allAuditLogs);
        return;
    }
    const filtered = allAuditLogs.filter(l => 
        l.username.toLowerCase().includes(q) || 
        l.action.toLowerCase().includes(q) || 
        l.details.toLowerCase().includes(q)
    );
    renderLogsTable(filtered);
};

// ================== WHATSAPP INTEGRATION & HELPER LOGIC ==================
function formatPhoneNumber(phone) {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, ''); 
    if (clean.startsWith('00')) clean = clean.substring(2);
    if (clean.startsWith('05')) {
        clean = '972' + clean.substring(1);
    } else if (clean.startsWith('5') && clean.length === 9) {
        clean = '972' + clean;
    }
    return clean;
}

window.sendRepairWhatsApp = function(id) {
    const r = allRepairs.find(rep => rep.id === id);
    if (!r) return;
    
    let msg = '';
    if (r.status === 'working') {
        msg = `مرحباً ${r.customer_name}،\nنعلمك بأننا نعمل حالياً على صيانة جهازك (${r.device_brand}). سنقوم بإعلامك فور جاهزيته.\nمع تحيات: ${globalShopName}`;
    } else if (r.status === 'ready') {
        msg = `مرحباً ${r.customer_name}،\nيسعدنا إعلامك بأن جهازك (${r.device_brand}) قد تمت صيانته بنجاح وهو جاهز للاستلام الآن.\nالتكلفة الإجمالية: ${r.cost || 0} شيكل.\nمع تحيات: ${globalShopName}`;
    } else {
        msg = `مرحباً ${r.customer_name}،\nتم استلام جهازك (${r.device_brand}) في مركز الصيانة وهو قيد الفحص والتشخيص حالياً.\nرقم التذكرة: ${r.ticket_number}\nمع تحيات: ${globalShopName}`;
    }
    
    const formattedPhone = formatPhoneNumber(r.phone);
    if (!formattedPhone) return alert('رقم هاتف العميل غير صحيح أو فارغ!');
    
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
};

window.sendInvoiceWhatsApp = async function(id) {
    try {
        const res = await fetch(`/api/sales/${id}/items`);
        const data = await res.json();
        if(!data.success) return alert('فشل تحميل تفاصيل الفاتورة');
        
        const sale = allSalesHistory.find(s => s.id === id);
        if(!sale) return alert('لم يتم العثور على الفاتورة في السجل');
        
        let customerPhone = '';
        if (sale.customer_id) {
            const customer = allCustomers.find(c => c.id === sale.customer_id);
            if (customer && customer.phone) {
                customerPhone = customer.phone;
            }
        }
        
        const phoneInput = prompt("الرجاء تأكيد رقم هاتف العميل لإرسال الفاتورة عبر واتساب (مثال: 0599123456):", customerPhone);
        if (!phoneInput) return;
        
        const formattedPhone = formatPhoneNumber(phoneInput);
        if (!formattedPhone) return alert('رقم الهاتف غير صحيح!');
        
        const items = data.data;
        let itemsText = '';
        items.forEach(item => {
            itemsText += `- ${item.product_name || 'منتج مخصص'} (${item.quantity} × ${item.unit_price} شيكل) = ${item.quantity * item.unit_price} شيكل\n`;
        });
        
        const message = `مرحباً بك من ${globalShopName}،\nيسعدنا تعاملك معنا. إليك تفاصيل فاتورتك رقم #${sale.invoice_number}:\n\n`
            + `التاريخ: ${new Date(sale.sale_date || sale.created_at).toLocaleDateString('ar-EG')}\n`
            + `-----------------------------------\n`
            + itemsText
            + `-----------------------------------\n`
            + `إجمالي الفاتورة: ${sale.total} شيكل\n\n`
            + `شكراً لزيارتكم!\n`
            + (globalShopPhone ? `📞 هاتف المحل: ${globalShopPhone}\n` : '')
            + (globalShopAddress ? `📍 عنوان المحل: ${globalShopAddress}\n` : '');
            
        const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    } catch(e) { alert('خطأ في إرسال الفاتورة عبر واتساب'); }
};

window.reprintInvoice = async function(id) {
    try {
        const res = await fetch(`/api/sales/${id}/items`);
        const data = await res.json();
        if(!data.success) return alert('فشل تحميل تفاصيل الفاتورة');
        
        const sale = allSalesHistory.find(s => s.id === id);
        if(!sale) return alert('لم يتم العثور على الفاتورة في السجل');
        
        const items = data.data;
        const printArea = document.getElementById('print-area');
        
        let itemsHtml = '';
        items.forEach(item => {
            const itemTotal = item.quantity * item.unit_price;
            itemsHtml += `<tr><td>${item.product_name || 'منتج مخصص'}</td><td>${item.quantity}</td><td>${itemTotal}</td></tr>`;
        });
        
        let logoHtml = '';
        if (globalShopLogo) {
            logoHtml = `<div style="text-align:center; margin-bottom:10px;"><img src="${globalShopLogo}" style="max-height: 50px; object-fit: contain;"></div>`;
        }
        
        let contactHtml = '';
        if (globalShopPhone) contactHtml += `<p style="margin: 2px 0; font-size: 11px;">📞 هاتف: ${globalShopPhone}</p>`;
        if (globalShopAddress) contactHtml += `<p style="margin: 2px 0; font-size: 11px;">📍 العنوان: ${globalShopAddress}</p>`;
        
        printArea.innerHTML = `
            <div class="thermal-receipt">
                ${logoHtml}
                <h2>${globalShopName}</h2>
                ${contactHtml}
                <div class="divider"></div>
                <p>رقم الفاتورة: #${sale.invoice_number}</p>
                <p>التاريخ: ${new Date(sale.sale_date || sale.created_at).toLocaleString()}</p>
                <div class="divider"></div>
                <table>
                    <thead><tr><th>الصنف</th><th>الكمية</th><th>المجموع</th></tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div class="divider"></div>
                <div class="total-row">الإجمالي الصافي: ${sale.total} شيكل</div>
                <div class="divider"></div>
                <p>شكراً لزيارتكم!</p>
            </div>
        `;
        
        setTimeout(() => { window.print(); }, 200);
    } catch(e) { alert('خطأ في طباعة الفاتورة'); }
};

// Global capturing input handler to automatically map Arabic Indic numbers to Western 0-9 digits and sanitize typing
document.addEventListener('input', function(e) {
    const target = e.target;
    if (target.tagName === 'INPUT' && (target.getAttribute('inputmode') === 'numeric' || target.getAttribute('inputmode') === 'decimal')) {
        let val = target.value;
        const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        val = val.replace(/[٠-٩]/g, d => {
            const idx = arabicDigits.indexOf(d);
            return idx !== -1 ? idx : d;
        });
        
        if (target.getAttribute('inputmode') === 'numeric') {
            val = val.replace(/[^0-9]/g, '');
        } else {
            val = val.replace(/[^0-9.]/g, '');
            const parts = val.split('.');
            if (parts.length > 2) {
                val = parts[0] + '.' + parts.slice(1).join('');
            }
        }
        
        if (target.value !== val) {
            target.value = val;
        }
    }
}, true);

// Theme Switcher Functions
window.toggleThemeMenu = function() {
    const dropdown = document.getElementById('theme-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
};

window.changeAppTheme = function(themeName) {
    // Remove existing themes
    document.body.classList.remove('theme-indigo', 'theme-midnight', 'theme-emerald', 'theme-amber', 'theme-rose');
    
    // Add new theme class
    document.body.classList.add(`theme-${themeName}`);
    
    // Save to localStorage
    localStorage.setItem('app-theme', themeName);
    
    // Close dropdown
    const dropdown = document.getElementById('theme-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
};

// Initialize Theme on load
const initAppTheme = () => {
    const savedTheme = localStorage.getItem('app-theme') || 'indigo';
    window.changeAppTheme(savedTheme);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppTheme);
} else {
    initAppTheme();
}

// Close Theme Selector on Click Outside
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('theme-dropdown');
    const menuBtn = document.querySelector('[onclick="toggleThemeMenu()"]');
    if (dropdown && dropdown.style.display === 'block') {
        if (!dropdown.contains(event.target) && (!menuBtn || !menuBtn.contains(event.target))) {
            dropdown.style.display = 'none';
        }
    }
});
