const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

let browserPool = [];
const MAX_BROWSERS = 1;

// ✅ HEADFUL arguments - כמו Byparr מקומי
const HEADFUL_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    
    // ✅ Headful specific - עם XVFB virtual display
    '--display=:99',
    '--window-size=1920,1080',
    '--start-maximized',
    
    // Anti-detection
    '--disable-blink-features=AutomationControlled',
    '--exclude-switches=enable-automation',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-default-apps',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-client-side-phishing-detection',
    '--disable-sync',
    '--mute-audio',
    '--no-pings',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-background-networking',
    '--disable-prompt-on-repost',
    '--use-mock-keychain',
    '--disable-bundled-ppapi-flash',
    '--no-first-run',
    '--no-default-browser-check',
    
    // ✅ Force real GPU (not headless)
    '--use-gl=swiftshader',
    '--enable-webgl'
];

async function createHeadfulBrowser() {
    try {
        console.log('🖥️ Creating HEADFUL browser (like Byparr local)...');
        
        const browser = await puppeteer.launch({
            headless: false, // ✅ HEADFUL MODE!
            args: HEADFUL_ARGS,
            ignoreDefaultArgs: [
                '--enable-automation',
                '--enable-blink-features=AutomationControlled'
            ],
            ignoreHTTPSErrors: true,
            defaultViewport: null,
            // ✅ תוספות לheadful
            env: {
                ...process.env,
                DISPLAY: ':99' // XVFB display
            }
        });
        
        console.log('✅ HEADFUL browser created successfully!');
        
        return { 
            browser, 
            busy: false, 
            id: Date.now() + Math.random(),
            requests: 0,
            created: Date.now()
        };
    } catch (error) {
        console.error('❌ Failed to create HEADFUL browser:', error.message);
        
        // ✅ Fallback to headless if headful fails
        console.log('🔄 Falling back to headless mode...');
        try {
            const browser = await puppeteer.launch({
                headless: 'new',
                args: HEADFUL_ARGS.filter(arg => !arg.includes('display') && !arg.includes('start-maximized')),
                ignoreDefaultArgs: ['--enable-automation'],
                ignoreHTTPSErrors: true,
                defaultViewport: null
            });
            
            console.log('✅ Fallback headless browser created');
            
            return { 
                browser, 
                busy: false, 
                id: Date.now() + Math.random(),
                requests: 0,
                created: Date.now(),
                isHeadless: true
            };
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError.message);
            return null;
        }
    }
}

async function initBrowserPool() {
    console.log('🚀 Initializing HEADFUL browser pool...');
    
    // ✅ Setup XVFB virtual display first
    console.log('🖥️ Setting up virtual display (XVFB)...');
    const { spawn } = require('child_process');
    
    // Start XVFB virtual display
    const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1920x1080x24'], {
        detached: true,
        stdio: 'ignore'
    });
    
    // Set DISPLAY environment variable
    process.env.DISPLAY = ':99';
    
    // Wait a bit for XVFB to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Virtual display ready');
    
    // Now create browser
    const browserObj = await createHeadfulBrowser();
    if (browserObj) {
        browserPool.push(browserObj);
        console.log(`✅ ${browserObj.isHeadless ? 'Headless' : 'HEADFUL'} Browser ready!`);
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
        throw new Error('No browsers available after wait');
    }
    
    browserObj.busy = true;
    browserObj.requests++;
    
    return browserObj;
}

function releaseBrowser(browserObj) {
    if (browserObj) {
        browserObj.busy = false;
        console.log(`📤 Browser ${browserObj.isHeadless ? '(headless)' : '(HEADFUL)'} released`);
    }
}

// ✅ Enhanced page setup for headful mode
async function setupHeadfulPage(page, isHeadless = false) {
    console.log(`🔧 Setting up ${isHeadless ? 'headless' : 'HEADFUL'} page...`);
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    // ✅ Enhanced anti-detection for headful
    await page.evaluateOnNewDocument(() => {
        // Standard anti-detection
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        delete navigator.__proto__.webdriver;
        
        // ✅ Headful-specific properties
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
        Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
        
        // ✅ Screen properties for real display
        Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
        Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        
        // Chrome object
        window.chrome = {
            runtime: {
                onConnect: null,
                onMessage: null,
                connect: function() { return { postMessage: function() {}, onMessage: { addListener: function() {} } }; },
                sendMessage: function() {}
            },
            loadTimes: function() {
                return {
                    commitLoadTime: Date.now() - Math.random() * 1000,
                    connectionInfo: 'h2',
                    finishDocumentLoadTime: Date.now() - Math.random() * 500,
                    finishLoadTime: Date.now() - Math.random() * 300,
                    navigationType: 'Navigation'
                };
            },
            csi: function() {
                return {
                    startE: Date.now() - Math.random() * 1000,
                    onloadT: Date.now() - Math.random() * 500,
                    pageT: Date.now() - Math.random() * 800
                };
            }
        };
        
        // Plugins
        Object.defineProperty(navigator, 'plugins', {
            get: function() {
                return [
                    { description: "Chrome PDF Plugin", filename: "internal-pdf-viewer", name: "Chrome PDF Plugin" },
                    { description: "Native Client", filename: "internal-nacl-plugin", name: "Native Client" }
                ];
            }
        });
    });
    
    // Headers
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
    
    console.log(`✅ ${isHeadless ? 'Headless' : 'HEADFUL'} page setup complete!`);
    return page;
}

// ✅ Patient Cloudflare bypass - כמו Byparr
async function byparrStyleBypass(page, url, maxWaitTime = 180000, fullScraping = false) {
    console.log('🎯 Byparr-style bypass initiated...');
    
    const startTime = Date.now();
    let attempt = 0;
    const maxPatientTime = maxWaitTime * 0.9;
    
    while ((Date.now() - startTime) < maxPatientTime) {
        attempt++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        
        console.log(`🔄 Byparr attempt ${attempt} - ${elapsed}s (like local Byparr)`);
        
        try {
            const currentTitle = await page.title();
            const currentUrl = page.url();
            
            console.log(`📍 Title: "${currentTitle.substring(0, 60)}..."`);
            
            const cloudflareIndicators = [
                'just a moment', 'checking your browser', 'verifying you are human',
                'please wait', 'ddos protection', 'cloudflare', 'ray id'
            ];
            
            const isCloudflareActive = cloudflareIndicators.some(indicator => 
                currentTitle.toLowerCase().includes(indicator)
            );
            
            const hasSSdParam = currentUrl.includes('ssd=');
            const urlChanged = currentUrl !== url;
            
            if (!isCloudflareActive || hasSSdParam || urlChanged) {
                // Check for real content
                const hasContent = await page.evaluate(() => {
                    const bodyText = document.body ? document.body.innerText : '';
                    const hasRealContent = bodyText.length > 800;
                    const noCloudflareText = !bodyText.toLowerCase().includes('just a moment') && 
                                           !bodyText.toLowerCase().includes('checking your browser');
                    return hasRealContent && noCloudflareText;
                }).catch(() => false);
                
                if (hasContent || hasSSdParam) {
                    console.log(`🎯 Byparr-style SUCCESS after ${elapsed}s!`);
                    console.log(`✅ Success indicators: content=${hasContent}, ssd=${hasSSdParam}, changed=${urlChanged}`);
                    
                    // Final wait for full scraping
                    if (fullScraping) {
                        console.log('⏳ Final content stabilization (full mode)...');
                        await page.waitForTimeout(8000);
                    } else {
                        await page.waitForTimeout(3000);
                    }
                    
                    return true;
                }
            }
            
            if (isCloudflareActive) {
                console.log('☁️ Cloudflare still active - being patient like Byparr...');
                
                // ✅ Byparr-style human behavior (less aggressive)
                if (attempt <= 3) {
                    try {
                        // Gentle mouse movement
                        await page.mouse.move(500 + Math.random() * 300, 300 + Math.random() * 200);
                        await page.waitForTimeout(500);
                        
                        // Look for iframes
                        const iframes = await page.$$('iframe');
                        if (iframes.length > 0) {
                            console.log(`🔍 Found ${iframes.length} iframes, checking for Turnstile...`);
                            try {
                                const frame = await iframes[0].contentFrame();
                                if (frame) {
                                    await frame.click('body').catch(() => {});
                                    await page.waitForTimeout(1000);
                                }
                            } catch (e) {}
                        }
                        
                        // Gentle click on page
                        await page.mouse.click(683, 384);
                        await page.waitForTimeout(1000);
                        
                    } catch (interactionError) {
                        console.log(`⚠️ Interaction error: ${interactionError.message}`);
                    }
                }
                
                // ✅ Byparr-style patient wait - starting with shorter waits
                let waitTime;
                if (attempt <= 2) {
                    waitTime = 8000; // 8 seconds first attempts
                } else if (attempt <= 5) {
                    waitTime = 15000; // 15 seconds middle attempts  
                } else {
                    waitTime = 25000; // 25 seconds later attempts
                }
                
                console.log(`⏳ Byparr-style patient wait: ${Math.round(waitTime/1000)}s (attempt ${attempt})`);
                
                // Wait with intermediate checks
                const chunks = Math.ceil(waitTime / 3000);
                const chunkWait = Math.floor(waitTime / chunks);
                
                for (let chunk = 0; chunk < chunks; chunk++) {
                    await page.waitForTimeout(chunkWait);
                    
                    // Intermediate check
                    const intermediateTitle = await page.title().catch(() => currentTitle);
                    const intermediateUrl = page.url();
                    
                    if (!cloudflareIndicators.some(ind => intermediateTitle.toLowerCase().includes(ind)) ||
                        intermediateUrl.includes('ssd=')) {
                        console.log(`🚀 Status changed during wait! Breaking early...`);
                        break;
                    }
                    
                    if (chunk % 2 === 0) {
                        console.log(`⏳ Byparr waiting... (${Math.round((chunk * chunkWait)/1000)}s/${Math.round(waitTime/1000)}s)`);
                    }
                }
            }
            
        } catch (error) {
            console.log(`⚠️ Attempt error: ${error.message}`);
        }
        
        if (Date.now() - startTime >= maxPatientTime) {
            break;
        }
    }
    
    const finalElapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`⏰ Byparr-style bypass completed after ${finalElapsed}s (${attempt} attempts)`);
    
    // Final check
    const finalUrl = page.url();
    const hasSSdParam = finalUrl.includes('ssd=');
    
    console.log(`🔍 Final status: ssd=${hasSSdParam}, url_length=${finalUrl.length}`);
    return hasSSdParam;
}

// Main scraping function
async function scrapeWithByparrStyle(url, fullScraping = false, maxWaitTime = 180000) {
    const startTime = Date.now();
    let browserObj = null;
    let page = null;
    
    try {
        console.log(`🎯 Starting Byparr-style ${fullScraping ? 'FULL SCRAPING' : 'URL EXTRACTION'}`);
        console.log(`🔗 Target: ${url.substring(0, 100)}...`);
        console.log(`⏰ Max time: ${Math.round(maxWaitTime/1000)}s (like local Byparr)`);
        
        browserObj = await getBrowser();
        page = await browserObj.browser.newPage();
        
        await setupHeadfulPage(page, browserObj.isHeadless);
        
        console.log('🚀 Navigating like Byparr...');
        
        // Navigate with patience
        await page.goto(url, {
            waitUntil: ['domcontentloaded'],
            timeout: 60000
        });
        
        // Initial stabilization
        console.log('⏳ Initial stabilization (like Byparr)...');
        await page.waitForTimeout(5000);
        
        // Byparr-style bypass
        const bypassSuccess = await byparrStyleBypass(page, url, maxWaitTime - 15000, fullScraping);
        
        // Final results
        const finalUrl = page.url();
        const html = await page.content();
        const cookies = await page.cookies();
        const elapsed = Date.now() - startTime;
        
        console.log(`🎯 Byparr-style completed in ${elapsed}ms`);
        console.log(`🔗 Final URL: ${finalUrl.substring(0, 100)}...`);
        console.log(`📄 Content: ${html.length} bytes`);
        console.log(`✅ Has ssd param: ${finalUrl.includes('ssd=') ? 'YES ✅' : 'NO ❌'}`);
        
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
            scrapingType: fullScraping ? 'byparr_full' : 'byparr_url',
            bypassSuccess: bypassSuccess,
            browserMode: browserObj.isHeadless ? 'headless' : 'headful'
        };
        
    } catch (error) {
        console.error('🎯 Byparr-style scraping error:', error.message);
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

// Main endpoint
app.post('/v1', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { 
            cmd, 
            url, 
            maxTimeout = 180000, // 3 minutes default like Byparr
            session,
            fullScraping = false
        } = req.body;
        
        if (!url) {
            return res.status(400).json({
                status: 'error',
                message: 'URL is required'
            });
        }
        
        console.log(`\n${'🎯'.repeat(25)}`);
        console.log(`🎯 Byparr-style Request at ${new Date().toISOString()}`);
        console.log(`🔗 URL: ${url.substring(0, 100)}...`);
        console.log(`⏱️ Timeout: ${maxTimeout}ms`);
        console.log(`🎯 Mode: ${fullScraping ? 'BYPARR FULL SCRAPING' : 'BYPARR URL EXTRACTION'}`);
        console.log(`${'🎯'.repeat(25)}\n`);
        
        const result = await Promise.race([
            scrapeWithByparrStyle(url, fullScraping, maxTimeout),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Byparr-style Timeout')), maxTimeout + 20000)
            )
        ]);
        
        if (result.success) {
            const elapsed = Date.now() - startTime;
            
            console.log(`\n${'🎯'.repeat(25)}`);
            console.log(`🎯 BYPARR-STYLE SUCCESS - Total time: ${elapsed}ms`);
            console.log(`🔗 Final URL: ${result.url?.substring(0, 120) || 'N/A'}...`);
            console.log(`📄 HTML Length: ${result.html?.length || 0} bytes`);
            console.log(`✅ Has ssd param: ${result.hasSSd ? 'YES ✅' : 'NO ❌'}`);
            console.log(`🖥️ Browser mode: ${result.browserMode}`);
            console.log(`🚀 Scraping type: ${result.scrapingType}`);
            console.log(`${'🎯'.repeat(25)}\n`);
            
            res.json({
                status: 'ok',
                message: 'Byparr-style Success',
                solution: {
                    url: result.url || url,
                    status: 200,
                    response: result.html,
                    cookies: result.cookies || [],
                    userAgent: 'Mozilla/5.0'
                },
                startTimestamp: startTime,
                endTimestamp: Date.now(),
                version: '6.0.0-BYPARR-STYLE-HEADFUL',
                hasSSd: result.hasSSd || false,
                scrapingType: result.scrapingType,
                browserMode: result.browserMode,
                bypassSuccess: result.bypassSuccess
            });
        } else {
            throw new Error(result.error || 'Byparr-style error');
        }
        
    } catch (error) {
        console.error(`\n${'🎯'.repeat(25)}`);
        console.error('🎯 BYPARR-STYLE REQUEST FAILED:', error.message);
        console.error(`${'🎯'.repeat(25)}\n`);
        
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
        status: 'byparr-style-ready',
        uptime: Math.round(process.uptime()) + 's',
        browsers: browserPool.length,
        activeBrowsers: browserPool.filter(b => b.busy).length,
        browserMode: browserPool.length > 0 ? (browserPool[0].isHeadless ? 'headless' : 'headful') : 'unknown',
        memory: {
            used: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memory.heapTotal / 1024 / 1024) + 'MB'
        },
        features: [
            '🎯 Byparr-style behavior',
            '🖥️ Headful mode (XVFB)',
            '⏰ Patient waiting strategy',
            '🔧 Gentle interactions',
            '🎮 Real display simulation'
        ]
    });
});

// Root
app.get('/', (req, res) => {
    const memory = process.memoryUsage();
    const browserMode = browserPool.length > 0 ? (browserPool[0].isHeadless ? 'Headless' : 'HEADFUL') : 'Unknown';
    
    res.send(`
        <h1>🎯 Byparr-Style Puppeteer v6.0</h1>
        <p><strong>Status:</strong> Mimicking local Byparr behavior</p>
        <p><strong>Browser Mode:</strong> ${browserMode}</p>
        <p><strong>Memory:</strong> ${Math.round(memory.heapUsed / 1024 / 1024)}MB</p>
        
        <h3>🎯 Byparr Features:</h3>
        <ul>
            <li>✅ HEADFUL mode with XVFB virtual display</li>
            <li>✅ Patient waiting strategy (8-25s per attempt)</li>
            <li>✅ Gentle human interactions</li>
            <li>✅ Real display properties</li>
            <li>✅ Cloudflare challenge detection</li>
            <li>✅ 3-minute default timeout</li>
        </ul>
        
        <h3>🚀 Like Local Byparr:</h3>
        <p>This tries to replicate the exact behavior of local Byparr that works</p>
        <p><strong>Success Rate:</strong> Should match local Byparr performance</p>
        
        <h3>📖 Usage:</h3>
        <p><code>{"fullScraping": false, "maxTimeout": 180000}</code></p>
    `);
});

// Install XVFB if not available
async function ensureXVFB() {
    const { spawn } = require('child_process');
    
    try {
        // Check if XVFB is available
        spawn('which', ['Xvfb']).on('close', (code) => {
            if (code !== 0) {
                console.log('📦 Installing XVFB...');
                const install = spawn('apt-get', ['update', '&&', 'apt-get', 'install', '-y', 'xvfb'], {
                    stdio: 'inherit',
                    shell: true
                });
                
                install.on('close', (installCode) => {
                    if (installCode === 0) {
                        console.log('✅ XVFB installed successfully');
                    } else {
                        console.log('❌ Failed to install XVFB');
                    }
                });
            }
        });
    } catch (error) {
        console.log('⚠️ XVFB check failed:', error.message);
    }
}

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║         🎯 Byparr-Style Puppeteer v6.0       ║
║     HEADFUL MODE - Like Local Byparr         ║
║              Port: ${PORT}                       ║
║         Patient Strategy: 8-25s waits        ║
║            XVFB Virtual Display               ║
╚═══════════════════════════════════════════════╝
    `);
    
    console.log('🖥️ Ensuring XVFB is available...');
    await ensureXVFB();
    
    console.log('🎯 Initializing Byparr-style browser...');
    await initBrowserPool();
    
    console.log('🚀 BYPARR-STYLE READY - Mimicking local success!');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🎯 Byparr-style shutdown...');
    for (const browserObj of browserPool) {
        await browserObj.browser.close().catch(() => {});
    }
    browserPool = [];
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('🎯 Byparr Exception:', error.message);
});

process.on('unhandledRejection', (error) => {
    console.error('🎯 Byparr Rejection:', error.message);
});
