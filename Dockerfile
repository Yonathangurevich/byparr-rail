const express = require('express');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

// Add stealth plugin to playwright
chromium.use(stealth);

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

// Browser management
let browserPool = [];
const MAX_BROWSERS = 1;
const MAX_PAGES_PER_BROWSER = 50;

console.log('🎭 Initializing Playwright + Stealth Plugin...');

// ✅ Browser launch options optimized for Cloudflare bypass
const PLAYWRIGHT_LAUNCH_OPTIONS = {
    headless: false, // Try headful first, fallback to headless
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--memory-pressure-off',
        '--max_old_space_size=1024'
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    env: {
        ...process.env,
        DISPLAY: ':99'
    }
};

// Browser creation with fallback
async function createPlaywrightBrowser() {
    try {
        console.log('🎭 Creating Playwright browser with stealth...');
        
        // Try headful first
        const browser = await chromium.launch(PLAYWRIGHT_LAUNCH_OPTIONS);
        
        console.log('✅ Playwright browser (headful) created successfully!');
        
        return {
            browser,
            busy: false,
            id: Date.now() + Math.random(),
            pages: 0,
            created: Date.now(),
            isHeadless: false
        };
        
    } catch (error) {
        console.log('⚠️ Headful failed, trying headless...', error.message);
        
        try {
            // Fallback to headless
            const headlessOptions = {
                ...PLAYWRIGHT_LAUNCH_OPTIONS,
                headless: true,
                args: PLAYWRIGHT_LAUNCH_OPTIONS.args.filter(arg => 
                    !arg.includes('start-maximized') && !arg.includes('window-size')
                )
            };
            
            const browser = await chromium.launch(headlessOptions);
            console.log('✅ Playwright browser (headless fallback) created!');
            
            return {
                browser,
                busy: false,
                id: Date.now() + Math.random(),
                pages: 0,
                created: Date.now(),
                isHeadless: true
            };
            
        } catch (fallbackError) {
            console.error('❌ Both headful and headless failed:', fallbackError.message);
            return null;
        }
    }
}

async function initBrowserPool() {
    console.log('🚀 Initializing Playwright browser pool...');
    
    // Setup XVFB virtual display for headful mode
    try {
        const { spawn } = require('child_process');
        const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1920x1080x24'], {
            detached: true,
            stdio: 'ignore'
        });
        process.env.DISPLAY = ':99';
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('🖥️ Virtual display ready');
    } catch (xvfbError) {
        console.log('⚠️ XVFB setup failed, headless will be used:', xvfbError.message);
    }
    
    const browserObj = await createPlaywrightBrowser();
    if (browserObj) {
        browserPool.push(browserObj);
        console.log(`✅ Playwright Browser ready (${browserObj.isHeadless ? 'headless' : 'headful'})`);
    }
}

async function getBrowser() {
    let browserObj = browserPool.find(b => !b.busy);
    
    if (!browserObj) {
        console.log('⏳ All browsers busy, waiting...');
        for (let i = 0; i < 100; i++) {
            await new Promise(resolve => setTimeout(resolve, 200));
            browserObj = browserPool.find(b => !b.busy);
            if (browserObj) break;
        }
    }
    
    if (!browserObj) {
        throw new Error('No browsers available');
    }
    
    // Recycle browser if used too much
    if (browserObj.pages >= MAX_PAGES_PER_BROWSER) {
        console.log(`🔄 Browser reached page limit, recycling...`);
        await recycleBrowser(browserObj);
    }
    
    browserObj.busy = true;
    browserObj.pages++;
    
    return browserObj;
}

async function recycleBrowser(browserObj) {
    try {
        await browserObj.browser.close();
        const newBrowserObj = await createPlaywrightBrowser();
        if (newBrowserObj) {
            const index = browserPool.indexOf(browserObj);
            browserPool[index] = newBrowserObj;
            console.log('✅ Browser recycled with fresh session');
        }
    } catch (error) {
        console.error('❌ Browser recycle error:', error.message);
    }
}

function releaseBrowser(browserObj) {
    if (browserObj) {
        browserObj.busy = false;
        console.log(`📤 Playwright browser released (${browserObj.pages} pages used)`);
    }
}

// ✅ Advanced Playwright page setup
async function setupPlaywrightPage(context) {
    console.log('🎭 Setting up Playwright page with stealth...');
    
    const page = await context.newPage();
    
    // ✅ Enhanced viewport and user agent
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    ];
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(randomUA);
    
    // ✅ Enhanced headers
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
        'Cache-Control': 'no-cache'
    });
    
    // ✅ Additional stealth measures
    await page.addInitScript(() => {
        // Remove webdriver traces
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // Add realistic properties
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        
        // Chrome object
        window.chrome = {
            runtime: {},
            loadTimes: function() { return {}; },
            csi: function() { return {}; }
        };
    });
    
    console.log('✅ Playwright page setup complete with stealth');
    return page;
}

// ✅ Playwright Cloudflare bypass
async function playwrightCloudflareBypass(page, maxWaitTime = 120000) {
    console.log('🎭 Playwright Cloudflare bypass starting...');
    
    const startTime = Date.now();
    let attempt = 0;
    
    while ((Date.now() - startTime) < maxWaitTime) {
        attempt++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        console.log(`🎭 Playwright attempt ${attempt} - ${elapsed}s`);
        
        try {
            const title = await page.title();
            const url = page.url();
            
            console.log(`📍 Title: "${title.substring(0, 50)}..."`);
            
            const cloudflareActive = title.includes('Just a moment') ||
                                   title.includes('Checking your browser') ||
                                   title.includes('Verifying you are human');
            
            if (!cloudflareActive || url.includes('ssd=')) {
                const hasContent = await page.evaluate(() => {
                    const bodyText = document.body?.innerText || '';
                    return bodyText.length > 800 && !bodyText.includes('Just a moment');
                });
                
                if (hasContent || url.includes('ssd=')) {
                    console.log(`🎭 Playwright SUCCESS after ${elapsed}s!`);
                    return true;
                }
            }
            
            if (cloudflareActive) {
                console.log('☁️ Cloudflare detected, using Playwright techniques...');
                
                // Human-like interactions
                if (attempt <= 3) {
                    await page.mouse.move(500 + Math.random() * 400, 300 + Math.random() * 300);
                    await page.waitForTimeout(500);
                    
                    // Look for iframes and interact
                    const iframes = page.frames();
                    if (iframes.length > 1) {
                        console.log(`🔍 Found ${iframes.length} frames`);
                        for (const frame of iframes.slice(1, 3)) {
                            try {
                                await frame.click('body', { timeout: 1000 });
                                await page.waitForTimeout(1000);
                            } catch (e) {}
                        }
                    }
                    
                    // Click on page
                    await page.mouse.click(683, 384);
                    await page.waitForTimeout(1000);
                }
                
                // Progressive waiting
                const waitTime = Math.min(8000 + (attempt * 3000), 20000);
                console.log(`⏳ Playwright wait: ${Math.round(waitTime/1000)}s`);
                
                // Wait with checks
                const chunks = Math.ceil(waitTime / 2000);
                for (let i = 0; i < chunks; i++) {
                    await page.waitForTimeout(2000);
                    
                    const intermediateTitle = await page.title();
                    if (!intermediateTitle.includes('Just a moment') || page.url().includes('ssd=')) {
                        console.log('🚀 Status changed during wait!');
                        break;
                    }
                }
            }
            
        } catch (error) {
            console.log(`⚠️ Attempt error: ${error.message}`);
        }
    }
    
    console.log(`⏰ Playwright bypass completed after ${Math.round((Date.now() - startTime) / 1000)}s`);
    return false;
}

// Main scraping function
async function scrapeWithPlaywright(url, fullScraping = false, maxWaitTime = 180000) {
    const startTime = Date.now();
    let browserObj = null;
    let context = null;
    let page = null;
    
    try {
        console.log(`🎭 Starting Playwright ${fullScraping ? 'FULL SCRAPING' : 'URL EXTRACTION'}`);
        console.log(`🔗 Target: ${url.substring(0, 100)}...`);
        
        browserObj = await getBrowser();
        
        // Create context with stealth
        context = await browserObj.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'America/New_York',
            permissions: ['geolocation'],
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        page = await setupPlaywrightPage(context);
        
        console.log('🚀 Navigating with Playwright...');
        
        // Navigate
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        
        // Initial wait
        console.log('⏳ Initial stabilization...');
        await page.waitForTimeout(4000);
        
        // Cloudflare bypass
        const bypassSuccess = await playwrightCloudflareBypass(page, maxWaitTime - 20000);
        
        // Final wait
        if (fullScraping) {
            console.log('⏳ Final wait for complete content...');
            await page.waitForTimeout(6000);
        } else {
            await page.waitForTimeout(3000);
        }
        
        // Collect results
        const finalUrl = page.url();
        const html = await page.content();
        const cookies = await context.cookies();
        const elapsed = Date.now() - startTime;
        
        console.log(`🎭 Playwright completed in ${elapsed}ms`);
        console.log(`🔗 Final URL: ${finalUrl.substring(0, 100)}...`);
        console.log(`📄 Content: ${html.length} bytes`);
        console.log(`🎯 Has ssd param: ${finalUrl.includes('ssd=') ? 'YES ✅' : 'NO ❌'}`);
        
        if (fullScraping) {
            const hasPartsContent = html.includes('part-search') || 
                                  html.includes('data-codeonimage') || 
                                  html.includes('oem');
            console.log(`🔧 Parts content: ${hasPartsContent ? 'YES ✅' : 'NO ❌'}`);
        }
        
        return {
            success: true,
            html: html,
            url: finalUrl,
            cookies: cookies,
            hasSSd: finalUrl.includes('ssd='),
            elapsed: elapsed,
            scrapingType: fullScraping ? 'playwright_full' : 'playwright_url',
            bypassSuccess: bypassSuccess
        };
        
    } catch (error) {
        console.error('🎭 Playwright scraping error:', error.message);
        return {
            success: false,
            error: error.message,
            url: url
        };
        
    } finally {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browserObj) releaseBrowser(browserObj);
    }
}

// Memory cleanup
async function playwrightMemoryCleanup() {
    console.log('\n' + '🎭'.repeat(20));
    console.log('🧹 Playwright memory cleanup...');
    
    const memBefore = process.memoryUsage();
    console.log(`📊 Memory before: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB`);
    
    if (global.gc) global.gc();
    
    const memAfter = process.memoryUsage();
    console.log(`📊 Memory after: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
    console.log(`💾 Freed: ${Math.round((memBefore.heapUsed - memAfter.heapUsed) / 1024 / 1024)}MB`);
    console.log(`🌐 Active browsers: ${browserPool.length}`);
    console.log('🎭'.repeat(20) + '\n');
}

// Main endpoint
app.post('/v1', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { 
            cmd, 
            url, 
            maxTimeout = 180000, // 3 minutes default
            session,
            fullScraping = false
        } = req.body;
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }
        
        console.log(`\n${'🎭'.repeat(25)}`);
        console.log(`🎭 Playwright Request at ${new Date().toISOString()}`);
        console.log(`🔗 URL: ${url.substring(0, 100)}...`);
        console.log(`⏱️ Timeout: ${maxTimeout}ms`);
        console.log(`🎯 Mode: ${fullScraping ? 'PLAYWRIGHT FULL' : 'PLAYWRIGHT URL'}`);
        console.log(`${'🎭'.repeat(25)}\n`);
        
        const result = await Promise.race([
            scrapeWithPlaywright(url, fullScraping, maxTimeout),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Playwright Timeout')), maxTimeout + 20000)
            )
        ]);
        
        if (result.success) {
            const elapsed = Date.now() - startTime;
            
            console.log(`\n${'🎭'.repeat(25)}`);
            console.log(`🎭 PLAYWRIGHT SUCCESS - Total: ${elapsed}ms`);
            console.log(`🔗 Final URL: ${result.url?.substring(0, 120)}...`);
            console.log(`📄 HTML: ${result.html?.length || 0} bytes`);
            console.log(`🎯 Has ssd: ${result.hasSSd ? 'YES ✅' : 'NO ❌'}`);
            console.log(`${'🎭'.repeat(25)}\n`);
            
            res.json({
                status: 'ok',
                message: 'Playwright Success',
                solution: {
                    url: result.url || url,
                    status: 200,
                    response: result.html,
                    cookies: result.cookies || [],
                    userAgent: 'Mozilla/5.0'
                },
                startTimestamp: startTime,
                endTimestamp: Date.now(),
                version: '7.0.0-PLAYWRIGHT-STEALTH-EDITION',
                hasSSd: result.hasSSd || false,
                scrapingType: result.scrapingType,
                bypassSuccess: result.bypassSuccess
            });
        } else {
            throw new Error(result.error || 'Playwright error');
        }
        
    } catch (error) {
        console.error(`🎭 PLAYWRIGHT REQUEST FAILED:`, error.message);
        
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
        status: 'playwright-stealth-ready',
        uptime: Math.round(process.uptime()) + 's',
        browsers: browserPool.length,
        activeBrowsers: browserPool.filter(b => b.busy).length,
        browserMode: browserPool.length > 0 ? (browserPool[0].isHeadless ? 'headless' : 'headful') : 'unknown',
        memory: {
            used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
        },
        features: [
            '🎭 Playwright + Stealth Plugin',
            '🖥️ Headful mode with XVFB fallback',
            '⚡ WebSocket connection (faster)',
            '🔧 Advanced anti-detection',
            '🍪 Smart context management',
            '⏰ Patient bypass strategy'
        ]
    });
});

// Root page
app.get('/', (req, res) => {
    const memory = process.memoryUsage();
    const browserMode = browserPool.length > 0 ? (browserPool[0].isHeadless ? 'Headless' : 'Headful') : 'Unknown';
    
    res.send(`
        <h1>🎭 Playwright Stealth Edition v7.0</h1>
        <p><strong>Status:</strong> Armed with Microsoft's finest + Stealth</p>
        <p><strong>Browser Mode:</strong> ${browserMode}</p>
        <p><strong>Memory:</strong> ${Math.round(memory.heapUsed / 1024 / 1024)}MB</p>
        
        <h3>🎭 Playwright Advantages:</h3>
        <ul>
            <li>✅ WebSocket connection (faster than HTTP)</li>
            <li>✅ Microsoft backing & active development</li>
            <li>✅ Built-in stealth capabilities</li>
            <li>✅ Better performance than Puppeteer</li>
            <li>✅ Advanced context management</li>
            <li>✅ Automatic waiting & retries</li>
            <li>✅ Cross-browser support</li>
        </ul>
        
        <h3>🚀 Why Playwright Beats Puppeteer:</h3>
        <ul>
            <li>📡 WebSocket vs HTTP communication</li>
            <li>⚡ Faster navigation & interaction</li>
            <li>🛡️ Better stealth out of the box</li>
            <li>🔧 More advanced debugging tools</li>
            <li>🎯 Built-in wait strategies</li>
        </ul>
        
        <h3>📖 Usage:</h3>
        <p><strong>URL Mode:</strong> <code>{"fullScraping": false}</code></p>
        <p><strong>Full Mode:</strong> <code>{"fullScraping": true, "maxTimeout": 240000}</code></p>
    `);
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║       🎭 PLAYWRIGHT STEALTH EDITION v7.0     ║
║         Microsoft Power + Stealth Plugin     ║
║              Port: ${PORT}                       ║
║        Better than Puppeteer & Selenium      ║
║           WebSocket > HTTP Requests           ║
╚═══════════════════════════════════════════════╝
    `);
    
    console.log('🎭 Loading Playwright stealth arsenal...');
    await initBrowserPool();
    
    setInterval(playwrightMemoryCleanup, 60000);
    console.log('🚀 PLAYWRIGHT STEALTH READY FOR CLOUDFLARE DESTRUCTION!');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🎭 Playwright shutdown sequence...');
    for (const browserObj of browserPool) {
        await browserObj.browser.close().catch(() => {});
    }
    browserPool = [];
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('🎭 Playwright Exception:', error.message);
    if (global.gc) global.gc();
});

process.on('unhandledRejection', (error) => {
    console.error('🎭 Playwright Rejection:', error.message);
});
