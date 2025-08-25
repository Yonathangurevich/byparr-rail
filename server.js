const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

let browserPool = [];
const MAX_BROWSERS = 1;
const MAX_REQUESTS_PER_BROWSER = 50;

// ✅ Ultra-stealth browser arguments
const BROWSER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
    '--disable-web-security',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1920,1080', // גודל מסך רגיל
    '--disable-accelerated-2d-canvas',
    '--disable-dev-profile',
    '--memory-pressure-off',
    '--max_old_space_size=512',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-javascript-harmony-shipping',
    '--disable-ipc-flooding-protection',
    // ✅ טכניקות אנטי-זיהוי מתקדמות
    '--disable-client-side-phishing-detection',
    '--disable-sync',
    '--disable-default-apps',
    '--hide-scrollbars',
    '--disable-bundled-ppapi-flash',
    '--mute-audio',
    '--no-pings',
    '--no-zygote',
    '--disable-background-networking',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-features=TranslateUI',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--use-mock-keychain'
];

const browserStats = new Map();

async function createNewBrowser() {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: BROWSER_ARGS,
            ignoreDefaultArgs: ['--enable-automation'],
            ignoreHTTPSErrors: true,
            defaultViewport: null // תן לו להשתמש בגודל החלון האמיתי
        });
        
        const browserId = Date.now() + Math.random();
        browserStats.set(browserId, { requests: 0, created: Date.now() });
        
        return { 
            browser, 
            busy: false, 
            id: browserId,
            requests: 0 
        };
    } catch (error) {
        console.error('❌ Failed to create browser:', error.message);
        return null;
    }
}

async function initBrowserPool() {
    console.log('🚀 Initializing EXTREME bypass browser pool...');
    for (let i = 0; i < MAX_BROWSERS; i++) {
        try {
            const browserObj = await createNewBrowser();
            if (browserObj) {
                browserPool.push(browserObj);
                console.log(`✅ Extreme Browser ${i + 1} initialized`);
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
        for (let i = 0; i < 100; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            browserObj = browserPool.find(b => !b.busy);
            if (browserObj) break;
        }
    }
    
    if (!browserObj) {
        throw new Error('No browsers available - all busy');
    }
    
    if (browserObj.requests >= MAX_REQUESTS_PER_BROWSER) {
        console.log(`🔄 Browser ${browserObj.id} reached request limit, recreating...`);
        await recycleBrowser(browserObj);
    }
    
    browserObj.busy = true;
    browserObj.requests++;
    
    return browserObj;
}

async function recycleBrowser(browserObj) {
    try {
        await browserObj.browser.close();
        browserStats.delete(browserObj.id);
        
        const newBrowserObj = await createNewBrowser();
        if (newBrowserObj) {
            const index = browserPool.indexOf(browserObj);
            browserPool[index] = newBrowserObj;
            console.log(`✅ Browser recycled successfully`);
        }
    } catch (error) {
        console.error('❌ Error recycling browser:', error.message);
    }
}

function releaseBrowser(browserObj) {
    if (browserObj) {
        browserObj.busy = false;
        console.log(`📤 Browser ${browserObj.id} released (${browserObj.requests} requests)`);
    }
}

// ✅ פונקציה לסימולציה של התנהגות אנושית
async function simulateHumanBehavior(page) {
    console.log('🤖 Simulating human behavior...');
    
    // תנועות עכבר רנדומליות
    for (let i = 0; i < 3; i++) {
        const x = Math.random() * 1200 + 100;
        const y = Math.random() * 600 + 100;
        await page.mouse.move(x, y, { steps: 10 });
        await page.waitForTimeout(100 + Math.random() * 200);
    }
    
    // גלילה רנדומלית
    await page.evaluate(() => {
        window.scrollTo(0, Math.random() * 300);
    });
    
    await page.waitForTimeout(500);
    
    // תנועת עכבר נוספת
    await page.mouse.move(683, 384, { steps: 5 });
    await page.waitForTimeout(300);
}

// ✅ פונקציה מתקדמת לעבור Cloudflare
async function bypassCloudflareExtreme(page, maxWaitTime = 45000) {
    console.log('🔥 EXTREME Cloudflare bypass mode activated...');
    
    const startTime = Date.now();
    let attempt = 0;
    
    while ((Date.now() - startTime) < maxWaitTime) {
        attempt++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        console.log(`🚀 EXTREME attempt ${attempt} - ${elapsed}s/${Math.round(maxWaitTime/1000)}s`);
        
        try {
            // בדיקת מצב נוכחי
            const currentTitle = await page.title();
            const currentUrl = page.url();
            
            console.log(`📍 Current: "${currentTitle.substring(0, 40)}..."`);
            
            // אם אנחנו עדיין ב-Cloudflare
            const isStillBlocked = currentTitle.includes('Just a moment') ||
                                 currentTitle.includes('Checking your browser') ||
                                 currentTitle.includes('Verifying you are human') ||
                                 currentTitle.includes('Please wait');
            
            if (isStillBlocked) {
                console.log('☁️ Still blocked by Cloudflare, trying EXTREME measures...');
                
                // ✅ טכניקה 1: סימולציה של התנהגות אנושית
                await simulateHumanBehavior(page);
                
                // ✅ טכניקה 2: נסה ללחוץ על אלמנטים בדף
                try {
                    // חפש כל סוג של כפתור או לינק
                    const clickableElements = await page.$$('button, a, input[type="button"], input[type="submit"], [role="button"], .button, .btn');
                    
                    if (clickableElements.length > 0) {
                        console.log(`🔘 Found ${clickableElements.length} clickable elements`);
                        
                        // לחץ על הראשון
                        await clickableElements[0].click();
                        console.log('✅ Clicked on first element');
                        await page.waitForTimeout(2000);
                    }
                    
                    // נסה ללחוץ על הדף עצמו במקומות שונים
                    const clickPoints = [
                        { x: 683, y: 384 },
                        { x: 500, y: 300 },
                        { x: 800, y: 450 },
                        { x: 400, y: 200 }
                    ];
                    
                    for (const point of clickPoints) {
                        await page.mouse.click(point.x, point.y);
                        await page.waitForTimeout(500);
                    }
                    
                } catch (clickError) {
                    console.log(`⚠️ Click error: ${clickError.message}`);
                }
                
                // ✅ טכניקה 3: מקשי מקלדת
                try {
                    await page.keyboard.press('Tab');
                    await page.waitForTimeout(200);
                    await page.keyboard.press('Enter');
                    await page.waitForTimeout(1000);
                } catch (keyError) {
                    console.log(`⚠️ Keyboard error: ${keyError.message}`);
                }
                
                // ✅ טכניקה 4: רענן את הדף (לפעמים עוזר)
                if (attempt % 5 === 0) {
                    console.log('🔄 Refreshing page...');
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(3000);
                }
                
                // המתנה ארוכה יותר (Cloudflare צריך זמן)
                const waitTime = 3000 + Math.random() * 2000; // 3-5 שניות
                await page.waitForTimeout(waitTime);
                
            } else {
                // בדיקה שיש תוכן אמיתי
                const hasContent = await page.evaluate(() => {
                    const bodyText = document.body ? document.body.innerText : '';
                    return bodyText.length > 500;
                });
                
                if (hasContent) {
                    console.log(`✅ EXTREME bypass SUCCESS after ${elapsed}s!`);
                    return true;
                } else {
                    console.log('⚠️ No real content yet, continuing...');
                }
            }
            
        } catch (error) {
            console.log(`⚠️ Error in bypass attempt: ${error.message}`);
        }
    }
    
    const finalElapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏰ EXTREME bypass timeout after ${finalElapsed}s`);
    return false;
}

// Main scraping function עם EXTREME bypass
async function scrapeWithExtremeBypass(url, fullScraping = false, maxWaitTime = 60000) {
    const startTime = Date.now();
    let browserObj = null;
    let page = null;
    
    try {
        console.log(`🎯 Starting EXTREME ${fullScraping ? 'FULL SCRAPING' : 'URL EXTRACTION'}`);
        console.log(`🔗 URL: ${url.substring(0, 100)}...`);
        
        browserObj = await getBrowser();
        page = await browserObj.browser.newPage();
        
        // ✅ הגדרות מתקדמות מאוד
        await page.setViewport({ width: 1920, height: 1080 });
        
        // User agent אמיתי ומעודכן
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        
        // ✅ Anti-detection EXTREME
        await page.evaluateOnNewDocument(() => {
            // מחיקה מלאה של automation
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            delete navigator.__proto__.webdriver;
            
            // Chrome object מלא ואמיתי
            window.chrome = {
                runtime: {
                    onConnect: null,
                    onMessage: null,
                    connect: function() {},
                    sendMessage: function() {}
                },
                loadTimes: function() {
                    return {
                        commitLoadTime: Date.now() - Math.random() * 1000,
                        connectionInfo: 'http/2.0',
                        finishDocumentLoadTime: Date.now() - Math.random() * 500,
                        finishLoadTime: Date.now() - Math.random() * 300,
                        firstPaintAfterLoadTime: Date.now() - Math.random() * 200,
                        firstPaintTime: Date.now() - Math.random() * 400,
                        navigationType: 'Navigation',
                        npnNegotiatedProtocol: 'h2',
                        requestTime: Date.now() - Math.random() * 2000,
                        startLoadTime: Date.now() - Math.random() * 1500,
                        wasAlternateProtocolAvailable: true,
                        wasFetchedViaSpdy: true,
                        wasNpnNegotiated: true
                    };
                },
                csi: function() {
                    return {
                        startE: Date.now() - Math.random() * 1000,
                        onloadT: Date.now() - Math.random() * 500,
                        pageT: Date.now() - Math.random() * 800,
                        tran: 15
                    };
                },
                app: {
                    isInstalled: false,
                    InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                    RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
                }
            };
            
            // Plugins אמיתיים
            Object.defineProperty(navigator, 'plugins', {
                get: function() {
                    return [
                        { 0: { description: "Portable Document Format", suffixes: "pdf", type: "application/pdf" }, description: "Chrome PDF Plugin", filename: "internal-pdf-viewer", length: 1, name: "Chrome PDF Plugin" },
                        { 0: { description: "Portable Document Format", suffixes: "pdf", type: "application/pdf" }, description: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", length: 1, name: "Chrome PDF Viewer" },
                        { 0: { description: "Native Client Executable", suffixes: "nexe", type: "application/x-nacl" }, 1: { description: "Portable Native Client Executable", suffixes: "pexe", type: "application/x-pnacl" }, description: "Native Client", filename: "internal-nacl-plugin", length: 2, name: "Native Client" }
                    ];
                }
            });
            
            // Languages
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            
            // Hardware
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
            
            // Permissions
            if (navigator.permissions && navigator.permissions.query) {
                const originalQuery = navigator.permissions.query;
                navigator.permissions.query = function(parameters) {
                    if (parameters.name === 'notifications') {
                        return Promise.resolve({ state: 'default' });
                    }
                    return originalQuery.apply(navigator.permissions, arguments);
                };
            }
            
            // מחיקת automation flags
            const flags = [
                '_phantom', '__nightmare', '_selenium', 'callPhantom', 'callSelenium',
                '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function',
                '__webdriver_script_func', '__webdriver_script_fn', '__fxdriver_evaluate',
                '__driver_unwrapped', '__webdriver_unwrapped', '__driver_evaluate',
                '__selenium_unwrapped', '__fxdriver_unwrapped'
            ];
            
            flags.forEach(flag => {
                delete window[flag];
            });
            
            // Override toString functions
            if (window.HTMLElement) {
                window.HTMLElement.prototype.click.toString = function() {
                    return 'function click() { [native code] }';
                };
            }
        });
        
        // Headers מתקדמים
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
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
            'sec-ch-ua-platform': '"Windows"'
        });
        
        console.log('🚀 Starting EXTREME navigation...');
        
        // Navigate
        await page.goto(url, {
            waitUntil: ['domcontentloaded'],
            timeout: 30000
        });
        
        // בדיקה ראשונית
        const title = await page.title();
        console.log(`📄 Initial title: ${title.substring(0, 50)}...`);
        
        // אם יש Cloudflare, הפעל EXTREME bypass
        const needsBypass = title.includes('Just a moment') || 
                          title.includes('Checking your browser') ||
                          title.includes('Verifying you are human');
        
        if (needsBypass) {
            const bypassSuccess = await bypassCloudflareExtreme(page, fullScraping ? maxWaitTime : 30000);
            if (!bypassSuccess) {
                console.log('⚠️ EXTREME bypass failed, but continuing...');
            }
        } else {
            console.log('✅ No Cloudflare detected');
            if (fullScraping) {
                await page.waitForTimeout(2000);
            }
        }
        
        // Final wait
        await page.waitForTimeout(1000);
        
        // Get results
        const finalUrl = page.url();
        const html = await page.content();
        const cookies = await page.cookies();
        const elapsed = Date.now() - startTime;
        
        console.log(`✅ EXTREME scraping completed in ${elapsed}ms`);
        console.log(`🔗 Final URL: ${finalUrl.substring(0, 100)}...`);
        console.log(`📄 HTML Length: ${html.length} bytes`);
        console.log(`🎯 Has ssd param: ${finalUrl.includes('ssd=') ? 'YES ✅' : 'NO ❌'}`);
        
        return {
            success: true,
            html: html,
            url: finalUrl,
            cookies: cookies,
            hasSSd: finalUrl.includes('ssd='),
            elapsed: elapsed,
            scrapingType: fullScraping ? 'extreme_full' : 'extreme_url'
        };
        
    } catch (error) {
        console.error('❌ EXTREME scraping error:', error.message);
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
async function memoryCleanup() {
    console.log('\n' + '='.repeat(50));
    console.log('🧹 EXTREME memory cleanup...');
    
    const memBefore = process.memoryUsage();
    console.log(`📊 Memory before: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);
    
    if (global.gc) {
        global.gc();
    }
    
    const memAfter = process.memoryUsage();
    console.log(`📊 Memory after: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
    console.log(`💾 Saved: ${Math.round((memBefore.heapUsed - memAfter.heapUsed) / 1024 / 1024)}MB`);
    console.log('='.repeat(50) + '\n');
}

// Main endpoint
app.post('/v1', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { 
            cmd, 
            url, 
            maxTimeout = 60000, 
            session,
            fullScraping = false
        } = req.body;
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔥 EXTREME Request at ${new Date().toISOString()}`);
        console.log(`🔗 URL: ${url.substring(0, 100)}...`);
        console.log(`⏱️ Timeout: ${maxTimeout}ms`);
        console.log(`🎯 Mode: ${fullScraping ? 'EXTREME FULL SCRAPING' : 'EXTREME URL EXTRACTION'}`);
        console.log(`${'='.repeat(60)}\n`);
        
        const result = await Promise.race([
            scrapeWithExtremeBypass(url, fullScraping, maxTimeout),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), maxTimeout + 10000)
            )
        ]);
        
        if (result.success) {
            const elapsed = Date.now() - startTime;
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🔥 EXTREME SUCCESS - Total time: ${elapsed}ms`);
            console.log(`🔗 Final URL: ${result.url?.substring(0, 120) || 'N/A'}...`);
            console.log(`📄 HTML Length: ${result.html?.length || 0} bytes`);
            console.log(`🎯 Has ssd param: ${result.hasSSd ? 'YES ✅' : 'NO ❌'}`);
            console.log(`🚀 Scraping type: ${result.scrapingType}`);
            console.log(`${'='.repeat(60)}\n`);
            
            res.json({
                status: 'ok',
                message: 'EXTREME Success',
                solution: {
                    url: result.url || url,
                    status: 200,
                    response: result.html,
                    cookies: result.cookies || [],
                    userAgent: 'Mozilla/5.0'
                },
                startTimestamp: startTime,
                endTimestamp: Date.now(),
                version: '4.3.0-EXTREME-cloudflare-killer',
                hasSSd: result.hasSSd || false,
                scrapingType: result.scrapingType
            });
        } else {
            throw new Error(result.error || 'EXTREME error');
        }
        
    } catch (error) {
        console.error(`\n${'='.repeat(60)}`);
        console.error('🔥 EXTREME REQUEST FAILED:', error.message);
        console.error(`${'='.repeat(60)}\n`);
        
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
        status: 'healthy-extreme',
        uptime: Math.round(process.uptime()) + 's',
        browsers: browserPool.length,
        activeBrowsers: browserPool.filter(b => b.busy).length,
        memory: {
            used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
        },
        features: [
            'EXTREME Cloudflare bypass',
            'Human behavior simulation',
            'Advanced anti-detection',
            'Multi-technique approach'
        ]
    });
});

// Root
app.get('/', (req, res) => {
    const memory = process.memoryUsage();
    res.send(`
        <h1>🔥 EXTREME Puppeteer Scraper v4.3</h1>
        <p><strong>Status:</strong> Armed with EXTREME techniques</p>
        <p><strong>Memory:</strong> ${Math.round(memory.heapUsed / 1024 / 1024)}MB used</p>
        <p><strong>Browsers:</strong> ${browserPool.length} EXTREME</p>
        
        <h3>🔥 EXTREME Features:</h3>
        <ul>
            <li>✅ Human behavior simulation</li>
            <li>✅ Mouse movements & clicks</li>
            <li>✅ Keyboard interactions</li>
            <li>✅ Page refresh strategy</li>
            <li>✅ Advanced anti-detection</li>
            <li>✅ Multiple bypass attempts</li>
        </ul>
        
        <h3>💀 Cloudflare Killer Mode:</h3>
        <p>Uses every known technique to bypass Cloudflare protection</p>
    `);
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔════════════════════════════════════════╗
║   🔥 EXTREME Puppeteer v4.3           ║
║   Cloudflare Killer Mode: ACTIVE      ║
║   Port: ${PORT}                            ║
║   Techniques: ALL LOADED 💀            ║
╚════════════════════════════════════════╝
    `);
    
    console.log('🚀 Loading EXTREME arsenal...');
    await initBrowserPool();
    
    setInterval(memoryCleanup, 60000);
    console.log('💀 EXTREME mode ready to destroy Cloudflare!');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔥 EXTREME shutdown initiated...');
    for (const browserObj of browserPool) {
        await browserObj.browser.close().catch(() => {});
    }
    browserPool = [];
    browserStats.clear();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 EXTREME Exception:', error.message);
    if (global.gc) global.gc();
});

process.on('unhandledRejection', (error) => {
    console.error('💥 EXTREME Rejection:', error.message);
});
