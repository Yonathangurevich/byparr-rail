const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Browser instance pool - הגבלה קבועה
let browserPool = [];
const MAX_BROWSERS = 1;
const MAX_REQUESTS_PER_BROWSER = 50;

// ✅ Browser launch options מיטובים לעבור Cloudflare מתקדם
const BROWSER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-web-security',
    '--disable-gpu',
    '--no-first-run',
    '--window-size=1366,768',
    '--disable-accelerated-2d-canvas',
    '--disable-dev-profile',
    '--memory-pressure-off',
    '--max_old_space_size=512',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    // ✅ תוספות לעבור Cloudflare מתקדם
    '--disable-features=VizDisplayCompositor',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-images', // ✅ חסוך bandwidth וזיכרון
    '--disable-javascript-harmony-shipping',
    '--disable-ipc-flooding-protection'
];

const browserStats = new Map();

async function createNewBrowser() {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: BROWSER_ARGS,
            ignoreDefaultArgs: ['--enable-automation'],
            ignoreHTTPSErrors: true
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
    console.log('🚀 Initializing enhanced browser pool...');
    for (let i = 0; i < MAX_BROWSERS; i++) {
        try {
            const browserObj = await createNewBrowser();
            if (browserObj) {
                browserPool.push(browserObj);
                console.log(`✅ Browser ${i + 1} initialized with Cloudflare bypass`);
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

// ✅ פונקציה משופרת - יכולה לעשות גם GET URL וגם FULL SCRAPING
async function scrapeWithEnhancedBypass(url, fullScraping = false, maxWaitTime = 30000) {
    const startTime = Date.now();
    let browserObj = null;
    let page = null;
    
    try {
        console.log(`🎯 Starting ${fullScraping ? 'FULL SCRAPING' : 'URL EXTRACTION'} for:`, url.substring(0, 80) + '...');
        browserObj = await getBrowser();
        
        page = await browserObj.browser.newPage();
        
        // ✅ הגדרות מתקדמות לעבור Cloudflare
        await page.setCacheEnabled(false);
        await page.setViewport({ width: 1366, height: 768 });
        
        // ✅ User agent אמיתי ומעודכן
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // ✅ מחיקת כל סימני automation
        await page.evaluateOnNewDocument(() => {
            // מחיקת webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // הוספת chrome object
            window.chrome = {
                runtime: {},
                loadTimes: function() {},
                csi: function() {}
            };
            
            // תיקון plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // תיקון languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            // תיקון permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                Promise.resolve({ state: Deno.enabled }) :
                originalQuery(parameters)
            );
            
            // מניעת זיהוי automation
            window.navigator.chrome = {
                runtime: {},
            };
            
            Object.defineProperty(navigator, 'maxTouchPoints', {
                get: () => 1
            });
        });
        
        // ✅ Headers מתקדמים
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        });
        
        console.log('🚀 Starting navigation...');
        
        // ✅ Navigation עם timeout מותאם
        const navigationTimeout = fullScraping ? maxWaitTime : 20000;
        
        await page.goto(url, {
            waitUntil: ['domcontentloaded'],
            timeout: navigationTimeout
        });
        
        const title = await page.title();
        console.log(`📄 Initial title: ${title.substring(0, 50)}...`);
        
        // ✅ זיהוי וטיפול ב-Cloudflare המתקדם
        const isCloudflareChallenge = title.includes('Just a moment') || 
                                    title.includes('Checking your browser') ||
                                    title.includes('Verifying you are human') ||
                                    await page.$('.cf-wrapper') !== null ||
                                    await page.$('#cf-content') !== null;
        
        if (isCloudflareChallenge) {
            console.log('☁️ Advanced Cloudflare detected, enhanced bypass mode...');
            
            // ✅ אסטרטגיה מתקדמת לעבור Cloudflare
            const maxAttempts = fullScraping ? Math.floor(maxWaitTime / 2000) : 10;
            
            for (let i = 0; i < maxAttempts; i++) {
                console.log(`⏳ Enhanced bypass attempt ${i + 1}/${maxAttempts}...`);
                
                // המתנה אקראית (מחקה התנהגות אנושית)
                const waitTime = 1500 + Math.random() * 1000;
                await page.waitForTimeout(waitTime);
                
                const currentUrl = page.url();
                const currentTitle = await page.title();
                
                console.log(`🔍 Current: ${currentTitle.substring(0, 30)}... | URL: ${currentUrl.includes('ssd=') ? 'HAS SSD ✅' : 'NO SSD'}`);
                
                // בדיקות מתקדמות לזיהוי הצלחה
                const hasPassedCloudflare = !currentTitle.includes('Just a moment') && 
                                          !currentTitle.includes('Checking your browser') &&
                                          !currentTitle.includes('Verifying you are human');
                
                const hasContent = await page.evaluate(() => {
                    const bodyText = document.body ? document.body.innerText : '';
                    return bodyText.length > 500 && !bodyText.includes('Checking your browser');
                });
                
                if (hasPassedCloudflare && hasContent) {
                    console.log('✅ Successfully bypassed advanced Cloudflare!');
                    if (fullScraping) {
                        // המתנה נוספת לטעינת תוכן מלא
                        console.log('⏳ Waiting for full content load...');
                        await page.waitForTimeout(3000);
                    }
                    break;
                }
                
                // אם זה full scraping, נסה לזהות אלמנטים ספציפיים
                if (fullScraping) {
                    try {
                        // חפש סימנים של דף חלקים
                        const hasPartContent = await page.evaluate(() => {
                            return document.body.innerHTML.includes('part') || 
                                   document.body.innerHTML.includes('oem') ||
                                   document.querySelector('.part-search-tr') !== null ||
                                   document.querySelector('[data-title]') !== null;
                        });
                        
                        if (hasPartContent) {
                            console.log('✅ Part content detected! Cloudflare bypassed.');
                            break;
                        }
                    } catch (e) {}
                }
                
                // המתנה לפני הנסיון הבא
                if (i < maxAttempts - 1) {
                    await page.waitForTimeout(500);
                }
            }
        } else {
            console.log('✅ No Cloudflare detected or already bypassed');
            if (fullScraping) {
                // המתנה קצרה לטעינת תוכן
                await page.waitForTimeout(2000);
            }
        }
        
        // Final wait
        await page.waitForTimeout(fullScraping ? 1000 : 500);
        
        // Get results
        const finalUrl = page.url();
        const html = await page.content();
        const cookies = await page.cookies();
        const elapsed = Date.now() - startTime;
        
        console.log(`✅ ${fullScraping ? 'FULL SCRAPING' : 'URL EXTRACTION'} completed in ${elapsed}ms`);
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
            scrapingType: fullScraping ? 'full' : 'url_only'
        };
        
    } catch (error) {
        console.error('❌ Error during scraping:', error.message);
        return {
            success: false,
            error: error.message,
            url: url
        };
        
    } finally {
        if (page) {
            await page.close().catch(() => {});
            page = null;
        }
        if (browserObj) {
            releaseBrowser(browserObj);
        }
    }
}

// Memory cleanup function
async function memoryCleanup() {
    console.log('\n' + '='.repeat(50));
    console.log('🧹 Running memory cleanup...');
    
    const memBefore = process.memoryUsage();
    console.log(`📊 Memory before: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);
    
    if (global.gc) {
        global.gc();
    }
    
    const memAfter = process.memoryUsage();
    console.log(`📊 Memory after: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
    console.log(`💾 Saved: ${Math.round((memBefore.heapUsed - memAfter.heapUsed) / 1024 / 1024)}MB`);
    
    console.log(`🌐 Active browsers: ${browserPool.length}`);
    console.log(`⚡ Busy browsers: ${browserPool.filter(b => b.busy).length}`);
    console.log('='.repeat(50) + '\n');
}

// Main endpoint - תומך בשני מצבים
app.post('/v1', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { 
            cmd, 
            url, 
            maxTimeout = 30000, 
            session,
            fullScraping = false // ✅ פרמטר חדש לבחירת מצב
        } = req.body;
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📨 New Request at ${new Date().toISOString()}`);
        console.log(`🔗 URL: ${url.substring(0, 100)}...`);
        console.log(`⏱️ Timeout: ${maxTimeout}ms`);
        console.log(`🎯 Mode: ${fullScraping ? 'FULL SCRAPING' : 'URL EXTRACTION'}`);
        console.log(`${'='.repeat(60)}\n`);
        
        // Run scraping with timeout
        const result = await Promise.race([
            scrapeWithEnhancedBypass(url, fullScraping, maxTimeout),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), maxTimeout + 5000)
            )
        ]);
        
        if (result.success) {
            const elapsed = Date.now() - startTime;
            
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ SUCCESS - Total time: ${elapsed}ms`);
            console.log(`🔗 Final URL: ${result.url?.substring(0, 120) || 'N/A'}...`);
            console.log(`📄 HTML Length: ${result.html?.length || 0} bytes`);
            console.log(`🎯 Has ssd param: ${result.hasSSd ? 'YES ✅' : 'NO ❌'}`);
            console.log(`🚀 Scraping type: ${result.scrapingType}`);
            console.log(`${'='.repeat(60)}\n`);
            
            res.json({
                status: 'ok',
                message: 'Success',
                solution: {
                    url: result.url || url,
                    status: 200,
                    response: result.html,
                    cookies: result.cookies || [],
                    userAgent: 'Mozilla/5.0'
                },
                startTimestamp: startTime,
                endTimestamp: Date.now(),
                version: '4.2.0-enhanced-cloudflare-bypass',
                hasSSd: result.hasSSd || false,
                scrapingType: result.scrapingType
            });
        } else {
            throw new Error(result.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error(`\n${'='.repeat(60)}`);
        console.error('❌ REQUEST FAILED:', error.message);
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
        status: 'healthy',
        uptime: Math.round(process.uptime()) + 's',
        browsers: browserPool.length,
        activeBrowsers: browserPool.filter(b => b.busy).length,
        memory: {
            used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
            external: Math.round(memory.external / 1024 / 1024) + 'MB'
        },
        browserStats: Array.from(browserStats.entries()).map(([id, stats]) => ({
            id: id.toString().substring(-8),
            requests: stats.requests,
            age: Math.round((Date.now() - stats.created) / 1000) + 's'
        })),
        features: [
            'Enhanced Cloudflare bypass',
            'Full scraping support',
            'Memory optimization',
            'Browser recycling'
        ]
    });
});

// Root
app.get('/', (req, res) => {
    const memory = process.memoryUsage();
    res.send(`
        <h1>⚡ Enhanced Puppeteer Scraper v4.2</h1>
        <p><strong>Status:</strong> Running with Enhanced Cloudflare Bypass</p>
        <p><strong>Memory:</strong> ${Math.round(memory.heapUsed / 1024 / 1024)}MB used</p>
        <p><strong>Browsers:</strong> ${browserPool.length} (${browserPool.filter(b => b.busy).length} busy)</p>
        
        <h3>🎯 Modes Available:</h3>
        <ul>
            <li><strong>URL Extraction:</strong> Fast URL getting (~2s)</li>
            <li><strong>Full Scraping:</strong> Complete page scraping (~30s)</li>
        </ul>
        
        <h3>🚀 Features:</h3>
        <ul>
            <li>✅ Enhanced Cloudflare bypass</li>
            <li>✅ Memory optimization</li>
            <li>✅ Browser recycling</li>
            <li>✅ Supports both scraping modes</li>
        </ul>
        
        <h3>📖 Usage:</h3>
        <p><strong>URL Extraction:</strong><br>
        <code>{"cmd": "request.get", "url": "...", "fullScraping": false}</code></p>
        <p><strong>Full Scraping:</strong><br>
        <code>{"cmd": "request.get", "url": "...", "fullScraping": true, "maxTimeout": 60000}</code></p>
    `);
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔════════════════════════════════════════╗
║   ⚡ Enhanced Puppeteer v4.2           ║
║   Port: ${PORT}                            ║
║   Features: Dual-mode scraping        ║
║   Cloudflare: Enhanced bypass ✅       ║
╚════════════════════════════════════════╝
    `);
    
    console.log('🚀 Initializing enhanced browser pool...');
    await initBrowserPool();
    
    setInterval(memoryCleanup, 60000);
    console.log('✅ Ready with enhanced Cloudflare bypass!');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('📛 SIGTERM received, cleaning up...');
    for (const browserObj of browserPool) {
        await browserObj.browser.close().catch(() => {});
    }
    browserPool = [];
    browserStats.clear();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error.message);
    if (global.gc) global.gc();
});

process.on('unhandledRejection', (error) => {
    console.error('💥 Unhandled Rejection:', error.message);
});
