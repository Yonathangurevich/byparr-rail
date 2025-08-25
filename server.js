const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

let browserPool = [];
const MAX_BROWSERS = 1;
const MAX_REQUESTS_PER_BROWSER = 30; // קטן יותר - מחליפים browsers יותר תכופ

// ✅ ULTIMATE Browser arguments - מבוסס על מחקר FlareSolver + Byparr
const ULTIMATE_BROWSER_ARGS = [
    // Basic security
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    
    // ✅ CRITICAL: Anti-detection מבוסס על undetected-chromedriver
    '--disable-blink-features=AutomationControlled',
    '--disable-features=VizDisplayCompositor',
    '--disable-features=IsolateOrigins,site-per-process',
    '--exclude-switches=enable-automation',
    '--disable-extensions-file-access-check',
    '--disable-plugins-discovery',
    '--disable-plugins',
    '--disable-default-apps',
    
    // ✅ Browser behavior normalization
    '--window-size=1920,1080',
    '--start-maximized',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-default-browser-check',
    
    // ✅ Memory & Performance (from SeleniumBase research)
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-hang-monitor',
    '--memory-pressure-off',
    '--max_old_space_size=1024',
    
    // ✅ Network & Security bypass
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-ipc-flooding-protection',
    '--disable-client-side-phishing-detection',
    '--disable-sync',
    '--mute-audio',
    '--no-pings',
    '--disable-breakpad',
    
    // ✅ ULTIMATE stealth mode
    '--disable-component-extensions-with-background-pages',
    '--disable-background-networking',
    '--disable-prompt-on-repost',
    '--hide-scrollbars',
    '--use-mock-keychain',
    '--disable-bundled-ppapi-flash',
    
    // ✅ User interaction simulation
    '--enable-features=NetworkServiceLogging',
    '--disable-logging',
    '--log-level=3',
    '--silent',
    '--disable-dev-tools'
];

// ✅ Session management כמו FlareSolver
const activeSessions = new Map();
const browserStats = new Map();

// ✅ Cookie & Session storage
let globalCookieJar = new Map();

async function createUltimateBrowser() {
    try {
        console.log('🔥 Creating ULTIMATE browser with FlareSolver-style config...');
        
        const browser = await puppeteer.launch({
            headless: 'new', // עדיין headless אבל עם כל ההסוואות
            args: ULTIMATE_BROWSER_ARGS,
            ignoreDefaultArgs: [
                '--enable-automation',
                '--enable-blink-features=AutomationControlled'
            ],
            ignoreHTTPSErrors: true,
            defaultViewport: null // תן לו להשתמש בגודל מלא
        });
        
        const browserId = Date.now() + Math.random();
        browserStats.set(browserId, { 
            requests: 0, 
            created: Date.now(),
            lastUsed: Date.now() 
        });
        
        return { 
            browser, 
            busy: false, 
            id: browserId,
            requests: 0,
            created: Date.now()
        };
    } catch (error) {
        console.error('❌ Failed to create ULTIMATE browser:', error.message);
        return null;
    }
}

async function initBrowserPool() {
    console.log('🚀 Initializing ULTIMATE browser pool...');
    for (let i = 0; i < MAX_BROWSERS; i++) {
        try {
            const browserObj = await createUltimateBrowser();
            if (browserObj) {
                browserPool.push(browserObj);
                console.log(`✅ ULTIMATE Browser ${i + 1} ready for war!`);
            }
        } catch (error) {
            console.error(`❌ Failed to init browser ${i + 1}:`, error.message);
        }
    }
}

async function getBrowser() {
    let browserObj = browserPool.find(b => !b.busy);
    
    if (!browserObj) {
        console.log('⏳ All browsers busy, waiting...');
        for (let i = 0; i < 150; i++) { // המתנה יותר ארוכה
            await new Promise(resolve => setTimeout(resolve, 200));
            browserObj = browserPool.find(b => !b.busy);
            if (browserObj) break;
        }
    }
    
    if (!browserObj) {
        throw new Error('No browsers available after long wait');
    }
    
    // מחזור browsers יותר אגרסיבי
    if (browserObj.requests >= MAX_REQUESTS_PER_BROWSER || 
        (Date.now() - browserObj.created > 10 * 60 * 1000)) { // כל 10 דקות
        console.log(`🔄 Browser lifecycle refresh: ${browserObj.requests} requests, ${Math.round((Date.now() - browserObj.created) / 1000)}s old`);
        await recycleBrowser(browserObj);
    }
    
    browserObj.busy = true;
    browserObj.requests++;
    browserStats.get(browserObj.id).lastUsed = Date.now();
    
    return browserObj;
}

async function recycleBrowser(browserObj) {
    try {
        await browserObj.browser.close();
        browserStats.delete(browserObj.id);
        
        const newBrowserObj = await createUltimateBrowser();
        if (newBrowserObj) {
            const index = browserPool.indexOf(browserObj);
            browserPool[index] = newBrowserObj;
            console.log(`✅ Browser recycled with fresh fingerprints`);
        }
    } catch (error) {
        console.error('❌ Error recycling browser:', error.message);
    }
}

function releaseBrowser(browserObj) {
    if (browserObj) {
        browserObj.busy = false;
        console.log(`📤 Browser ${browserObj.id.toString().slice(-6)} released`);
    }
}

// ✅ ULTIMATE Page Setup - מבוסס על מחקר Byparr
async function setupUltimatePage(page) {
    console.log('🔧 Setting up ULTIMATE page stealth...');
    
    // ✅ הגדרת viewport מציאותי
    await page.setViewport({ width: 1920, height: 1080 });
    
    // ✅ User Agent מעודכן ואמיתי
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    ];
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(randomUA);
    
    // ✅ ULTIMATE Anti-detection injection - מבוסס על undetected-chromedriver
    await page.evaluateOnNewDocument(() => {
        // מחיקה מלאה של webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        delete navigator.__proto__.webdriver;
        
        // Chrome object מלא ומתקדם
        window.chrome = {
            runtime: {
                onConnect: null,
                onMessage: null,
                connect: function() { return { postMessage: function() {}, onMessage: { addListener: function() {} } }; },
                sendMessage: function() {},
                onStartup: { addListener: function() {} },
                onInstalled: { addListener: function() {} },
                id: 'mhjfbmdgcfjbbpaeojofohoefgiehjai'
            },
            loadTimes: function() {
                return {
                    commitLoadTime: Date.now() - Math.random() * 2000,
                    connectionInfo: 'h2',
                    finishDocumentLoadTime: Date.now() - Math.random() * 1000,
                    finishLoadTime: Date.now() - Math.random() * 800,
                    firstPaintAfterLoadTime: Date.now() - Math.random() * 500,
                    firstPaintTime: Date.now() - Math.random() * 700,
                    navigationType: 'Navigation',
                    npnNegotiatedProtocol: 'h2',
                    requestTime: Date.now() - Math.random() * 3000,
                    startLoadTime: Date.now() - Math.random() * 2500,
                    wasAlternateProtocolAvailable: true,
                    wasFetchedViaSpdy: true,
                    wasNpnNegotiated: true
                };
            },
            csi: function() {
                return {
                    startE: Date.now() - Math.random() * 2000,
                    onloadT: Date.now() - Math.random() * 1000,
                    pageT: Date.now() - Math.random() * 1500,
                    tran: 15
                };
            },
            app: {
                isInstalled: false,
                InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
            }
        };
        
        // Plugins אמיתיים ומתקדמים
        Object.defineProperty(navigator, 'plugins', {
            get: function() {
                return [
                    { 0: { description: "Portable Document Format", suffixes: "pdf", type: "application/pdf" }, description: "Chrome PDF Plugin", filename: "internal-pdf-viewer", length: 1, name: "Chrome PDF Plugin" },
                    { 0: { description: "Portable Document Format", suffixes: "pdf", type: "application/pdf" }, description: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", length: 1, name: "Chrome PDF Viewer" },
                    { 0: { description: "Native Client Executable", suffixes: "nexe", type: "application/x-nacl" }, 1: { description: "Portable Native Client Executable", suffixes: "pexe", type: "application/x-pnacl" }, description: "Native Client", filename: "internal-nacl-plugin", length: 2, name: "Native Client" }
                ];
            }
        });
        
        // Languages & Locale
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
        
        // Hardware מציאותי
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        
        // Screen properties מציאותיים
        Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
        
        // Permissions API
        if (navigator.permissions && navigator.permissions.query) {
            const originalQuery = navigator.permissions.query;
            navigator.permissions.query = function(parameters) {
                const responses = {
                    'notifications': { state: 'default' },
                    'geolocation': { state: 'prompt' },
                    'camera': { state: 'prompt' },
                    'microphone': { state: 'prompt' }
                };
                return Promise.resolve(responses[parameters.name] || { state: 'prompt' });
            };
        }
        
        // מחיקת כל automation flags
        const automationFlags = [
            '_phantom', '__nightmare', '_selenium', 'callPhantom', 'callSelenium',
            '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function',
            '__webdriver_script_func', '__webdriver_script_fn', '__fxdriver_evaluate',
            '__driver_unwrapped', '__webdriver_unwrapped', '__driver_evaluate',
            '__selenium_unwrapped', '__fxdriver_unwrapped', '__webdriver_script_function',
            'webdriver', '__webdriver_script_func', '__selenium_evaluate',
            '__selenium_unwrapped', '__fxdriver_unwrapped'
        ];
        
        automationFlags.forEach(flag => {
            delete window[flag];
            delete document[flag];
        });
        
        // Override native functions
        if (window.HTMLElement) {
            const originalToString = Function.prototype.toString;
            Function.prototype.toString = function() {
                if (this === HTMLElement.prototype.click) {
                    return 'function click() { [native code] }';
                }
                return originalToString.apply(this, arguments);
            };
        }
        
        // Canvas fingerprinting protection
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type) {
            const context = originalGetContext.apply(this, arguments);
            if (type === '2d') {
                // הוסף רעש קל לcanvas כדי למנוע fingerprinting
                const originalFillText = context.fillText;
                context.fillText = function() {
                    const args = Array.from(arguments);
                    if (args[1]) args[1] += Math.random() * 0.01;
                    if (args[2]) args[2] += Math.random() * 0.01;
                    return originalFillText.apply(this, args);
                };
            }
            return context;
        };
        
        // Mouse movement simulation
        let mouseData = { x: 0, y: 0, movements: 0 };
        
        document.addEventListener('DOMContentLoaded', () => {
            // סימולציה אוטומטית של תנועת עכבר
            const simulateMouseMovement = () => {
                mouseData.x += (Math.random() - 0.5) * 5;
                mouseData.y += (Math.random() - 0.5) * 5;
                mouseData.movements++;
                
                const event = new MouseEvent('mousemove', {
                    clientX: Math.max(0, Math.min(window.innerWidth, mouseData.x)),
                    clientY: Math.max(0, Math.min(window.innerHeight, mouseData.y)),
                    bubbles: true
                });
                document.dispatchEvent(event);
            };
            
            // תנועות אקראיות
            const interval = setInterval(simulateMouseMovement, 50 + Math.random() * 100);
            
            // הפסקה אחרי דקה
            setTimeout(() => clearInterval(interval), 60000);
        });
    });
    
    // ✅ Headers מתקדמים
    await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    });
    
    console.log('✅ ULTIMATE page stealth setup complete!');
    return page;
}

// ✅ Human behavior simulation מתקדם
async function simulateAdvancedHumanBehavior(page) {
    console.log('🤖 Simulating ADVANCED human behavior...');
    
    try {
        // תנועות עכבר מורכבות
        const paths = [
            { x: 100, y: 100 }, { x: 300, y: 200 }, { x: 500, y: 150 },
            { x: 700, y: 300 }, { x: 400, y: 400 }, { x: 800, y: 250 }
        ];
        
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            await page.mouse.move(path.x, path.y, { steps: Math.floor(Math.random() * 10) + 5 });
            await page.waitForTimeout(100 + Math.random() * 200);
        }
        
        // גלילה מורכבת
        await page.evaluate(() => {
            const scrollSteps = [0, 100, 50, 200, 150, 80];
            scrollSteps.forEach((step, i) => {
                setTimeout(() => {
                    window.scrollTo(0, step);
                }, i * 300);
            });
        });
        
        await page.waitForTimeout(1000);
        
        // לחיצות בנקודות שונות
        const clickPoints = [
            { x: 683, y: 384 }, { x: 500, y: 300 }, 
            { x: 800, y: 450 }, { x: 300, y: 200 }
        ];
        
        for (const point of clickPoints) {
            try {
                await page.mouse.click(point.x, point.y);
                await page.waitForTimeout(300 + Math.random() * 200);
            } catch (e) {}
        }
        
        // מקשי מקלדת
        await page.keyboard.press('Tab');
        await page.waitForTimeout(200);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        
    } catch (error) {
        console.log(`⚠️ Human behavior simulation error: ${error.message}`);
    }
}

// ✅ ULTIMATE Cloudflare bypass - גרסה ULTRA-PATIENT
async function ultimateCloudflareBypass(page, url, maxWaitTime = 60000, fullScraping = false) {
    console.log('💀 ULTIMATE Cloudflare bypass initiated - ULTRA-PATIENT mode...');
    
    const startTime = Date.now();
    let attempt = 0;
    
    // ✅ אסטרטגיה חדשה - פחות attempts, יותר זמן המתנה
    const baseWaitTime = fullScraping ? 8000 : 5000; // התחלה עם 5-8 שניות
    const maxPatientTime = Math.min(maxWaitTime * 0.9, 180000); // עד 3 דקות max
    
    while ((Date.now() - startTime) < maxPatientTime) {
        attempt++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        console.log(`🚀 ULTRA-PATIENT attempt ${attempt} - ${elapsed}s (max: ${Math.round(maxPatientTime/1000)}s)`);
        
        try {
            const currentTitle = await page.title();
            const currentUrl = page.url();
            
            console.log(`📍 Status: "${currentTitle.substring(0, 60)}..."`);
            
            // בדיקות Cloudflare מתקדמות
            const cloudflareIndicators = [
                'Just a moment',
                'Checking your browser',
                'Verifying you are human',
                'Please wait',
                'Loading',
                'DDoS protection',
                'Security check',
                'Cloudflare',
                'Ray ID'
            ];
            
            const isCloudflareActive = cloudflareIndicators.some(indicator => 
                currentTitle.toLowerCase().includes(indicator.toLowerCase())
            );
            
            // בדיקת URL - אם יש ssd parameter זה אומר שעברנו
            const hasSSdParam = currentUrl.includes('ssd=');
            const urlChanged = currentUrl !== url; // URL השתנה מהמקורי
            
            if (isCloudflareActive && !hasSSdParam) {
                console.log('☁️ Cloudflare still active - deploying ULTRA-PATIENT countermeasures...');
                
                // ✅ אם זה attempt ראשון או כל 3 attempts - עשה אינטראקציה
                if (attempt === 1 || attempt % 3 === 0) {
                    console.log('🤖 Deploying advanced human simulation...');
                    await simulateAdvancedHumanBehavior(page);
                    
                    // ✅ חפש ואינטראקט עם iframes/turnstile
                    try {
                        const iframes = await page.$('iframe');
                        console.log(`🔍 Found ${iframes.length} iframes`);
                        
                        if (iframes.length > 0) {
                            for (let i = 0; i < Math.min(iframes.length, 2); i++) {
                                try {
                                    const frame = await iframes[i].contentFrame();
                                    if (frame) {
                                        console.log(`🎯 Interacting with iframe ${i + 1}...`);
                                        
                                        // נסה לקליק בתוך iframe
                                        await frame.click('body').catch(() => {});
                                        await page.waitForTimeout(1000);
                                        
                                        // חפש checkbox/button
                                        const interactiveElements = await frame.$('input[type="checkbox"], button, .challenge-form, [data-sitekey]').catch(() => []);
                                        if (interactiveElements.length > 0) {
                                            console.log(`✅ Found interactive element in iframe ${i + 1}`);
                                            await interactiveElements[0].click();
                                            await page.waitForTimeout(2000);
                                        }
                                    }
                                } catch (iframeError) {
                                    console.log(`⚠️ Iframe ${i + 1} error: ${iframeError.message}`);
                                }
                            }
                        }
                    } catch (iframeError) {
                        console.log(`⚠️ General iframe error: ${iframeError.message}`);
                    }
                    
                    // ✅ חפש כפתורים בדף הראשי
                    const mainPageButtons = await page.$('button, input[type="button"], input[type="submit"], .btn, [role="button"], .challenge-form button').catch(() => []);
                    if (mainPageButtons.length > 0) {
                        console.log(`🔘 Found ${mainPageButtons.length} buttons on main page`);
                        try {
                            await mainPageButtons[0].click();
                            await page.waitForTimeout(1500);
                        } catch (clickError) {
                            console.log(`⚠️ Button click error: ${clickError.message}`);
                        }
                    }
                }
                
                // ✅ ULTRA-PATIENT WAIT - זה הקסם!
                // המתנה מתקדמת - מתחיל קצר והולך ארוך יותר
                const waitMultiplier = Math.min(attempt, 6); // עד פי 6
                const currentWait = baseWaitTime * waitMultiplier;
                
                console.log(`⏳ ULTRA-PATIENT wait: ${Math.round(currentWait/1000)}s (attempt ${attempt}, multiplier: ${waitMultiplier})`);
                
                // חלק את הזמן לחלקים קטנים כדי לעשות בדיקות ביניים
                const chunks = Math.ceil(currentWait / 2000); // כל 2 שניות בדיקה
                const chunkWait = Math.floor(currentWait / chunks);
                
                for (let chunk = 0; chunk < chunks; chunk++) {
                    await page.waitForTimeout(chunkWait);
                    
                    // בדיקת ביניים - אולי זה השתנה
                    const intermediateTitle = await page.title().catch(() => currentTitle);
                    const intermediateUrl = page.url();
                    
                    if (!cloudflareIndicators.some(ind => intermediateTitle.toLowerCase().includes(ind.toLowerCase())) ||
                        intermediateUrl.includes('ssd=')) {
                        console.log(`🎯 Status changed during wait! Breaking early...`);
                        break;
                    }
                    
                    if (chunk % 3 === 0) { // כל 6 שניות
                        console.log(`⏳ Still waiting... (${Math.round((chunk * chunkWait)/1000)}s/${Math.round(currentWait/1000)}s)`);
                    }
                }
                
            } else {
                // לא Cloudflare או יש ssd parameter - בדוק תוכן
                console.log(`✅ Cloudflare indicators cleared or URL changed! Checking content...`);
                
                const hasContent = await page.evaluate(() => {
                    const bodyText = document.body ? document.body.innerText : '';
                    const hasRealContent = bodyText.length > 800;
                    const noCloudflareText = !bodyText.toLowerCase().includes('just a moment') && 
                                           !bodyText.toLowerCase().includes('checking your browser') &&
                                           !bodyText.toLowerCase().includes('verifying you are human');
                    
                    console.log(`Content check: ${bodyText.length} chars, no CF text: ${noCloudflareText}`);
                    return hasRealContent && noCloudflareText;
                }).catch(() => false);
                
                if (hasContent || hasSSdParam || urlChanged) {
                    console.log(`💀 ULTRA-PATIENT SUCCESS after ${elapsed}s!`);
                    console.log(`🎯 Success indicators: content=${hasContent}, ssd=${hasSSdParam}, url_changed=${urlChanged}`);
                    
                    if (fullScraping) {
                        console.log('⏳ Final stabilization for full scraping...');
                        await page.waitForTimeout(5000); // המתנה ארוכה יותר למצב מלא
                    } else {
                        await page.waitForTimeout(2000); // המתנה קצרה למצב רגיל
                    }
                    
                    return true;
                } else {
                    console.log('⚠️ Page indicators cleared but content insufficient, continuing...');
                }
            }
            
        } catch (error) {
            console.log(`⚠️ Bypass attempt error: ${error.message}`);
        }
        
        // בדיקה אם עברנו את הזמן המקסימלי
        if (Date.now() - startTime >= maxPatientTime) {
            break;
        }
    }
    
    const finalElapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏰ ULTRA-PATIENT bypass completed after ${finalElapsed}s (${attempt} attempts)`);
    
    // בדיקה אחרונה
    const finalUrl = page.url();
    const hasSSdParam = finalUrl.includes('ssd=');
    
    if (hasSSdParam) {
        console.log(`✅ FINAL SUCCESS: Found ssd parameter in URL!`);
        return true;
    }
    
    console.log(`⚠️ No clear success indicators, but proceeding...`);
    return false;
}

// Main scraping function עם המתנה מוגברת
async function scrapeWithUltimateBypass(url, fullScraping = false, maxWaitTime = 120000) { // הגדלתי ל-120 שניות default
    const startTime = Date.now();
    let browserObj = null;
    let page = null;
    
    try {
        console.log(`💀 Starting ULTIMATE ${fullScraping ? 'FULL SCRAPING' : 'URL EXTRACTION'}`);
        console.log(`🔗 Target: ${url.substring(0, 100)}...`);
        console.log(`⏰ Max wait time: ${Math.round(maxWaitTime/1000)}s`);
        
        browserObj = await getBrowser();
        page = await browserObj.browser.newPage();
        
        // Setup ultimate page
        await setupUltimatePage(page);
        
        console.log('🚀 Navigating to target...');
        
        // Initial navigation with longer timeout
        await page.goto(url, {
            waitUntil: ['domcontentloaded'],
            timeout: 45000 // הגדלתי מ-30 ל-45 שניות
        });
        
        // ✅ המתנה ראשונית - לתת לדף להתייצב
        console.log('⏳ Initial page stabilization...');
        await page.waitForTimeout(3000); // המתנה של 3 שניות בהתחלה
        
        // Check and bypass Cloudflare עם זמן מוגבר
        const bypassSuccess = await ultimateCloudflareBypass(page, url, maxWaitTime - 10000, fullScraping);
        
        if (!bypassSuccess) {
            console.log('⚠️ ULTIMATE bypass inconclusive, proceeding anyway...');
        }
        
        // Final stabilization - יותר זמן למצב מלא
        const finalWait = fullScraping ? 5000 : 2000;
        console.log(`⏳ Final stabilization: ${finalWait/1000}s...`);
        await page.waitForTimeout(finalWait);
        
        // Collect results
        const finalUrl = page.url();
        const html = await page.content();
        const cookies = await page.cookies();
        const elapsed = Date.now() - startTime;
        
        // Store cookies for session management
        if (cookies.length > 0) {
            const domain = new URL(finalUrl).hostname;
            globalCookieJar.set(domain, { cookies, timestamp: Date.now() });
            console.log(`🍪 Stored ${cookies.length} cookies for ${domain}`);
        }
        
        console.log(`💀 ULTIMATE scraping completed in ${elapsed}ms`);
        console.log(`🔗 Final URL: ${finalUrl.substring(0, 100)}...`);
        console.log(`📄 Content: ${html.length} bytes`);
        console.log(`🎯 Has ssd param: ${finalUrl.includes('ssd=') ? 'YES ✅' : 'NO ❌'}`);
        
        // ✅ תוספת: בדיקה אם יש תוכן של חלקים (לfull scraping)
        if (fullScraping) {
            const hasPartsContent = html.includes('part-search') || 
                                  html.includes('data-codeonimage') || 
                                  html.includes('oem') ||
                                  html.includes('.gif');
            console.log(`🔧 Parts content detected: ${hasPartsContent ? 'YES ✅' : 'NO ❌'}`);
        }
        
        return {
            success: true,
            html: html,
            url: finalUrl,
            cookies: cookies,
            hasSSd: finalUrl.includes('ssd='),
            elapsed: elapsed,
            scrapingType: fullScraping ? 'ultimate_full' : 'ultimate_url',
            bypassSuccess: bypassSuccess
        };
        
    } catch (error) {
        console.error('💀 ULTIMATE scraping error:', error.message);
        return {
            success: false,
            error: error.message,
            url: url
        };
        
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
        if (browserObj) {
            releaseBrowser(browserObj);
        }
    }
}

// Memory cleanup
async function ultimateMemoryCleanup() {
    console.log('\n' + '💀'.repeat(20));
    console.log('🧹 ULTIMATE memory warfare...');
    
    const memBefore = process.memoryUsage();
    console.log(`📊 Memory before: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);
    
    // Force garbage collection
    if (global.gc) {
        global.gc();
    }
    
    // Clear old cookies
    const now = Date.now();
    for (const [domain, cookies] of globalCookieJar.entries()) {
        if (now - cookies.timestamp > 30 * 60 * 1000) { // 30 minutes
            globalCookieJar.delete(domain);
            console.log(`🗑️ Cleared old cookies for ${domain}`);
        }
    }
    
    const memAfter = process.memoryUsage();
    console.log(`📊 Memory after: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
    console.log(`💾 Freed: ${Math.round((memBefore.heapUsed - memAfter.heapUsed) / 1024 / 1024)}MB`);
    console.log(`🌐 Active browsers: ${browserPool.length}`);
    console.log(`⚡ Busy browsers: ${browserPool.filter(b => b.busy).length}`);
    console.log(`🍪 Cookie domains: ${globalCookieJar.size}`);
    console.log('💀'.repeat(20) + '\n');
}

// Main endpoint
app.post('/v1', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { 
            cmd, 
            url, 
            maxTimeout = 120000, // הגדלתי ל-120 שניות default
            session,
            fullScraping = false
        } = req.body;
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }
        
        console.log(`\n${'💀'.repeat(30)}`);
        console.log(`💀 ULTIMATE Request at ${new Date().toISOString()}`);
        console.log(`🔗 URL: ${url.substring(0, 100)}...`);
        console.log(`⏱️ Timeout: ${maxTimeout}ms`);
        console.log(`🎯 Mode: ${fullScraping ? 'ULTIMATE FULL WARFARE' : 'ULTIMATE URL EXTRACTION'}`);
        console.log(`${'💀'.repeat(30)}\n`);
        
        const result = await Promise.race([
            scrapeWithUltimateBypass(url, fullScraping, maxTimeout),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('ULTIMATE Timeout')), maxTimeout + 15000)
            )
        ]);
        
        if (result.success) {
            const elapsed = Date.now() - startTime;
            
            console.log(`\n${'💀'.repeat(30)}`);
            console.log(`💀 ULTIMATE SUCCESS - Total time: ${elapsed}ms`);
            console.log(`🔗 Final URL: ${result.url?.substring(0, 120) || 'N/A'}...`);
            console.log(`📄 HTML Length: ${result.html?.length || 0} bytes`);
            console.log(`🎯 Has ssd param: ${result.hasSSd ? 'YES ✅' : 'NO ❌'}`);
            console.log(`🚀 Scraping type: ${result.scrapingType}`);
            console.log(`☁️ Bypass success: ${result.bypassSuccess ? 'YES ✅' : 'UNKNOWN'}`);
            console.log(`${'💀'.repeat(30)}\n`);
            
            res.json({
                status: 'ok',
                message: 'ULTIMATE Success',
                solution: {
                    url: result.url || url,
                    status: 200,
                    response: result.html,
                    cookies: result.cookies || [],
                    userAgent: 'Mozilla/5.0'
                },
                startTimestamp: startTime,
                endTimestamp: Date.now(),
                version: '5.0.0-ULTIMATE-CLOUDFLARE-DESTROYER',
                hasSSd: result.hasSSd || false,
                scrapingType: result.scrapingType,
                bypassSuccess: result.bypassSuccess
            });
        } else {
            throw new Error(result.error || 'ULTIMATE error');
        }
        
    } catch (error) {
        console.error(`\n${'💀'.repeat(30)}`);
        console.error('💀 ULTIMATE REQUEST FAILED:', error.message);
        console.error(`${'💀'.repeat(30)}\n`);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            solution: null
        });
    }
});

// Health check
app.get('/health', async (req, res) => {
    const memory = process.memoryUsage();
    
    res.json({
        status: 'ultimate-warfare-ready',
        uptime: Math.round(process.uptime()) + 's',
        browsers: browserPool.length,
        activeBrowsers: browserPool.filter(b => b.busy).length,
        memory: {
            used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
        },
        cookieDomains: globalCookieJar.size,
        features: [
            '💀 ULTIMATE Cloudflare destruction',
            '🤖 Advanced human behavior simulation',
            '🔧 FlareSolver-style browser setup',
            '🍪 Smart cookie management',
            '⚡ Aggressive browser recycling',
            '🎯 Turnstile interaction',
            '🧠 Multi-technique bypass'
        ]
    });
});

// Root
app.get('/', (req, res) => {
    const memory = process.memoryUsage();
    res.send(`
        <h1>💀 ULTIMATE Puppeteer Destroyer v5.0</h1>
        <p><strong>Status:</strong> Locked and loaded for Cloudflare destruction</p>
        <p><strong>Memory:</strong> ${Math.round(memory.heapUsed / 1024 / 1024)}MB used</p>
        <p><strong>Browsers:</strong> ${browserPool.length} ultimate weapons</p>
        <p><strong>Cookie Domains:</strong> ${globalCookieJar.size} captured</p>
        
        <h3>💀 ULTIMATE Arsenal:</h3>
        <ul>
            <li>✅ FlareSolver-style browser configuration</li>
            <li>✅ Undetected ChromeDriver techniques</li>
            <li>✅ SeleniumBase-inspired stealth mode</li>
            <li>✅ Advanced Turnstile interaction</li>
            <li>✅ Human behavior simulation</li>
            <li>✅ Canvas fingerprint protection</li>
            <li>✅ Smart session management</li>
            <li>✅ Aggressive anti-detection</li>
        </ul>
        
        <h3>⚔️ Battle Modes:</h3>
        <p><strong>Quick Strike:</strong> <code>{"fullScraping": false}</code> - Fast URL extraction</p>
        <p><strong>Total War:</strong> <code>{"fullScraping": true, "maxTimeout": 120000}</code> - Full site destruction</p>
        
        <p><strong>⚠️ WARNING:</strong> This weapon is designed for maximum Cloudflare annihilation!</p>
    `);
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║        💀 ULTIMATE PUPPETEER v5.0 💀         ║
║     CLOUDFLARE DESTRUCTION SYSTEM ONLINE     ║
║              Port: ${PORT}                       ║
║      Based on FlareSolver + Byparr tech      ║
║         ALL STEALTH SYSTEMS ACTIVE           ║
╚═══════════════════════════════════════════════╝
    `);
    
    console.log('💀 Loading ultimate weapon systems...');
    await initBrowserPool();
    
    setInterval(ultimateMemoryCleanup, 60000);
    console.log('⚔️ ULTIMATE CLOUDFLARE DESTROYER IS ONLINE!');
    console.log('💀 Ready to annihilate any protection system!');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('💀 ULTIMATE shutdown sequence initiated...');
    for (const browserObj of browserPool) {
        await browserObj.browser.close().catch(() => {});
    }
    browserPool = [];
    browserStats.clear();
    globalCookieJar.clear();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💀 ULTIMATE Exception:', error.message);
    if (global.gc) global.gc();
});

process.on('unhandledRejection', (error) => {
    console.error('💀 ULTIMATE Rejection:', error.message);
});
