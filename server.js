// server.js - Enhanced Scraper with Multiple Strategies
const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');

// Configure stealth plugin with all evasions
const stealth = StealthPlugin();
stealth.enabledEvasions.delete('chrome.runtime'); // Can cause issues in some cases
puppeteer.use(stealth);

// Add recaptcha solver (optional - requires 2captcha API key)
puppeteer.use(RecaptchaPlugin({
    provider: { id: '2captcha', token: process.env.CAPTCHA_KEY || '' },
    visualFeedback: true
}));

// Block ads and trackers for faster loading
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

// ====== CONFIGURATION ======
const CONFIG = {
    // Browser settings optimized for Railway
    BROWSER_ARGS: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--deterministic-fetch',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        
        // Anti-detection
        '--disable-blink-features=AutomationControlled',
        '--disable-features=site-per-process',
        '--window-size=1920,1080',
        
        // Performance
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-breakpad',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-sync',
        
        // Memory optimization for Railway
        '--max_old_space_size=460',
        '--memory-pressure-off',
        '--js-flags=--max-old-space-size=460',
        
        // Network
        '--aggressive-cache-discard',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
    ],
    
    // Cloudflare bypass strategies
    CLOUDFLARE_SELECTORS: [
        'div.cf-browser-verification',
        '#cf-content',
        'div[class*="cf-"]',
        'form[id="challenge-form"]',
        'input[name="cf_captcha_kind"]',
        'div[class*="challenge"]',
        'div.main-wrapper div.main-content',
        'h1 span[data-translate="checking_browser"]'
    ],
    
    // User agents that work well with Cloudflare
    USER_AGENTS: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
};

// ====== BROWSER POOL ======
class BrowserPool {
    constructor(size = 2) { // Limited to 2 for Railway memory constraints
        this.browsers = [];
        this.size = size;
        this.currentIndex = 0;
        this.isInitialized = false;
    }
    
    async init() {
        if (this.isInitialized) return;
        
        console.log('🚀 Initializing browser pool...');
        for (let i = 0; i < this.size; i++) {
            try {
                const browser = await this.createBrowser();
                this.browsers.push(browser);
                console.log(`✅ Browser ${i + 1} initialized`);
            } catch (error) {
                console.error(`❌ Failed to initialize browser ${i + 1}:`, error.message);
            }
        }
        this.isInitialized = true;
    }
    
    async createBrowser() {
        return await puppeteer.launch({
            headless: 'new',
            args: CONFIG.BROWSER_ARGS,
            ignoreDefaultArgs: ['--enable-automation'],
            defaultViewport: { width: 1920, height: 1080 },
            protocolTimeout: 30000,
            ignoreHTTPSErrors: true
        });
    }
    
    async getBrowser() {
        if (!this.isInitialized) await this.init();
        
        if (this.browsers.length === 0) {
            throw new Error('No browsers available');
        }
        
        const browser = this.browsers[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.browsers.length;
        
        // Check if browser is still connected
        if (!browser.isConnected()) {
            console.log('🔄 Recreating disconnected browser...');
            const newBrowser = await this.createBrowser();
            this.browsers[this.currentIndex] = newBrowser;
            return newBrowser;
        }
        
        return browser;
    }
    
    async cleanup() {
        for (const browser of this.browsers) {
            try {
                await browser.close();
            } catch (e) {
                // Ignore errors during cleanup
            }
        }
        this.browsers = [];
        this.isInitialized = false;
    }
}

const browserPool = new BrowserPool(2);

// ====== CLOUDFLARE BYPASS ======
class CloudflareBypass {
    static async detectAndBypass(page, timeout = 15000) {
        const startTime = Date.now();
        
        try {
            // Check if Cloudflare challenge is present
            const hasChallenge = await this.detectChallenge(page);
            
            if (!hasChallenge) {
                console.log('✅ No Cloudflare challenge detected');
                return true;
            }
            
            console.log('⚠️ Cloudflare challenge detected, attempting bypass...');
            
            // Strategy 1: Wait for automatic resolution
            const autoResolved = await this.waitForAutoResolve(page, timeout);
            if (autoResolved) {
                console.log('✅ Cloudflare challenge auto-resolved');
                return true;
            }
            
            // Strategy 2: Trigger manual interactions
            const manualResolved = await this.tryManualBypass(page);
            if (manualResolved) {
                console.log('✅ Cloudflare challenge manually resolved');
                return true;
            }
            
            // Strategy 3: Reload and retry
            console.log('🔄 Reloading page...');
            await page.reload({ waitUntil: 'networkidle0', timeout: 10000 });
            
            const hasChallenge2 = await this.detectChallenge(page);
            if (!hasChallenge2) {
                console.log('✅ Cloudflare challenge resolved after reload');
                return true;
            }
            
        } catch (error) {
            console.error('❌ Cloudflare bypass error:', error.message);
        }
        
        const elapsed = Date.now() - startTime;
        console.log(`⏱️ Cloudflare bypass attempt took ${elapsed}ms`);
        return false;
    }
    
    static async detectChallenge(page) {
        try {
            // Check page title
            const title = await page.title();
            if (title.includes('Just a moment') || title.includes('Checking your browser')) {
                return true;
            }
            
            // Check for challenge elements
            for (const selector of CONFIG.CLOUDFLARE_SELECTORS) {
                const element = await page.$(selector);
                if (element) return true;
            }
            
            // Check page content
            const content = await page.content();
            if (content.includes('cf-browser-verification') || 
                content.includes('cf_chl_prog') ||
                content.includes('cf-challenge')) {
                return true;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }
    
    static async waitForAutoResolve(page, timeout) {
        try {
            await page.waitForFunction(
                () => {
                    const title = document.title;
                    return !title.includes('Just a moment') && 
                           !title.includes('Checking your browser') &&
                           !document.querySelector('#cf-content') &&
                           !document.querySelector('.cf-browser-verification');
                },
                { timeout: timeout }
            );
            return true;
        } catch (error) {
            return false;
        }
    }
    
    static async tryManualBypass(page) {
        try {
            // Try to find and click any challenge button
            const buttons = await page.$$('button, input[type="submit"]');
            for (const button of buttons) {
                const text = await page.evaluate(el => el.textContent, button);
                if (text && (text.includes('Verify') || text.includes('Continue'))) {
                    await button.click();
                    await page.waitForTimeout(3000);
                    return !(await this.detectChallenge(page));
                }
            }
            
            // Try mouse movement and clicks (sometimes helps)
            await page.mouse.move(100, 100);
            await page.mouse.move(200, 200);
            await page.mouse.click(500, 300);
            
            return false;
        } catch (error) {
            return false;
        }
    }
}

// ====== MAIN SCRAPING FUNCTION ======
async function scrapeWithStrategies(url, options = {}) {
    const browser = await browserPool.getBrowser();
    let page = null;
    
    try {
        page = await browser.newPage();
        
        // Set random user agent
        const userAgent = CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
        await page.setUserAgent(userAgent);
        
        // Set realistic viewport
        await page.setViewport({ 
            width: 1920, 
            height: 1080,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: true,
            isMobile: false
        });
        
        // Override navigator properties for better stealth
        await page.evaluateOnNewDocument(() => {
            // Override webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // Override chrome
            window.chrome = {
                runtime: {},
            };
            
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        });
        
        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });
        
        // Enable request interception for optimization
        if (options.blockResources !== false) {
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                
                // Block unnecessary resources
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else if (req.url().includes('google-analytics') || 
                          req.url().includes('doubleclick') || 
                          req.url().includes('facebook')) {
                    req.abort();
                } else {
                    req.continue();
                }
            });
        }
        
        console.log(`📍 Navigating to: ${url}`);
        
        // Navigate with multiple strategies
        let response;
        try {
            response = await page.goto(url, {
                waitUntil: options.waitUntil || 'networkidle2',
                timeout: options.timeout || 30000
            });
        } catch (navError) {
            console.log('⚠️ Initial navigation failed, trying domcontentloaded...');
            response = await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });
        }
        
        // Check and bypass Cloudflare if needed
        await CloudflareBypass.detectAndBypass(page, 15000);
        
        // Additional wait for dynamic content
        await page.waitForTimeout(2000);
        
        // For PartsOuq specific handling
        if (url.includes('partsouq.com')) {
            console.log('🔧 Applying PartsOuq specific handling...');
            
            // Wait for specific elements
            try {
                await page.waitForSelector('a[href*="/catalog/genuine/"]', { timeout: 5000 });
            } catch (e) {
                console.log('⚠️ Catalog link not found immediately');
            }
            
            // Scroll to trigger lazy loading
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight / 2);
            });
            await page.waitForTimeout(1000);
        }
        
        // Get final content
        const content = await page.content();
        const finalUrl = page.url();
        const cookies = await page.cookies();
        
        // Extract any SSD parameter if present
        let ssdParam = null;
        const urlObj = new URL(finalUrl);
        if (urlObj.searchParams.has('ssd')) {
            ssdParam = urlObj.searchParams.get('ssd');
            console.log(`🔑 Found SSD parameter: ${ssdParam.substring(0, 50)}...`);
        }
        
        console.log(`✅ Scraping completed successfully`);
        console.log(`📊 Content size: ${content.length} bytes`);
        
        return {
            success: true,
            url: finalUrl,
            originalUrl: url,
            content: content,
            cookies: cookies,
            ssdParam: ssdParam,
            headers: response?.headers() || {},
            statusCode: response?.status() || 200
        };
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        throw error;
        
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (e) {
                // Ignore close errors
            }
        }
    }
}

// ====== API ENDPOINTS ======

// Main scraping endpoint (FlareSolverr compatible)
app.post('/v1', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { cmd, url, maxTimeout = 30000, session, ...options } = req.body;
        
        if (cmd !== 'request.get') {
            return res.status(400).json({
                status: 'error',
                message: `Command ${cmd} not supported. Use request.get`
            });
        }
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`🚀 SCRAPING REQUEST`);
        console.log(`📍 URL: ${url}`);
        console.log(`⏱️ Max timeout: ${maxTimeout}ms`);
        console.log(`🔒 Session: ${session || 'none'}`);
        console.log('='.repeat(60) + '\n');
        
        const result = await scrapeWithStrategies(url, {
            timeout: maxTimeout,
            ...options
        });
        
        const totalTime = Date.now() - startTime;
        
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
                userAgent: CONFIG.USER_AGENTS[0]
            },
            startTimestamp: startTime,
            endTimestamp: Date.now(),
            version: '1.0.0'
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

// Quick check endpoint
app.post('/quick', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }
        
        const result = await scrapeWithStrategies(url, {
            timeout: 10000,
            waitUntil: 'domcontentloaded',
            blockResources: true
        });
        
        res.json({
            success: true,
            url: result.url,
            hasSsd: result.ssdParam !== null,
            ssdParam: result.ssdParam
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/health', async (req, res) => {
    const memUsage = process.memoryUsage();
    res.json({
        status: 'healthy',
        memory: {
            used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
        },
        browsers: browserPool.browsers.length,
        uptime: process.uptime()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Enhanced Cloud Scraper</title>
            <style>
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
                    padding: 40px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: rgba(255, 255, 255, 0.1);
                    padding: 30px;
                    border-radius: 15px;
                    backdrop-filter: blur(10px);
                }
                h1 { 
                    margin: 0 0 20px 0;
                    font-size: 2.5em;
                }
                .feature {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 8px;
                    border-left: 4px solid #4CAF50;
                }
                .endpoint {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 15px;
                    margin: 15px 0;
                    border-radius: 8px;
                    font-family: 'Courier New', monospace;
                }
                code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 2px 6px;
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚡ Enhanced Cloud Scraper</h1>
                <p><strong>Optimized for Railway.app deployment</strong></p>
                
                <h2>✨ Features:</h2>
                <div class="feature">✅ Cloudflare bypass with multiple strategies</div>
                <div class="feature">✅ Memory optimized for 512MB limit</div>
                <div class="feature">✅ FlareSolverr API compatible</div>
                <div class="feature">✅ Stealth mode with anti-detection</div>
                <div class="feature">✅ Smart resource blocking</div>
                <div class="feature">✅ Session management</div>
                
                <h2>🔧 Endpoints:</h2>
                <div class="endpoint">
                    <strong>POST /v1</strong><br>
                    FlareSolverr compatible endpoint<br>
                    <code>{"cmd": "request.get", "url": "https://example.com"}</code>
                </div>
                <div class="endpoint">
                    <strong>POST /quick</strong><br>
                    Quick URL check<br>
                    <code>{"url": "https://example.com"}</code>
                </div>
                <div class="endpoint">
                    <strong>GET /health</strong><br>
                    Health check and metrics
                </div>
            </div>
        </body>
        </html>
    `);
});
