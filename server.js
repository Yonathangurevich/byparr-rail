const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Configure stealth with ALL evasions
const stealth = StealthPlugin();
// Enable ALL evasions (including the problematic ones)
stealth.enabledEvasions.add('chrome.app');
stealth.enabledEvasions.add('chrome.csi');
stealth.enabledEvasions.add('chrome.loadTimes');
stealth.enabledEvasions.add('chrome.runtime');
// ... rest of the evasions

puppeteer.use(stealth);
// הסרנו את AnonymizeUA מכאן

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 8080;

// Browser configuration for maximum stealth
const BROWSER_CONFIG = {
    headless: false, // Try with false first to see what happens
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Sometimes helps with detection
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--flag-switches-begin',
        '--disable-site-isolation-trials',
        '--flag-switches-end',
        '--disable-web-security',
        '--disable-features=CrossSiteDocumentBlockingAlways,CrossSiteDocumentBlockingIfIsolating',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--allow-insecure-localhost',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--password-store=basic',
        '--use-mock-keychain',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process',
        '--enable-automation',
        `--window-size=1920,1080`,
        '--start-maximized',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=AutomationControlled'],
    defaultViewport: null,
    ignoreHTTPSErrors: true
};

let browser = null;

async function initBrowser() {
    console.log('🚀 Initializing advanced browser...');
    browser = await puppeteer.launch(BROWSER_CONFIG);
    console.log('✅ Browser initialized with advanced stealth');
}

async function advancedScrape(url, options = {}) {
    if (!browser || !browser.isConnected()) {
        await initBrowser();
    }
    
    let page = null;
    
    try {
        // Create page in specific order for better stealth
        const context = await browser.createIncognitoBrowserContext();
        page = await context.newPage();
        
        // Critical: Set these BEFORE navigation
        await page.setBypassCSP(true);
        await page.setJavaScriptEnabled(true);
        
        // Randomize viewport slightly
        const viewportWidth = 1920 + Math.floor(Math.random() * 100);
        const viewportHeight = 1080 + Math.floor(Math.random() * 100);
        await page.setViewport({ 
            width: viewportWidth, 
            height: viewportHeight,
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: true,
            isMobile: false
        });
        
        // Advanced evasion techniques
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver
            delete navigator.__proto__.webdriver;
            
            // Chrome object
            window.chrome = {
                app: {
                    isInstalled: false,
                    InstallState: {
                        DISABLED: 'disabled',
                        INSTALLED: 'installed',
                        NOT_INSTALLED: 'not_installed'
                    },
                    RunningState: {
                        CANNOT_RUN: 'cannot_run',
                        READY_TO_RUN: 'ready_to_run',
                        RUNNING: 'running'
                    }
                },
                runtime: {
                    OnInstalledReason: {
                        CHROME_UPDATE: 'chrome_update',
                        INSTALL: 'install',
                        SHARED_MODULE_UPDATE: 'shared_module_update',
                        UPDATE: 'update'
                    },
                    OnRestartRequiredReason: {
                        APP_UPDATE: 'app_update',
                        OS_UPDATE: 'os_update',
                        PERIODIC: 'periodic'
                    },
                    PlatformArch: {
                        ARM: 'arm',
                        ARM64: 'arm64',
                        MIPS: 'mips',
                        MIPS64: 'mips64',
                        X86_32: 'x86-32',
                        X86_64: 'x86-64'
                    },
                    PlatformNaclArch: {
                        ARM: 'arm',
                        MIPS: 'mips',
                        MIPS64: 'mips64',
                        X86_32: 'x86-32',
                        X86_64: 'x86-64'
                    },
                    PlatformOs: {
                        ANDROID: 'android',
                        CROS: 'cros',
                        LINUX: 'linux',
                        MAC: 'mac',
                        OPENBSD: 'openbsd',
                        WIN: 'win'
                    },
                    RequestUpdateCheckStatus: {
                        NO_UPDATE: 'no_update',
                        THROTTLED: 'throttled',
                        UPDATE_AVAILABLE: 'update_available'
                    }
                }
            };
            
            // Notification permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
            
            // WebGL Vendor
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter) {
                if (parameter === 37445) {
                    return 'Intel Inc.';
                }
                if (parameter === 37446) {
                    return 'Intel Iris OpenGL Engine';
                }
                return getParameter.apply(this, arguments);
            };
            
            // Languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en', 'he-IL', 'he']
            });
            
            // Plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    return [
                        {
                            0: {
                                type: 'application/x-google-chrome-pdf',
                                suffixes: 'pdf',
                                description: 'Portable Document Format',
                                enabledPlugin: Plugin
                            },
                            description: 'Portable Document Format',
                            filename: 'internal-pdf-viewer',
                            length: 1,
                            name: 'Chrome PDF Plugin'
                        },
                        {
                            0: {
                                type: 'application/pdf',
                                suffixes: 'pdf',
                                description: '',
                                enabledPlugin: Plugin
                            },
                            description: '',
                            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
                            length: 1,
                            name: 'Chrome PDF Viewer'
                        },
                        {
                            0: {
                                type: 'application/x-nacl',
                                suffixes: '',
                                description: 'Native Client Executable',
                                enabledPlugin: Plugin
                            },
                            1: {
                                type: 'application/x-pnacl',
                                suffixes: '',
                                description: 'Portable Native Client Executable',
                                enabledPlugin: Plugin
                            },
                            description: '',
                            filename: 'internal-nacl-plugin',
                            length: 2,
                            name: 'Native Client'
                        }
                    ];
                }
            });
            
            // Battery API
            if (navigator.getBattery) {
                navigator.getBattery = () => Promise.resolve({
                    charging: true,
                    chargingTime: 0,
                    dischargingTime: Infinity,
                    level: 1
                });
            }
            
            // Media devices
            if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
                navigator.mediaDevices.enumerateDevices = () => Promise.resolve([]);
            }
        });
        
        // Set realistic headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'max-age=0',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });
        
        // Set cookies if this is PartsOuq
        if (url.includes('partsouq.com')) {
            await page.setCookie({
                name: 'cf_clearance',
                value: 'fake_clearance_token',
                domain: '.partsouq.com',
                path: '/',
                httpOnly: true,
                secure: true
            });
        }
        
        console.log(`📍 Navigating to: ${url}`);
        
        // Navigate with multiple strategies
        let response;
        try {
            // First, try to navigate normally
            response = await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            // Wait a bit for JavaScript to load
            await page.waitForTimeout(3000);
            
            // Check if we hit Cloudflare
            const title = await page.title();
            console.log(`📄 Page title: ${title}`);
            
            if (title.includes('Just a moment') || title.includes('Checking your browser')) {
                console.log('⚠️ Cloudflare detected, attempting bypass...');
                
                // Strategy 1: Wait for automatic resolution
                try {
                    await page.waitForFunction(
                        () => {
                            const title = document.title;
                            return !title.includes('Just a moment') && 
                                   !title.includes('Checking your browser');
                        },
                        { timeout: 20000 }
                    );
                    console.log('✅ Cloudflare auto-resolved');
                } catch (e) {
                    console.log('⏱️ Auto-resolve timeout');
                    
                    // Strategy 2: Try clicking the checkbox if it exists
                    try {
                        const checkbox = await page.$('input[type="checkbox"]');
                        if (checkbox) {
                            await checkbox.click();
                            await page.waitForTimeout(5000);
                        }
                    } catch (e) {
                        console.log('No checkbox found');
                    }
                    
                    // Strategy 3: Reload the page
                    console.log('🔄 Reloading page...');
                    await page.reload({ waitUntil: 'networkidle2' });
                    await page.waitForTimeout(5000);
                }
            }
            
        } catch (error) {
            console.error('Navigation error:', error.message);
            throw error;
        }
        
        // Get final content
        const content = await page.content();
        const finalUrl = page.url();
        const cookies = await page.cookies();
        
        // Check if we're still on Cloudflare
        if (content.includes('Checking your browser') || content.includes('Just a moment')) {
            console.log('❌ Still on Cloudflare challenge page');
            
            // Try one more time with a different strategy
            console.log('🔄 Final attempt with page refresh...');
            await page.evaluate(() => {
                location.reload();
            });
            await page.waitForTimeout(10000);
            
            const newContent = await page.content();
            const newUrl = page.url();
            
            return {
                success: false,
                cloudflareDetected: true,
                url: newUrl,
                content: newContent,
                cookies: await page.cookies(),
                message: 'Cloudflare challenge detected and could not bypass'
            };
        }
        
        console.log('✅ Scraping completed');
        
        // Close context
        await context.close();
        
        return {
            success: true,
            url: finalUrl,
            originalUrl: url,
            content: content,
            cookies: cookies,
            statusCode: response?.status() || 200
        };
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        throw error;
    }
}

// Main endpoint
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
        console.log(`🚀 ADVANCED SCRAPING REQUEST`);
        console.log(`📍 URL: ${url}`);
        console.log('='.repeat(60) + '\n');
        
        const result = await advancedScrape(url, {
            timeout: maxTimeout
        });
        
        res.json({
            status: result.success ? 'ok' : 'error',
            message: result.success ? 'Success' : result.message,
            solution: {
                url: result.url,
                status: result.statusCode,
                response: result.content,
                cookies: result.cookies,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            cloudflareDetected: result.cloudflareDetected || false
        });
        
    } catch (error) {
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
        browserConnected: browser?.isConnected() || false
    });
});

// Root
app.get('/', (req, res) => {
    res.send('Advanced Scraper Running');
});

// Start server
async function start() {
    await initBrowser();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Advanced scraper running on port ${PORT}`);
    });
}

start();

// Cleanup on exit
process.on('SIGTERM', async () => {
    if (browser) await browser.close();
    process.exit(0);
});
