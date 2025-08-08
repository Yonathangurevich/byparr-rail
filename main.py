"""
Partsouq Playwright Scraper - Ultimate Fix v8.0
עובד עם gate.smartproxy.com:10000
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import time
import logging
import asyncio
import random
import json
from typing import Optional, Dict, Any, List
from playwright.async_api import async_playwright, Error as PlaywrightError

# הגדרת לוגינג מפורט
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq Scraper Ultimate",
    description="Working with SmartProxy on port 10000",
    version="8.0.0"
)

# קבלת פרטי פרוקסי מ-ENV
SMARTPROXY_USER = os.getenv('SMARTP_USER', '')
SMARTPROXY_PASS = os.getenv('SMARTP_PASS', '')

# User agents pool
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
]

def get_working_proxy():
    """החזר את הפרוקסי שעובד - port 10000"""
    if not SMARTPROXY_USER or not SMARTPROXY_PASS:
        logger.warning("No proxy credentials in ENV")
        return None
    
    # השתמש רק בפורט שאנחנו יודעים שעובד!
    return f"http://{SMARTPROXY_USER}:{SMARTPROXY_PASS}@gate.smartproxy.com:10000"

# Semaphore להגבלת מקביליות
CONCURRENCY_LIMIT = int(os.getenv('CONCURRENCY_LIMIT', '2'))
semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)

# Request model
class ScrapeRequest(BaseModel):
    url: str
    identifier: Optional[str] = "custom"

class UltimateScraper:
    """סקרייפר משופר עם כל התיקונים"""
    
    @staticmethod
    def get_advanced_stealth_script():
        """סקריפט stealth מתקדם במיוחד"""
        return """
        // מחיקת webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        
        // Chrome object מלא
        window.chrome = {
            runtime: {
                connect: () => {},
                sendMessage: () => {},
                onMessage: {}
            },
            loadTimes: function() {
                return {
                    requestTime: Date.now() / 1000,
                    startLoadTime: Date.now() / 1000,
                    commitLoadTime: Date.now() / 1000,
                    finishDocumentLoadTime: Date.now() / 1000,
                    finishLoadTime: Date.now() / 1000,
                    firstPaintTime: Date.now() / 1000,
                    firstPaintAfterLoadTime: 0,
                    navigationType: "Other",
                    wasFetchedViaSpdy: false,
                    wasNpnNegotiated: true,
                    npnNegotiatedProtocol: "h2",
                    wasAlternateProtocolAvailable: false,
                    connectionInfo: "h2"
                };
            },
            csi: function() {
                return {
                    onloadT: Date.now(),
                    pageT: Date.now() - 1000,
                    startE: Date.now() - 2000,
                    tran: 15
                };
            },
            app: {
                isInstalled: false,
                getDetails: () => null,
                getIsInstalled: () => false,
                runningState: () => 'running'
            }
        };
        
        // Plugins מלאים
        Object.defineProperty(navigator, 'plugins', {
            get: () => {
                return [
                    {
                        0: {type: "application/x-google-chrome-pdf", suffixes: "pdf"},
                        description: "Portable Document Format",
                        filename: "internal-pdf-viewer",
                        length: 1,
                        name: "Chrome PDF Plugin"
                    },
                    {
                        0: {type: "application/pdf", suffixes: "pdf"},
                        description: "Portable Document Format",
                        filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                        length: 1,
                        name: "Chrome PDF Viewer"
                    },
                    {
                        0: {type: "application/x-nacl", suffixes: ""},
                        1: {type: "application/x-pnacl", suffixes: ""},
                        description: "Native Client Executable",
                        filename: "internal-nacl-plugin",
                        length: 2,
                        name: "Native Client"
                    }
                ];
            }
        });
        
        // Languages תקינות
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en', 'he']
        });
        
        // Permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({state: Notification.permission}) :
                originalQuery(parameters)
        );
        
        // WebGL Vendor
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel Iris OpenGL Engine';
            return getParameter.apply(this, arguments);
        };
        
        // Canvas fingerprint
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
            const context = this.getContext('2d');
            if (context) {
                const imageData = context.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    imageData.data[i] = imageData.data[i] ^ 1;
                }
                context.putImageData(imageData, 0, 0);
            }
            return originalToDataURL.apply(this, arguments);
        };
        
        // Battery API
        if (navigator.getBattery) {
            navigator.getBattery = () => Promise.resolve({
                charging: true,
                chargingTime: 0,
                dischargingTime: Infinity,
                level: 1.0
            });
        }
        
        // Console מתקדם
        const originalConsole = window.console;
        window.console = {
            ...originalConsole,
            debug: () => {}
        };
        """
    
    @staticmethod
    async def create_stealth_browser(use_proxy: bool = True):
        """יצירת browser עם כל התיקונים והשיפורים"""
        playwright = None
        browser = None
        
        try:
            playwright = await async_playwright().start()
            
            # Browser arguments משופרים
            launch_options = {
                'headless': True,  # או False לדיבאג
                'args': [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080',
                    '--start-maximized',
                    '--disable-features=TranslateUI',
                    '--disable-features=AutomationControlledPopup',
                    '--lang=en-US'
                ]
            }
            
            # הוסף proxy רק אם נדרש
            if use_proxy:
                proxy_url = get_working_proxy()
                if proxy_url:
                    logger.info("Using proxy on port 10000")
                    launch_options['proxy'] = {'server': proxy_url}
                else:
                    logger.warning("No proxy configured, continuing without")
            
            # Launch browser
            browser = await playwright.chromium.launch(**launch_options)
            
            # Create context עם הגדרות מלאות
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                screen={'width': 1920, 'height': 1080},
                user_agent=random.choice(USER_AGENTS),
                locale='en-US',
                timezone_id='America/New_York',
                device_scale_factor=1,
                is_mobile=False,
                has_touch=False,
                java_script_enabled=True,
                accept_downloads=False,
                ignore_https_errors=True,
                bypass_csp=True,
                extra_http_headers={
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
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
                }
            )
            
            # הזרק stealth script
            await context.add_init_script(UltimateScraper.get_advanced_stealth_script())
            
            # הוסף cookies אם צריך
            await context.add_cookies([
                {
                    'name': 'session_started',
                    'value': str(int(time.time())),
                    'domain': '.partsouq.com',
                    'path': '/'
                }
            ])
            
            return playwright, browser, context
            
        except Exception as e:
            logger.error(f"Browser creation failed: {e}")
            if browser:
                await browser.close()
            if playwright:
                await playwright.stop()
            raise
    
    @staticmethod
    async def handle_cloudflare(page, max_wait: int = 30):
        """טיפול מתקדם ב-Cloudflare"""
        logger.info("Checking for Cloudflare...")
        
        start_time = time.time()
        
        while (time.time() - start_time) < max_wait:
            content = await page.content()
            content_lower = content.lower()
            
            # בדוק אם Cloudflare קיים
            cf_indicators = [
                'checking your browser',
                'just a moment',
                'cloudflare',
                'cf-browser-verification',
                'cf-challenge-running'
            ]
            
            if not any(indicator in content_lower for indicator in cf_indicators):
                logger.info("✅ Passed Cloudflare!")
                return True
            
            logger.info(f"⏳ Cloudflare active, waiting... ({int(time.time() - start_time)}s)")
            
            # נסה ללחוץ על כפתור אם יש
            try:
                button = await page.query_selector('button:has-text("Verify")')
                if button:
                    await button.click()
                    logger.info("Clicked verification button")
            except:
                pass
            
            # המתן עוד
            await asyncio.sleep(3)
        
        logger.warning("⚠️ Cloudflare timeout - might be blocked")
        return False
    
    @staticmethod
    async def scrape_with_smart_retry(url: str, max_retries: int = 3) -> Dict[str, Any]:
        """סקרייפינג חכם עם retry strategies"""
        
        strategies = [
            {'use_proxy': True, 'wait_time': 30, 'name': 'Proxy + Long wait'},
            {'use_proxy': True, 'wait_time': 15, 'name': 'Proxy + Medium wait'},
            {'use_proxy': False, 'wait_time': 20, 'name': 'No proxy + Medium wait'},
        ]
        
        last_error = None
        
        for idx, strategy in enumerate(strategies):
            logger.info(f"🔄 Attempt {idx+1}: {strategy['name']}")
            
            try:
                result = await UltimateScraper._perform_advanced_scrape(
                    url=url,
                    use_proxy=strategy['use_proxy'],
                    cloudflare_wait=strategy['wait_time']
                )
                
                if result['success']:
                    result['strategy_used'] = strategy['name']
                    return result
                    
                last_error = result.get('error', 'Unknown error')
                
            except Exception as e:
                last_error = str(e)
                logger.error(f"Strategy failed: {e}")
            
            # המתן בין ניסיונות
            if idx < len(strategies) - 1:
                await asyncio.sleep(3)
        
        return {
            'success': False,
            'error': f'All strategies failed. Last: {last_error}',
            'url': url,
            'attempts': len(strategies)
        }
    
    @staticmethod
    async def _perform_advanced_scrape(
        url: str, 
        use_proxy: bool = True,
        cloudflare_wait: int = 20
    ) -> Dict[str, Any]:
        """ביצוע סקרייפינג מתקדם"""
        
        playwright = None
        browser = None
        context = None
        
        try:
            # יצירת browser
            playwright, browser, context = await UltimateScraper.create_stealth_browser(use_proxy)
            
            # יצירת page
            page = await context.new_page()
            
            # הגדרת timeouts
            page.set_default_timeout(40000)  # הגדל ל-40 שניות
            page.set_default_navigation_timeout(40000)
            
            # Event listeners
            page.on('console', lambda msg: logger.debug(f'Browser console: {msg.text}'))
            page.on('pageerror', lambda exc: logger.error(f'Page error: {exc}'))
            
            # ניווט עם המתנה לרשת
            logger.info(f"📍 Navigating to: {url[:80]}...")
            
            try:
                response = await page.goto(
                    url, 
                    wait_until='networkidle',  # חכה לרשת שקטה
                    timeout=35000
                )
                
                if response:
                    logger.info(f"HTTP Status: {response.status}")
                    
            except PlaywrightError as e:
                if "timeout" in str(e).lower():
                    logger.warning("Navigation timeout - checking if page loaded anyway...")
                else:
                    raise
            
            # טיפול ב-Cloudflare
            cf_passed = await UltimateScraper.handle_cloudflare(page, cloudflare_wait)
            
            # אם לא עבר cloudflare, נסה refresh
            if not cf_passed:
                logger.info("Trying page refresh...")
                await page.reload(wait_until='networkidle', timeout=20000)
                await UltimateScraper.handle_cloudflare(page, 10)
            
            # קבל תוכן סופי
            content = await page.content()
            current_url = page.url
            
            # צילום מסך לדיבאג (אופציונלי)
            # screenshot = await page.screenshot()
            
            # חילוץ VIN
            vin = None
            if 'q=' in url:
                try:
                    vin = url.split('q=')[1].split('&')[0]
                except:
                    pass
            
            # ניתוח התוכן
            content_lower = content.lower()
            
            # חפש אינדיקטורים להצלחה
            success_indicators = [
                'partsouq' in content_lower,
                'catalog' in current_url or 'search' in current_url,
                'part' in content_lower or 'vehicle' in content_lower,
                len(content) > 10000  # תוכן משמעותי
            ]
            
            # חפש אינדיקטורים לכשלון
            failure_indicators = [
                'cloudflare' in content_lower,
                'just a moment' in content_lower,
                'access denied' in content_lower,
                'error' in content_lower and '404' in content,
                len(content) < 1000  # תוכן קצר מדי
            ]
            
            # ניתוח מפורט
            analysis = {
                'final_url': current_url,
                'content_size': len(content),
                'has_partsouq': 'partsouq' in content_lower,
                'has_vin': vin.lower() in content_lower if vin else False,
                'has_parts': 'part' in content_lower,
                'has_catalog': 'catalog' in content_lower,
                'has_search': any(x in current_url for x in ['/search/', '/catalog/']),
                'has_cloudflare': any(cf in content_lower for cf in ['cloudflare', 'just a moment']),
                'has_error': 'error' in content_lower,
                'success_score': sum(success_indicators),
                'failure_score': sum(failure_indicators),
                'proxy_used': use_proxy
            }
            
            # קביעת הצלחה
            success = (
                analysis['success_score'] >= 3 and 
                analysis['failure_score'] <= 1
            )
            
            # דוגמת תוכן נקי
            sample = content[:800]
            sample_clean = ''.join(c if 32 <= ord(c) < 127 else ' ' for c in sample)
            sample_clean = ' '.join(sample_clean.split())[:300]
            
            # חפש מידע ספציפי
            parts_found = []
            if 'data-part' in content:
                # נסה לחלץ מספרי חלקים
                import re
                parts = re.findall(r'data-part["\']?\s*[:=]\s*["\']?([A-Z0-9\-]+)', content)
                parts_found = list(set(parts[:5]))  # רק 5 ראשונים
            
            return {
                'success': success,
                'url': url,
                'vin': vin,
                'final_url': current_url,
                'analysis': analysis,
                'sample_content': sample_clean,
                'parts_found': parts_found,
                'timestamp': time.time()
            }
            
        except Exception as e:
            logger.error(f"Scraping error: {e}")
            return {
                'success': False,
                'error': str(e),
                'url': url,
                'use_proxy': use_proxy
            }
        finally:
            # ניקוי
            try:
                if context:
                    await context.close()
                if browser:
                    await browser.close()
                if playwright:
                    await playwright.stop()
            except:
                pass

# === API ENDPOINTS ===

@app.get("/")
async def root():
    """מידע בסיסי"""
    return {
        "service": "Partsouq Scraper Ultimate v8",
        "status": "online",
        "proxy": "gate.smartproxy.com:10000 ✅",
        "endpoints": [
            "/health",
            "/test-proxy",
            "/scrape/{vin}",
            "/scrape-url",
            "/debug-scrape/{vin}"
        ]
    }

@app.get("/health")
async def health_check():
    """בדיקת בריאות"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "proxy_configured": bool(SMARTPROXY_USER and SMARTPROXY_PASS),
        "working_proxy": "gate.smartproxy.com:10000",
        "concurrency": f"{CONCURRENCY_LIMIT - semaphore._value}/{CONCURRENCY_LIMIT}"
    }

@app.get("/test-proxy")
async def test_proxy():
    """בדיקת פרוקסי"""
    proxy_url = get_working_proxy()
    
    if not proxy_url:
        return {"error": "No proxy credentials"}
    
    try:
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=True,
            proxy={'server': proxy_url}
        )
        context = await browser.new_context()
        page = await context.new_page()
        
        # בדוק IP
        await page.goto('http://httpbin.org/ip', timeout=10000)
        content = await page.content()
        
        # נסה partsouq
        await page.goto('https://partsouq.com', timeout=15000)
        partsouq_title = await page.title()
        
        await context.close()
        await browser.close()
        await playwright.stop()
        
        return {
            "proxy": "✅ WORKING",
            "endpoint": "gate.smartproxy.com:10000",
            "ip_check": "passed",
            "partsouq_accessible": bool(partsouq_title)
        }
        
    except Exception as e:
        return {
            "proxy": "❌ FAILED",
            "error": str(e)[:100]
        }

@app.get("/scrape/{vin}")
async def scrape_by_vin(vin: str):
    """סקרייפינג VIN"""
    
    if not vin or len(vin) < 10:
        raise HTTPException(status_code=400, detail="Invalid VIN")
    
    async with semaphore:
        logger.info(f"🚗 Scraping VIN: {vin}")
        
        url = f"https://partsouq.com/en/search/all?q={vin}"
        
        try:
            result = await UltimateScraper.scrape_with_smart_retry(url)
            result['vin'] = vin
            return result
            
        except Exception as e:
            logger.error(f"VIN scrape failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "vin": vin
            }

@app.post("/scrape-url")
async def scrape_custom_url(request: ScrapeRequest):
    """סקרייפינג URL מותאם"""
    
    async with semaphore:
        logger.info(f"🔗 Scraping URL: {request.url[:80]}")
        
        try:
            result = await UltimateScraper.scrape_with_smart_retry(request.url)
            result['identifier'] = request.identifier
            return result
            
        except Exception as e:
            logger.error(f"URL scrape failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "url": request.url[:100],
                "identifier": request.identifier
            }

@app.get("/debug-scrape/{vin}")
async def debug_scrape(vin: str):
    """דיבאג מפורט של סקרייפינג"""
    
    steps = []
    url = f"https://partsouq.com/en/search/all?q={vin}"
    
    try:
        # Step 1: Proxy check
        proxy_url = get_working_proxy()
        steps.append({
            "step": "proxy_setup",
            "has_proxy": bool(proxy_url),
            "endpoint": "gate.smartproxy.com:10000" if proxy_url else None
        })
        
        # Step 2: Browser creation
        playwright, browser, context = await UltimateScraper.create_stealth_browser(True)
        steps.append({"step": "browser_created", "success": True})
        
        # Step 3: Page creation
        page = await context.new_page()
        steps.append({"step": "page_created", "success": True})
        
        # Step 4: Navigation
        try:
            response = await page.goto(url, wait_until='domcontentloaded', timeout=30000)
            steps.append({
                "step": "navigation",
                "status": response.status if response else "no_response",
                "url": page.url
            })
        except Exception as nav_error:
            steps.append({
                "step": "navigation_error",
                "error": str(nav_error)[:100]
            })
        
        # Step 5: Wait and check
        await asyncio.sleep(5)
        content = await page.content()
        
        steps.append({
            "step": "content_check",
            "size": len(content),
            "has_cloudflare": "cloudflare" in content.lower(),
            "has_partsouq": "partsouq" in content.lower(),
            "sample": content[:200]
        })
        
        # Cleanup
        await context.close()
        await browser.close()
        await playwright.stop()
        
    except Exception as e:
        steps.append({
            "step": "fatal_error",
            "error": str(e)
        })
    
    return {
        "vin": vin,
        "url": url,
        "debug_steps": steps
    }

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 10000))
    
    logger.info("=" * 60)
    logger.info("🚀 Partsouq Scraper Ultimate v8.0")
    logger.info(f"📍 Port: {port}")
    logger.info(f"🌐 Proxy: gate.smartproxy.com:10000")
    logger.info(f"🔧 Concurrency: {CONCURRENCY_LIMIT}")
    logger.info("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        log_level="info"
    )
