const express = require('express');
const puppeteer = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid detection
puppeteerExtra.use(StealthPlugin());

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

// Browser pool for better performance
const browserPool = [];
const MAX_BROWSERS = 3;
let currentBrowserIndex = 0;

// Optimized browser args
const BROWSER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=site-per-process',
    '--window-size=1920,1080',
    '--start-maximized',
    // Performance optimizations
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    // Memory optimizations
    '--max_old_space_size=4096',
    '--memory-pressure-off',
];

// Initialize browser pool
async function initBrowserPool() {
    console.log('🚀 Initializing browser pool...');
    for (let i = 0; i < MAX_BROWSERS; i++) {
        const browser = await puppeteerExtra.launch({
            headless: 'new',
            args: BROWSER_ARGS,
            ignoreDefaultArgs: ['--enable-automation'],
            // Increase protocol timeout for complex pages
            protocolTimeout: 30000,
        });
        browserPool.push(browser);
        console.log(`✅ Browser ${i + 1} initialized`);
    }
}

// Get next browser from pool (round-robin)
function getNextBrowser() {
    const browser = browserPool[currentBrowserIndex];
    currentBrowserIndex = (currentBrowserIndex + 1) % MAX_BROWSERS;
    return browser;
}

// Advanced scraping with Cloudflare bypass
async function scrapeWithBypass(url, options = {}) {
    const startTime = Date.now();
    const browser = getNextBrowser();
    let page = null;
    
    try {
        // Create page with optimal settings
        page = await browser.newPage();
        
        // Set viewport for better compatibility
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Advanced headers to look more real
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
        });
        
        // Override navigator properties to avoid detection
        await page.evaluateOnNewDocument(() => {
            // Override the navigator.webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Override navigator.plugins to look more real
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });
        
        console.log(`🔗 Navigating to: ${url}`);
        
        // Smart resource blocking - allow only what we need
        if (options.blockResources) {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                const url = req.url();
                
                // Block unnecessary resources but keep JS for dynamic content
                if (['image', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset'].includes(resourceType)) {
                    req.abort();
                } 
                // Block tracking and ads
                else if (url.includes('google-analytics') || url.includes('doubleclick') || url.includes('facebook')) {
                    req.abort();
                }
                else {
                    req.continue();
                }
            });
        }
        
        // Navigate with smart waiting
        const response = await page.goto(url, {
            waitUntil: options.waitUntil || 'networkidle0',
            timeout: options.timeout || 20000
        });
        
        // Wait for any redirects or dynamic content
        await page.waitForTimeout(1000);
        
        // Check for Cloudflare challenge
        const isCloudflareChallenge = await page.evaluate(() => {
            return document.title.includes('Just a moment') || 
                   document.querySelector('#cf-content') !== null ||
                   document.querySelector('.cf-browser-verification') !== null;
        });
        
        if (isCloudflareChallenge) {
            console.log('⚠️ Cloudflare challenge detected, waiting...');
            
            // Wait for Cloudflare to resolve (max 10 seconds)
            try {
                await page.waitForFunction(
                    () => !document.title.includes('Just a moment') && 
                         !document.querySelector('#cf-content') &&
                         !document.querySelector('.cf-browser-verification'),
                    { timeout: 10000 }
                );
                console.log('✅ Cloudflare challenge passed!');
            } catch (e) {
                console.log('⏱️ Cloudflare timeout, continuing anyway...');
            }
        }
        
        // Get final URL after all redirects
        const finalUrl = page.url();
        console.log(`📍 Final URL: ${finalUrl}`);
        
        // Get page content
        const content = await page.content();
        
        // Get cookies
        const cookies = await page.cookies();
        
        // Take screenshot if needed (optional)
        let screenshot = null;
        if (options.screenshot) {
            screenshot = await page.screenshot({ 
                encoding: 'base64',
                fullPage: false 
            });
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ Scraping completed in ${elapsed}ms`);
        
        return {
            success: true,
            url: finalUrl,
            originalUrl: url,
            content: content,
            cookies: cookies,
            screenshot: screenshot,
            elapsed: elapsed,
            statusCode: response?.status() || 200,
            headers: response?.headers() || {}
        };
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        
        // Try fallback with simpler approach
        if (options.fallback !== false) {
            console.log('🔄 Trying fallback approach...');
            return await fallbackScrape(url, browser);
        }
        
        throw error;
        
    } finally {
        if (page) {
            await page.close().catch(() => {});
        }
    }
}

// Fallback scraping method (simpler, faster)
async function fallbackScrape(url, browser) {
    const page = await browser.newPage();
    
    try {
        // Minimal setup for speed
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 10000
        });
        
        await page.waitForTimeout(1000);
        
        const finalUrl = page.url();
        const content = await page.content();
        
        return {
            success: true,
            url: finalUrl,
            content: content,
            fallback: true
        };
        
    } finally {
        await page.close().catch(() => {});
    }
}

// Main endpoint - compatible with FlareSolverr
app.post('/v1', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { cmd, url, maxTimeout = 20000, ...options } = req.body;
        
        if (cmd !== 'request.get') {
            return res.json({
                status: 'error',
                message: `Command ${cmd} not supported`
            });
        }
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }
        
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🚀 FULL SCRAPING REQUEST`);
        console.log(`📍 URL: ${url}`);
        console.log(`⏱️ Max timeout: ${maxTimeout}ms`);
        console.log(`${'='.repeat(50)}\n`);
        
        // Execute scraping
        const result = await scrapeWithBypass(url, {
            timeout: maxTimeout,
            blockResources: true,
            waitUntil: 'networkidle0',
            ...options
        });
        
        const totalTime = Date.now() - startTime;
        
        console.log(`\n✅ SUCCESS in ${totalTime}ms`);
        console.log(`📍 Final URL: ${result.url}`);
        console.log(`📄 Content size: ${result.content.length} bytes\n`);
        
        // Return FlareSolverr-compatible response
        res.json({
            status: 'ok',
            message: 'Success',
            solution: {
                url: result.url,
                status: result.statusCode,
                headers: result.headers,
                response: result.content,
                cookies: result.cookies,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            startTimestamp: startTime,
            endTimestamp: Date.now(),
            version: '1.0.0-ULTRA'
        });
        
    } catch (error) {
        console.error(`❌ Request failed: ${error.message}`);
        
        res.json({
            status: 'error',
            message: error.message,
            solution: null
        });
    }
});

// Quick URL check endpoint (for fast ssd parameter checking)
app.post('/quick', async (req, res) => {
    const { url } = req.body;
    const browser = getNextBrowser();
    const page = await browser.newPage();
    
    try {
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 5000
        });
        
        await page.waitForTimeout(1000);
        const finalUrl = page.url();
        
        res.json({
            success: true,
            url: finalUrl,
            hasSsd: finalUrl.includes('ssd=')
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    } finally {
        await page.close();
    }
});

// Health check
app.get('/health', async (req, res) => {
    res.json({
        status: 'healthy',
        browsers: browserPool.length,
        mode: 'FULL_SCRAPER',
        version: '1.0.0-ULTRA'
    });
});

// Stats endpoint
app.get('/stats', (req, res) => {
    res.json({
        browsers: browserPool.length,
        currentIndex: currentBrowserIndex,
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Root
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ultra Fast Full Scraper</title>
            <style>
                body { font-family: Arial; padding: 20px; background: #1a1a1a; color: #fff; }
                h1 { color: #4CAF50; }
                .feature { background: #2a2a2a; padding: 10px; margin: 5px 0; border-radius: 5px; }
                .endpoint { background: #333; padding: 10px; margin: 10px 0; border-radius: 5px; }
                code { background: #000; padding: 2px 5px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>⚡ Ultra Fast Full Scraper v1.0</h1>
            <p><strong>FlareSolverr Compatible + Faster!</strong></p>
            
            <h2>✨ Features:</h2>
            <div class="feature">✅ Full page scraping with JavaScript</div>
            <div class="feature">✅ Cloudflare bypass capabilities</div>
            <div class="feature">✅ Browser pool for performance</div>
            <div class="feature">✅ Stealth mode to avoid detection</div>
            <div class="feature">✅ Smart resource blocking</div>
            <div class="feature">✅ FlareSolverr API compatible</div>
            
            <h2>🔧 Endpoints:</h2>
            <div class="endpoint">
                <strong>POST /v1</strong> - Full scraping (FlareSolverr compatible)<br>
                <code>{"cmd": "request.get", "url": "https://example.com"}</code>
            </div>
            <div class="endpoint">
                <strong>POST /quick</strong> - Quick URL check<br>
                <code>{"url": "https://example.com"}</code>
            </div>
            <div class="endpoint">
                <strong>GET /health</strong> - Health check
            </div>
            <div class="endpoint">
                <strong>GET /stats</strong> - Statistics
            </div>
            
            <h2>📊 Performance:</h2>
            <p>Target: 8-15 seconds for full scrape (vs 20-30s FlareSolverr)</p>
            <p>Browsers: ${browserPool.length}/${MAX_BROWSERS}</p>
        </body>
        </html>
    `);
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔════════════════════════════════════════════╗
║   ⚡ ULTRA FAST FULL SCRAPER v1.0         ║
║   Port: ${PORT}                              ║
║   Mode: Full Scraping + Cloudflare Bypass ║
║   Browsers: ${MAX_BROWSERS}                              ║
║   Compatible: FlareSolverr API            ║
╚════════════════════════════════════════════╝
    `);
    
    console.log('🚀 Initializing browser pool...');
    await initBrowserPool();
    console.log('✅ Ready for FAST full scraping!');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔴 Shutting down...');
    for (const browser of browserPool) {
        await browser.close();
    }
    process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('💥 Unhandled Rejection:', error);
});
