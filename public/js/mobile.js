// Mobile Dashboard Logic - gonet phone
let activeServerUrl = "";
let currentToken = "";

function constructServerUrl(input) {
    let targetUrl = input.trim();
    if (!targetUrl) return "";
    
    // Check if it already has http/https
    if (!/^https?:\/\//i.test(targetUrl)) {
        // If it looks like an internet domain name (like onrender.com) and doesn't contain a colon, use https
        if (targetUrl.includes('.') && !/^[0-9.]+$/.test(targetUrl) && !targetUrl.includes(':')) {
            targetUrl = `https://${targetUrl}`;
        } else {
            targetUrl = `http://${targetUrl}`;
        }
    }
    
    // Check if we need to append port :3000
    // We only append port 3000 if there's no port already specified AND it looks like a local address
    const hasPort = targetUrl.split('//')[1].includes(':');
    if (!hasPort) {
        const host = targetUrl.split('//')[1].toLowerCase();
        const isLocal = host.includes('localhost') || 
                        host.includes('127.0.0.1') || 
                        host.startsWith('192.168.') || 
                        host.startsWith('10.') || 
                        host.startsWith('172.16.') || 
                        host.startsWith('172.31.') ||
                        /^[0-9.]+$/.test(host); // numeric IP
        if (isLocal) {
            targetUrl = `${targetUrl}:3000`;
        }
    }
    return targetUrl;
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load saved server connection
    const savedIp = localStorage.getItem('gonet_phone_server_ip');
    if (savedIp) {
        document.getElementById('server-ip').value = savedIp;
        activeServerUrl = constructServerUrl(savedIp);
        // Try to load cached token
        const savedToken = localStorage.getItem('gonet_phone_token');
        if (savedToken) {
            showScreen('dashboard');
            loadMobileDashboard();
        } else {
            showScreen('login');
        }
    } else {
        showScreen('connection');
    }
    
    // Set a random simulated Hardware ID for mobile demonstration
    let mHWID = localStorage.getItem('mobile_hwid');
    if(!mHWID) {
        mHWID = 'MOB-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        localStorage.setItem('mobile_hwid', mHWID);
    }
    document.getElementById('mobile-hwid-display').textContent = mHWID;
});

function showScreen(screenId) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));
    
    // Show requested screen
    const target = document.getElementById(`screen-${screenId}`);
    if (target) target.classList.add('active');
    
    // Manage Bottom Navigation bar visibility
    const tabBar = document.getElementById('app-tab-bar');
    if (screenId === 'connection' || screenId === 'login') {
        tabBar.style.display = 'none';
    } else {
        tabBar.style.display = 'flex';
    }
}

// Switch tabs inside main application
window.switchMobileScreen = function(screenId) {
    // Manage tab active status
    const tabItems = document.querySelectorAll('.tab-item');
    tabItems.forEach(t => t.classList.remove('active'));
    
    // Find matching tab and activate it
    const index = screenId === 'dashboard' ? 0 : screenId === 'scanner' ? 1 : 2;
    if(tabItems[index]) tabItems[index].classList.add('active');
    
    showScreen(screenId);
    
    if (screenId === 'dashboard') {
        loadMobileDashboard();
    } else if (screenId === 'scanner') {
        startMobileCamera();
    } else if (screenId === 'settings') {
        document.getElementById('current-server-display').textContent = activeServerUrl;
    }
}

// 1. Connection Manager
window.testAndSaveConnection = async function() {
    const ip = document.getElementById('server-ip').value.trim();
    const errorDiv = document.getElementById('conn-error');
    
    if (!ip) {
        errorDiv.textContent = "الرجاء إدخال عنوان IP أو رابط السيرفر صحيح";
        return;
    }
    
    errorDiv.textContent = "جاري التحقق من الاتصال بالسيرفر... (إذا كنت تتصل بالخادم السحابي لأول مرة، فقد يستغرق تشغيله دقيقة كاملة للاستيقاظ من وضع الخمول، يرجى الانتظار...)";
    errorDiv.style.color = "var(--warning)";
    
    try {
        const targetUrl = constructServerUrl(ip);
        
        // Ping the Express API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout for Render cold start
        
        const res = await fetch(`${targetUrl}/api/license/status`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
            localStorage.setItem('gonet_phone_server_ip', ip);
            activeServerUrl = targetUrl;
            showScreen('login');
            errorDiv.textContent = "";
        } else {
            errorDiv.textContent = "السيرفر لا يستجيب بالشكل الصحيح. تأكد من أن السيرفر يعمل.";
            errorDiv.style.color = "var(--danger)";
        }
    } catch(e) {
        if (e.name === 'AbortError') {
            errorDiv.textContent = "انتهت مهلة الاتصال (90 ثانية). يبدو أن السيرفر غير نشط حالياً أو لم يتمكن من العمل بالوقت المحدد.";
        } else {
            errorDiv.textContent = "فشل الاتصال. تأكد من أن السيرفر يعمل، وأن العنوان مكتوب بشكل صحيح، وأن هاتفك متصل بالإنترنت.";
        }
        errorDiv.style.color = "var(--danger)";
    }
}

window.goBackToConnection = function(e) {
    if(e) e.preventDefault();
    showScreen('connection');
}

// 2. Mobile User Login
window.submitMobileLogin = async function() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorDiv = document.getElementById('login-error');
    
    if (!username || !password) {
        errorDiv.textContent = "يرجى ملء جميع الحقول";
        return;
    }
    
    errorDiv.textContent = "جاري الدخول...";
    errorDiv.style.color = "var(--warning)";
    
    try {
        const res = await fetch(`${activeServerUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (data.success) {
            // Save mock token to identify logged-in user
            localStorage.setItem('gonet_phone_token', 'LOGGED_IN');
            
            if (data.redirect) {
                // If it is the developer logging in, redirect them directly to developer panel
                window.location.href = `${activeServerUrl}${data.redirect}`;
                return;
            }
            
            showScreen('dashboard');
            loadMobileDashboard();
        } else {
            errorDiv.textContent = data.message || "فشل تسجيل الدخول";
            errorDiv.style.color = "var(--danger)";
        }
    } catch(e) {
        errorDiv.textContent = "خطأ اتصال بالسيرفر.";
        errorDiv.style.color = "var(--danger)";
    }
}

// 3. Load Dashboard Data
async function loadMobileDashboard() {
    try {
        // Fetch Settings for Shop Title
        const settingsRes = await fetch(`${activeServerUrl}/api/settings`);
        const settingsData = await settingsRes.json();
        if(settingsData.success && settingsData.data) {
            document.getElementById('mobile-shop-title').textContent = settingsData.data.shop_name || "gonet phone";
        }
        
        // Fetch Dashboard Stats
        const statsRes = await fetch(`${activeServerUrl}/api/dashboard/stats`);
        const statsData = await statsRes.json();
        if(statsData.success && statsData.data) {
            document.getElementById('m-stat-sales').textContent = statsData.data.sales_today + " شيكل";
            document.getElementById('m-stat-repairs').textContent = statsData.data.active_repairs;
            document.getElementById('m-stat-lowstock').textContent = statsData.data.low_stock;
            document.getElementById('m-stat-customers').textContent = statsData.data.customers_today;
        }
        
        // Fetch Recent Repairs
        const repairsRes = await fetch(`${activeServerUrl}/api/repairs`);
        const repairsData = await repairsRes.json();
        const listDiv = document.getElementById('mobile-repairs-list');
        listDiv.innerHTML = '';
        
        if (repairsData.success && repairsData.data) {
            const activeRepairs = repairsData.data.filter(r => r.status !== 'delivered').slice(0, 5);
            if (activeRepairs.length === 0) {
                listDiv.innerHTML = '<div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.85rem;">لا توجد هواتف مستلمة للصيانة حالياً</div>';
            } else {
                activeRepairs.forEach(r => {
                    let statusClass = "badge-pending";
                    let statusLabel = "معلق";
                    if(r.status === 'inprogress') {
                        statusClass = "badge-working";
                        statusLabel = "جاري الإصلاح";
                    } else if(r.status === 'ready') {
                        statusClass = "badge-ready";
                        statusLabel = "جاهز";
                    }
                    
                    listDiv.innerHTML += `
                        <div class="repair-item">
                            <div class="repair-info">
                                <h4>${r.customer_name} - ${r.device_model}</h4>
                                <p><i class="fa-solid fa-screwdriver-wrench"></i> العطل: ${r.fault_description} | التكلفة: ${r.cost} شيكل</p>
                            </div>
                            <span class="badge ${statusClass}">${statusLabel}</span>
                        </div>
                    `;
                });
            }
        }
    } catch(e) {
        console.error("Error loading dashboard data", e);
    }
}

// 4. Barcode Camera Scanner (Uses Native WebRTC camera access wrapper)
let webStream = null;
async function startMobileCamera() {
    const video = document.getElementById('webcam-video');
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            webStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            video.srcObject = webStream;
            video.setAttribute("playsinline", true);
            video.play();
        } else {
            console.log("Camera API not supported in this client.");
        }
    } catch(e) {
        console.log("Error starting camera", e);
    }
}

function stopMobileCamera() {
    if(webStream) {
        webStream.getTracks().forEach(track => track.stop());
        webStream = null;
    }
}

// Simulate scanning when running inside simulator/no barcode printed
window.simulateBarcodeScan = async function() {
    const testBarcodes = ['123456', '888888', '777777'];
    const randomBarcode = testBarcodes[Math.floor(Math.random() * testBarcodes.length)];
    lookupBarcode(randomBarcode);
}

// Query the server to lookup products by barcode
async function lookupBarcode(barcode) {
    try {
        const res = await fetch(`${activeServerUrl}/api/products`);
        const data = await res.json();
        
        if (data.success && data.data) {
            // Find product matching the scanned barcode
            const product = data.data.find(p => p.barcode === barcode);
            const card = document.getElementById('scan-result-card');
            
            if (product) {
                document.getElementById('scan-prod-name').textContent = product.name;
                document.getElementById('scan-prod-name').style.color = "var(--success)";
                document.getElementById('scan-prod-barcode').textContent = product.barcode || '-';
                document.getElementById('scan-prod-qty').textContent = `${product.quantity} قطعة`;
                document.getElementById('scan-prod-price').textContent = `${product.sell_price} شيكل`;
                document.getElementById('scan-prod-rack').textContent = product.rack_location || '-';
                card.style.display = 'block';
            } else {
                document.getElementById('scan-prod-name').textContent = "المنتج غير مسجل بنظامك!";
                document.getElementById('scan-prod-name').style.color = "var(--danger)";
                document.getElementById('scan-prod-barcode').textContent = barcode;
                document.getElementById('scan-prod-qty').textContent = "0";
                document.getElementById('scan-prod-price').textContent = "غير متوفر";
                document.getElementById('scan-prod-rack').textContent = "-";
                card.style.display = 'block';
            }
        }
    } catch(e) {
        alert("خطأ أثناء البحث عن الباركود");
    }
}

// 5. Settings Configuration
window.clearSavedServer = function() {
    if (confirm("هل تريد فك ارتباط التطبيق بسيرفر المحل؟ سيتوجب عليك إعادة إدخال الـ IP.")) {
        stopMobileCamera();
        localStorage.removeItem('gonet_phone_server_ip');
        localStorage.removeItem('gonet_phone_token');
        showScreen('connection');
    }
}

window.logoutMobile = function() {
    if (confirm("هل تريد تسجيل الخروج؟")) {
        stopMobileCamera();
        localStorage.removeItem('gonet_phone_token');
        showScreen('login');
    }
}

// Stop webcam streams when leaving screen
window.addEventListener('beforeunload', stopMobileCamera);
