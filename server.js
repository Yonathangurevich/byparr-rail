// server.js - Using curl-impersonate for better Cloudflare bypass
const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const execPromise = util.promisify(exec);

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

// Try curl-impersonate first
async function scrapeWithCurl(url) {
    console.log('🔧 Trying curl-impersonate...');
    
    try {
        // Use curl-impersonate with Chrome fingerprint
        const curlCommand = `curl -L -s -k \
            -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
            -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" \
            -H "Accept-Language: en-US,en;q=0.9" \
            -H "Accept-Encoding: gzip, deflate, br" \
            -H "DNT: 1" \
            -H "Connection: keep-alive" \
            -H "Upgrade-Insecure-Requests: 1" \
            -H "Sec-Fetch-Dest: document" \
            -H "Sec-Fetch-Mode: navigate" \
            -H "Sec-Fetch-Site: none" \
            -H "Sec-Fetch-User: ?1" \
            -H "Cache-Control: max-age=0" \
            -H "sec-ch-ua: \\"Not_A Brand\\";v=\\"8\\", \\"Chromium\\";v=\\"120\\", \\"Google Chrome\\";v=\\"120\\"" \
            -H "sec-ch-ua-mobile: ?0" \
            -H "sec-ch-ua-platform: \\"Windows\\"" \
            --compressed \
            --tlsv1.2 \
            --http2 \
            "${url}"`;
        
        const { stdout, stderr } = await execPromise(curlCommand);
        
        if (stderr) {
            console.error('Curl stderr:', stderr);
        }
        
        // Check if we got Cloudflare challenge
        if (stdout.includes('Just a moment') || stdout.includes('Checking your browser')) {
            console.log('❌ Curl got Cloudflare challenge');
            return null;
        }
        
        console.log('✅ Curl succeeded!');
        return stdout;
        
    } catch (error) {
        console.error('❌ Curl failed:', error.message);
        return null;
    }
}

// Fallback to Puppeteer with better configuration
async function scrapeWithPuppeteer(url) {
    console.log('🔧 Falling back to Puppeteer...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--window-size=1920,1080',
            '--start-maximized',
            // Try with proxy if available
            // '--proxy-server=http://your-proxy:port'
        ],
        ignoreDefaultArgs: ['--enable-automation']
    });
    
    try {
        const page = await browser.newPage();
        
        // Randomize viewport
        await page.setViewport({
            width: 1920 + Math.floor(Math.random() * 100),
            height: 1080 + Math.floor(Math.random() * 100),
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false
        });
        
        // Set random user agent
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        
        // Critical evasions
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver
            delete Object.getPrototypeOf(navigator).webdriver;
            
            // Mock chrome
            window.chrome = {
                runtime: {},
                app: {
                    isInstalled: false,
                    getDetails: () => null,
                    getIsInstalled: () => false,
                    installState: () => 'not_installed'
                }
            };
            
            // Mock permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // Mock plugins array
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const arr = [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                        { name: 'Native Client', filename: 'internal-nacl-plugin' }
                    ];
                    arr.item = i => arr[i];
                    arr.namedItem = name => arr.find(p => p.name === name);
                    arr.refresh = () => {};
                    return arr;
                }
            });
            
            // Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            // Mock WebGL
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) return 'Intel Inc.';
                if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                return getParameter.apply(this, arguments);
            };
            
            // Mock screen
            Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
            Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
            
            // Mock timezone
            Date.prototype.getTimezoneOffset = function() { return -120; };
        });
        
        // Set headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });
        
        console.log(`📍 Navigating to: ${url}`);
        
        // Navigate with different strategies
        let response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        // Wait for potential JavaScript execution
        await page.waitForTimeout(5000);
        
        // Check for Cloudflare
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);
        
        if (title.includes('Just a moment') || title.includes('Checking your browser')) {
            console.log('⚠️ Cloudflare detected in Puppeteer');
            
            // Try to wait it out
            try {
                await page.waitForFunction(
                    () => !document.title.includes('Just a moment') && !document.title.includes('Checking your browser'),
                    { timeout: 20000 }
                );
                console.log('✅ Cloudflare resolved');
            } catch (e) {
                console.log('❌ Cloudflare timeout');
                
                // Last resort - try to solve challenge manually
                // Look for checkbox or button
                const elements = await page.$$('input[type="checkbox"], button');
                for (const element of elements) {
                    try {
                        await element.click();
                        await page.waitForTimeout(3000);
                    } catch (e) {
                        // Ignore click errors
                    }
                }
                
                // Try reload
                await page.reload({ waitUntil: 'networkidle2' });
                await page.waitForTimeout(5000);
            }
        }
        
        const content = await page.content();
        const finalUrl = page.url();
        const cookies = await page.cookies();
        
        await browser.close();
        
        // Final check
        if (content.includes('Just a moment') || content.includes('Checking your browser')) {
            console.log('❌ Still stuck on Cloudflare');
            return {
                success: false,
                cloudflareBlocked: true,
                content: content,
                url: finalUrl,
                cookies: cookies
            };
        }
        
        console.log('✅ Puppeteer succeeded');
        return {
            success: true,
            content: content,
            url: finalUrl,
            cookies: cookies
        };
        
    } catch (error) {
        console.error('❌ Puppeteer error:', error.message);
        await browser.close();
        throw error;
    }
}

// Main scraping function with multiple strategies
async function scrapeWithStrategies(url) {
    // Strategy 1: Try curl first (fastest)
    const curlResult = await scrapeWithCurl(url);
    if (curlResult && !curlResult.includes('Just a moment')) {
        return {
            success: true,
            method: 'curl',
            content: curlResult,
            url: url
        };
    }
    
    // Strategy 2: Try Puppeteer
    const puppeteerResult = await scrapeWithPuppeteer(url);
    if (puppeteerResult.success) {
        return {
            success: true,
            method: 'puppeteer',
            content: puppeteerResult.content,
            url: puppeteerResult.url,
            cookies: puppeteerResult.cookies
        };
    }
    
    // Strategy 3: If PartsOuq, try with session approach
    if (url.includes('partsouq.com')) {
        console.log('🔧 Trying PartsOuq specific approach...');
        
        // First get the main page to establish session
        const mainPageResult = await scrapeWithPuppeteer('https://partsouq.com');
        if (mainPageResult.cookies && mainPageResult.cookies.length > 0) {
            // Now try the actual URL with cookies
            return await scrapeWithPuppeteer(url);
        }
    }
    
    // All strategies failed
    return {
        success: false,
        error: 'All scraping strategies failed',
        cloudflareBlocked: true,
        lastContent: puppeteerResult.content
    };
}

// API endpoints
app.post('/v1', async (req, res) => {
    try {
        const { cmd, url, maxTimeout = 60000 } = req.body;
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`🚀 MULTI-STRATEGY SCRAPING REQUEST`);
        console.log(`📍 URL: ${url}`);
        console.log('='.repeat(60) + '\n');
        
        const result = await scrapeWithStrategies(url);
        
        if (result.success) {
            res.json({
                status: 'ok',
                message: `Success with ${result.method}`,
                solution: {
                    url: result.url,
                    status: 200,
                    response: result.content,
                    cookies: result.cookies || [],
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                method: result.method
            });
        } else {
            res.json({
                status: 'error',
                message: result.error || 'Cloudflare block detected',
                cloudflareBlocked: result.cloudflareBlocked,
                solution: {
                    response: result.lastContent || '',
                    status: 403
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Request failed:', error.message);
        res.json({
            status: 'error',
            message: error.message,
            solution: null
        });
    }
});

// Test endpoint for curl only
app.post('/curl-test', async (req, res) => {
    const { url } = req.body;
    const result = await scrapeWithCurl(url);
    
    res.json({
        success: result !== null,
        content: result || 'Failed',
        length: result ? result.length : 0
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        strategies: ['curl', 'puppeteer', 'session'],
        uptime: process.uptime()
    });
});

// Root
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Multi-Strategy Scraper</title>
            <style>
                body { 
                    font-family: Arial, sans-serif;
                    padding: 40px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: rgba(255,255,255,0.1);
                    padding: 30px;
                    border-radius: 15px;
                }
                h1 { margin-top: 0; }
                .strategy {
                    background: rgba(255,255,255,0.1);
                    padding: 10px;
                    margin: 10px 0;
                    border-radius: 5px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚡ Multi-Strategy Scraper</h1>
                <p>Advanced scraper with multiple bypass strategies</p>
                
                <h3>Strategies:</h3>
                <div class="strategy">1️⃣ Curl Impersonate - Fast, lightweight</div>
                <div class="strategy">2️⃣ Puppeteer Stealth - JavaScript support</div>
                <div class="strategy">3️⃣ Session-based - For persistent blocks</div>
                
                <h3>Endpoints:</h3>
                <div class="strategy">POST /v1 - Main scraping endpoint</div>
                <div class="strategy">POST /curl-test - Test curl only</div>
                <div class="strategy">GET /health - Health check</div>
            </div>
        </body>
        </html>
    `);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════════╗
║   ⚡ MULTI-STRATEGY SCRAPER                ║
║   Port: ${PORT}                              ║
║   Strategies: curl, puppeteer, session    ║
╚════════════════════════════════════════════╝
    `);
    console.log('✅ Server ready!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down...');
    process.exit(0);
});
