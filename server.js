// server.js - Using Playwright instead of Puppeteer
const express = require('express');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

// Add stealth plugin to playwright
chromium.use(stealth);

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

let browser = null;

async function initBrowser() {
    console.log('🚀 Initializing Playwright browser...');
    
    browser = await chromium.launch({
        headless: false, // Set to true for production
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox'
        ],
        // Playwright specific options
        chromiumSandbox: false,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false
    });
    
    console.log('✅ Playwright browser initialized');
}

async function scrapeWithPlaywright(url, options = {}) {
    if (!browser) {
        await initBrowser();
    }
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: [],
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        colorScheme: 'light',
        reducedMotion: 'reduce',
        forcedColors: 'none',
        acceptDownloads: false,
        // Important: These help with detection
        javaScriptEnabled: true,
        bypassCSP: true,
        ignoreHTTPSErrors: true,
        // Extra headers
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });
    
    const page = await context.newPage();
    
    // Advanced evasion
    await page.addInitScript(() => {
        // Override webdriver
        delete Object.getPrototypeOf(navigator).webdriver;
        
        // Mock chrome object
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {}
        };
        
        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );
        
        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
        
        // Mock languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
    });
    
    try {
        console.log(`📍 Navigating to: ${url}`);
        
        // Navigate with retry logic
        let retries = 3;
        let response;
        
        while (retries > 0) {
            try {
                response = await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });
                
                // Wait for potential redirects
                await page.waitForTimeout(3000);
                
                // Check for Cloudflare
                const title = await page.title();
                
                if (title.includes('Just a moment')) {
                    console.log('⚠️ Cloudflare detected, waiting...');
                    
                    // Wait for challenge to resolve
                    await page.waitForFunction(
                        () => !document.title.includes('Just a moment'),
                        { timeout: 15000 }
                    ).catch(() => console.log('Cloudflare wait timeout'));
                    
                    // Additional wait
                    await page.waitForTimeout(2000);
                }
                
                break; // Success, exit retry loop
                
            } catch (error) {
                retries--;
                console.log(`Retry ${3 - retries}/3 failed:`, error.message);
                
                if (retries === 0) throw error;
                
                await page.waitForTimeout(5000);
            }
        }
        
        const content = await page.content();
        const finalUrl = page.url();
        const cookies = await context.cookies();
        
        await context.close();
        
        return {
            success: true,
            url: finalUrl,
            content: content,
            cookies: cookies,
            statusCode: response?.status() || 200
        };
        
    } catch (error) {
        await context.close();
        throw error;
    }
}

// API endpoints
app.post('/v1', async (req, res) => {
    try {
        const { cmd, url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL required'
            });
        }
        
        const result = await scrapeWithPlaywright(url);
        
        res.json({
            status: 'ok',
            message: 'Success',
            solution: {
                url: result.url,
                status: result.statusCode,
                response: result.content,
                cookies: result.cookies
            }
        });
        
    } catch (error) {
        res.json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.send('Playwright Scraper Running');
});

// Start server
async function start() {
    await initBrowser();
    app.listen(PORT, () => {
        console.log(`✅ Server running on port ${PORT}`);
    });
}

start();
