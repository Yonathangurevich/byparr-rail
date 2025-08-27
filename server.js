const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;
const MAX_CONCURRENT_PAGES = 3;
const PAGE_TIMEOUT = 60000; // 60 שניות

// Cloud Run optimized browser arguments
const BROWSER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-pings',
    '--password-store=basic',
    '--use-mock-keychain',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=VizDisplayCompositor',
    '--memory-pressure-off',
    '--aggressive-cache-discard',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection'
];

// Global browser management
let globalBrowser = null;
let activePagesCount = 0;
let browserStartTime = Date.now();

// Create optimized browser instance
async function createBrowser() {
    try {
        console.log('🚀 Creating optimized browser for Cloud Run...');
        
        if (globalBrowser) {
            try {
                await globalBrowser.close();
                console.log('🧹 Previous browser closed');
            } catch (e) {
                console.log('⚠️ Error closing previous browser:', e.message);
            }
        }
        
        globalBrowser = await puppeteer.launch({
            headless: 'new',
            args: BROWSER_ARGS,
            ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
            defaultViewport: { width: 1366, height: 768 },
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false
        });
        
        // Browser event listeners
        globalBrowser.on('disconnected', () => {
            console.log('🔌 Browser disconnected, resetting...');
            globalBrowser = null;
            activePagesCount = 0;
        });

        browserStartTime = Date.now();
        activePagesCount = 0;
        
        console.log('✅ Browser created successfully');
        return globalBrowser;
        
    } catch (error) {
        console.error('❌ Failed to create browser:', error.message);
        globalBrowser = null;
        throw error;
    }
}

// Get or create browser
async function getBrowser() {
    const browserAge = Date.now() - browserStartTime;
    
    // Recreate browser if old or missing
    if (!globalBrowser || browserAge > 600000) { // 10 minutes max age
        console.log('🔄 Browser needs refresh (age:', Math.round(browserAge/1000), 'seconds)');
        await createBrowser();
    }
    
    return globalBrowser;
}

// Enhanced URL scraping function
async function scrapeUrl(url, options = {}) {
    const startTime = Date.now();
    let page = null;
    let context = null;
    const requestId = Math.random().toString(36).substring(2, 8);
    
    // Check concurrent pages limit
    if (activePagesCount >= MAX_CONCURRENT_PAGES) {
        throw new Error(`Too many concurrent requests. Active: ${activePagesCount}/${MAX_CONCURRENT_PAGES}`);
    }
    
    try {
        activePagesCount++;
        console.log(`[${requestId}] 🔗 Starting (${activePagesCount}/${MAX_CONCURRENT_PAGES}): ${url.substring(0, 50)}...`);
        
        const browser = await getBrowser();
        
        // Create isolated context
        context = await browser.createIncognitoBrowserContext();
        page = await context.newPage();
        
        // Optimize page settings
        await page.setCacheEnabled(false);
        await page.setViewport({ width: 1366, height: 768 });
        
        // Block heavy resources to save memory
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const resourceType = request.resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        // Set realistic user agent
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        
        // Set headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });
        
        // Anti-detection measures
        await page.evaluateOnNewDocument(() => {
            // Hide webdriver
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            
            // Mock chrome object
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
            
            // Mock plugins
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });
        
        console.log(`[${requestId}] 🌐 Navigating to target...`);
        
        // Navigate with timeout
        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: options.timeout || PAGE_TIMEOUT
        });
        
        // Check for Cloudflare challenge
        const title = await page.title();
        console.log(`[${requestId}] 📄 Page loaded: "${title.substring(0, 40)}..."`);
        
        if (title.includes('Just a moment') || title.includes('Checking your browser')) {
            console.log(`[${requestId}] ☁️ Cloudflare detected, waiting for bypass...`);
            
            let attempts = 0;
            const maxAttempts = 15;
            
            while (attempts < maxAttempts) {
                await page.waitForTimeout(2000);
                
                const currentTitle = await page.title();
                const currentUrl = page.url();
                
                console.log(`[${requestId}] ⏳ Cloudflare check ${attempts + 1}/${maxAttempts}`);
                
                // Check if Cloudflare passed
                if (!currentTitle.includes('Just a moment') && 
                    !currentTitle.includes('Checking your browser')) {
                    console.log(`[${requestId}] ✅ Cloudflare bypassed successfully!`);
                    break;
                }
                
                // Check for success indicators
                if (currentUrl.includes('ssd=') || currentUrl !== url) {
                    console.log(`[${requestId}] ✅ URL changed - Cloudflare likely passed`);
                    break;
                }
                
                attempts++;
                
                // Try interaction at halfway point
                if (attempts === Math.floor(maxAttempts / 2)) {
                    try {
                        await page.mouse.click(100, 100);
                        console.log(`[${requestId}] 🖱️ Attempted page interaction`);
                    } catch (e) {
                        console.log(`[${requestId}] ⚠️ Click interaction failed: ${e.message}`);
                    }
                }
            }
            
            if (attempts >= maxAttempts) {
                console.log(`[${requestId}] ⚠️ Cloudflare timeout, proceeding with current state`);
            }
            
            // Additional stabilization wait
            await page.waitForTimeout(1000);
        }
        
        // Get final results
        const finalUrl = page.url();
        const html = await page.content();
        const cookies = await page.cookies();
        
        const elapsed = Date.now() - startTime;
        console.log(`[${requestId}] ✅ Scraping completed successfully in ${elapsed}ms`);
        
        return {
            success: true,
            html,
            url: finalUrl,
            cookies,
            hasSSd: finalUrl.includes('ssd='),
            elapsed,
            requestId
        };
        
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[${requestId}] ❌ Scraping failed after ${elapsed}ms:`, error.message);
        
        return {
            success: false,
            error: error.message,
            url,
            elapsed,
            requestId
        };
        
    } finally {
        // Always decrement counter
        activePagesCount = Math.max(0, activePagesCount - 1);
        
        // Clean up context
        if (context) {
            try {
                await context.close();
                console.log(`[${requestId}] 🧹 Context cleaned (${activePagesCount} remaining active)`);
            } catch (e) {
                console.log(`[${requestId}] ⚠️ Context cleanup warning: ${e.message}`);
            }
        }
    }
}

// Main scraping endpoint
app.post('/v1', async (req, res) => {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    const startTime = Date.now();
    
    try {
        const { url, maxTimeout = PAGE_TIMEOUT } = req.body;
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL parameter is required',
                requestId
            });
        }
        
        // Validate URL format
        try {
            new URL(url);
        } catch (urlError) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid URL format provided',
                requestId
            });
        }
        
        console.log(`\n📨 [${requestId}] New scraping request: ${url.substring(0, 60)}...`);
        
        // Execute scraping
        const result = await scrapeUrl(url, { timeout: maxTimeout });
        
        if (result.success) {
            const totalElapsed = Date.now() - startTime;
            console.log(`✅ [${requestId}] Request completed successfully in ${totalElapsed}ms`);
            
            res.json({
                status: 'ok',
                message: 'Scraping completed successfully',
                solution: {
                    url: result.url,
                    status: 200,
                    response: result.html,
                    cookies: result.cookies || [],
                    userAgent: 'Mozilla/5.0 (Cloud Run Optimized Puppeteer)'
                },
                startTimestamp: startTime,
                endTimestamp: Date.now(),
                version: '6.0.0-cloudrun-final',
                hasSSd: result.hasSSd || false,
                requestId,
                elapsed: totalElapsed
            });
        } else {
            throw new Error(result.error || 'Unknown scraping error occurred');
        }
        
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`❌ [${requestId}] Request failed after ${elapsed}ms:`, error.message);
        
        res.status(500).json({
            status: 'error',
            message: error.message,
            solution: null,
            requestId,
            elapsed,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    const memory = process.memoryUsage();
    const uptime = process.uptime();
    
    let browserInfo = {
        active: false,
        ageSeconds: 0,
        error: null
    };
    
    try {
        if (globalBrowser) {
            const pages = await globalBrowser.pages();
            browserInfo = {
                active: true,
                ageSeconds: Math.round((Date.now() - browserStartTime) / 1000),
                pagesCount: pages.length,
                activePagesCount
            };
        }
    } catch (error) {
        browserInfo.error = error.message;
        browserInfo.active = false;
    }
    
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.round(uptime) + 's',
        browser: browserInfo,
        memory: {
            used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
            external: Math.round(memory.external / 1024 / 1024) + 'MB'
        },
        limits: {
            maxConcurrentPages: MAX_CONCURRENT_PAGES,
            pageTimeout: PAGE_TIMEOUT + 'ms'
        },
        version: '6.0.0-cloudrun-final'
    };
    
    res.json(healthData);
});

// Service info endpoint
app.get('/', (req, res) => {
    const memory = process.memoryUsage();
    const browserStatus = globalBrowser ? 
        `Active (${Math.round((Date.now() - browserStartTime)/1000)}s old)` : 
        'Inactive';
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cloud Run Puppeteer Scraper</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0; }
                .endpoints { background: #f0f8ff; padding: 15px; border-radius: 5px; }
                h1 { color: #1a73e8; margin: 0 0 20px 0; }
                .metric { display: inline-block; margin: 10px 20px 10px 0; }
                code { background: #f1f3f4; padding: 2px 8px; border-radius: 3px; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 Cloud Run Puppeteer Scraper v6.0</h1>
                
                <div class="status">
                    <h3>📊 Current Status</h3>
                    <div class="metric"><strong>Service:</strong> Running</div>
                    <div class="metric"><strong>Browser:</strong> ${browserStatus}</div>
                    <div class="metric"><strong>Active Pages:</strong> ${activePagesCount}/${MAX_CONCURRENT_PAGES}</div>
                    <div class="metric"><strong>Memory Usage:</strong> ${Math.round(memory.rss/1024/1024)}MB</div>
                    <div class="metric"><strong>Uptime:</strong> ${Math.round(process.uptime())}s</div>
                </div>
                
                <div class="endpoints">
                    <h3>🔗 Available Endpoints</h3>
                    <p><code>POST /v1</code> - Main scraping endpoint</p>
                    <p><code>GET /health</code> - Health check with detailed metrics</p>
                    <p><code>GET /</code> - This service information page</p>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 5px;">
                    <h4>💡 Usage Example:</h4>
                    <code>
                        curl -X POST ${req.protocol}://${req.get('host')}/v1 \\<br>
                        &nbsp;&nbsp;-H "Content-Type: application/json" \\<br>
                        &nbsp;&nbsp;-d '{"url": "https://example.com"}'
                    </code>
                </div>
                
                <div style="margin-top: 20px; color: #666; font-size: 12px;">
                    <p>Optimized for Google Cloud Run • Auto-scaling • Cloudflare bypass • Resource efficient</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 ${signal} signal received, initiating graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
        console.log('📭 HTTP server closed to new requests');
    });
    
    // Close browser if active
    if (globalBrowser) {
        try {
            await globalBrowser.close();
            console.log('🌐 Browser instance closed successfully');
        } catch (error) {
            console.error('❌ Error closing browser:', error.message);
        }
    }
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
};

// Start the server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Cloud Run Puppeteer Scraper v6.0 READY!            ║
║                                                            ║
║   📡 Port: ${PORT}                                           ║
║   🌐 Environment: ${process.env.NODE_ENV || 'production'}                              ║
║   🧠 Max Concurrent Pages: ${MAX_CONCURRENT_PAGES}                              ║
║   ⏱️  Page Timeout: ${PAGE_TIMEOUT/1000} seconds                               ║
║   🔧 Optimized for Google Cloud Run                       ║
║                                                            ║
║   Ready to handle production traffic! 🎯                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

// Signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global error handlers
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Promise Rejection:', reason);
    console.error('Promise:', promise);
});
