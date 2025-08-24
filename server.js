const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

// Browser instance (single for Railway)
let browser = null;

// Browser arguments optimized for Railway
const BROWSER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
    '--start-maximized',
    '--disable-features=VizDisplayCompositor',
    '--disable-web-security',
    '--disable-features=IsolateOrigins',
    '--disable-site-isolation-trials'
];

// Initialize browser
async function initBrowser() {
    if (browser) {
        try {
            await browser.close();
        } catch (e) {
            console.log('Error closing browser:', e.message);
        }
    }
    
    console.log('🚀 Initializing browser...');
    browser = await puppeteer.launch({
        headless: 'new',
        args: BROWSER_ARGS,
        ignoreDefaultArgs: ['--enable-automation']
    });
    console.log('✅ Browser initialized');
}

// Main scraping function
async function scrapeUrl(url, options = {}) {
    if (!browser || !browser.isConnected()) {
        await initBrowser();
    }
    
    let page = null;
    
    try {
        page = await browser.newPage();
        
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Override webdriver property
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
        });
        
        // Set headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        
        console.log(`📍 Navigating to: ${url}`);
        
        // Navigate to page
        const response = await page.goto(url, {
            waitUntil: options.waitUntil || 'networkidle2',
            timeout: options.timeout || 30000
        });
        
        // Check for Cloudflare
        const title = await page.title();
        if (title.includes('Just a moment')) {
            console.log('⚠️ Cloudflare detected, waiting...');
            
            try {
                await page.waitForFunction(
                    () => !document.title.includes('Just a moment'),
                    { timeout: 15000 }
                );
                console.log('✅ Cloudflare bypassed');
            } catch (e) {
                console.log('⏱️ Cloudflare timeout, continuing...');
            }
        }
        
        // Wait a bit for dynamic content
        await page.waitForTimeout(2000);
        
        // Get content
        const content = await page.content();
        const finalUrl = page.url();
        const cookies = await page.cookies();
        
        console.log('✅ Scraping completed');
        
        return {
            success: true,
            url: finalUrl,
            content: content,
            cookies: cookies,
            statusCode: response?.status() || 200
        };
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        throw error;
        
    } finally {
        if (page) {
            await page.close();
        }
    }
}

// Main endpoint - FlareSolverr compatible
app.post('/v1', async (req, res) => {
    try {
        const { cmd, url, maxTimeout = 30000 } = req.body;
        
        if (cmd !== 'request.get') {
            return res.status(400).json({
                status: 'error',
                message: 'Only request.get is supported'
            });
        }
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }
        
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🚀 SCRAPING REQUEST`);
        console.log(`📍 URL: ${url}`);
        console.log(`${'='.repeat(50)}\n`);
        
        const result = await scrapeUrl(url, {
            timeout: maxTimeout
        });
        
        // Return FlareSolverr-compatible response
        res.json({
            status: 'ok',
            message: 'Success',
            solution: {
                url: result.url,
                status: result.statusCode,
                response: result.content,
                cookies: result.cookies,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            startTimestamp: Date.now(),
            endTimestamp: Date.now(),
            version: '1.0.0'
        });
        
    } catch (error) {
        console.error('❌ Request failed:', error.message);
        
        res.json({
            status: 'error',
            message: error.message,
            solution: null
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        browserConnected: browser?.isConnected() || false,
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
            <title>Cloud Scraper</title>
            <style>
                body { 
                    font-family: Arial, sans-serif;
                    padding: 40px;
                    background: #1a1a2e;
                    color: #fff;
                }
                h1 { color: #4CAF50; }
                .endpoint {
                    background: #16213e;
                    padding: 15px;
                    margin: 10px 0;
                    border-radius: 5px;
                    border-left: 3px solid #4CAF50;
                }
                code {
                    background: #0f3460;
                    padding: 2px 6px;
                    border-radius: 3px;
                }
            </style>
        </head>
        <body>
            <h1>⚡ Cloud Scraper</h1>
            <p>Optimized for Railway deployment</p>
            
            <div class="endpoint">
                <h3>POST /v1</h3>
                <p>Main scraping endpoint (FlareSolverr compatible)</p>
                <code>{"cmd": "request.get", "url": "https://example.com"}</code>
            </div>
            
            <div class="endpoint">
                <h3>GET /health</h3>
                <p>Health check endpoint</p>
            </div>
            
            <p>Status: <strong style="color: #4CAF50;">Running</strong></p>
        </body>
        </html>
    `);
});

// Start server
async function start() {
    try {
        // Initialize browser
        await initBrowser();
        
        // Start server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`
╔════════════════════════════════════════╗
║   ⚡ CLOUD SCRAPER                     ║
║   Port: ${PORT}                          ║
║   Status: Ready                       ║
╚════════════════════════════════════════╝
            `);
        });
        
    } catch (error) {
        console.error('Failed to start:', error);
        process.exit(1);
    }
}

// Start the application
start();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});
