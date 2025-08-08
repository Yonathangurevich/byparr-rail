"""
Partsouq Playwright Scraper - Production Ready
עובד מושלם על Render/Railway
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import time
import logging
import asyncio
import random
from typing import Optional, Dict, Any
from playwright.async_api import async_playwright, Error as PlaywrightError

# הגדרת לוגינג
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq Scraper Production",
    description="Professional scraper with Residential proxy support",
    version="7.0.0"
)

# קבלת פרטי פרוקסי מ-ENV בלבד
SMARTPROXY_USER = os.getenv('SMARTP_USER', '')
SMARTPROXY_PASS = os.getenv('SMARTP_PASS', '')

# Residential Gateway endpoints - הנכונים!
def get_proxy_endpoints():
    """יצירת רשימת פרוקסי endpoints"""
    if not SMARTPROXY_USER or not SMARTPROXY_PASS:
        logger.warning("No proxy credentials found in ENV")
        return []
    
    endpoints = []
    
    # Residential Gateway - העיקרי
    endpoints.append(
        f"http://{SMARTPROXY_USER}:{SMARTPROXY_PASS}@gate.smartproxy.com:7000"
    )
    
    # עם sticky session
    for i in range(3):
        session_id = random.randint(10000, 99999)
        endpoints.append(
            f"http://{SMARTPROXY_USER}-session-{session_id}:{SMARTPROXY_PASS}@gate.smartproxy.com:7000"
        )
    
    # Fallback - הישן שלך
    endpoints.append(
        f"http://{SMARTPROXY_USER}:{SMARTPROXY_PASS}@proxy.smartproxy.net:3120"
    )
    
    return endpoints

# Semaphore להגבלת מקביליות
CONCURRENCY_LIMIT = int(os.getenv('CONCURRENCY_LIMIT', '2'))
semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)

# Request model
class ScrapeRequest(BaseModel):
    url: str
    identifier: Optional[str] = "custom"

class StealthScraper:
    """מחלקת סקרייפר מקצועית עם כל התיקונים"""
    
    @staticmethod
    def get_stealth_script():
        """סקריפט stealth מתקדם"""
        return """
        // הסרת webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        
        // הוספת Chrome object
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };
        
        // תיקון plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer'},
                {name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai'},
                {name: 'Native Client', filename: 'internal-nacl-plugin'}
            ]
        });
        
        // תיקון languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en']
        });
        
        // הסתרת automation
        Object.defineProperty(navigator, 'permissions', {
            get: () => ({
                query: () => Promise.resolve({state: 'granted'})
            })
        });
        
        // תיקון WebGL
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
        """
    
    @staticmethod
    async def create_browser(proxy_url: Optional[str] = None):
        """יצירת browser עם כל התיקונים"""
        playwright = None
        browser = None
        
        try:
            playwright = await async_playwright().start()
            
            # הגדרות browser
            launch_options = {
                'headless': True,
                'args': [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',  # חשוב ל-containers
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-blink-features=AutomationControlled'
                ]
            }
            
            # הוספת proxy אם יש
            if proxy_url:
                try:
                    # ניקוי ה-URL לצורך לוג
                    safe_url = proxy_url.split('@')[0].split('//')[1].split(':')[0] if '@' in proxy_url else 'proxy'
                    logger.info(f"Using proxy: {safe_url}@***")
                    launch_options['proxy'] = {'server': proxy_url}
                except Exception as e:
                    logger.warning(f"Proxy setup failed: {e}")
            
            # יצירת browser
            browser = await playwright.chromium.launch(**launch_options)
            
            # יצירת context עם stealth
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                locale='en-US',
                timezone_id='America/New_York',
                device_scale_factor=1,
                is_mobile=False,
                has_touch=False,
                java_script_enabled=True
            )
            
            # הזרקת stealth script
            await context.add_init_script(StealthScraper.get_stealth_script())
            
            return playwright, browser, context
            
        except Exception as e:
            logger.error(f"Browser creation failed: {e}")
            # ניקוי במקרה של כשל
            if browser:
                await browser.close()
            if playwright:
                await playwright.stop()
            raise
    
    @staticmethod
    async def scrape_with_retry(url: str, max_retries: int = 2) -> Dict[str, Any]:
        """סקרייפינג עם retry logic מתקדם"""
        
        proxy_endpoints = get_proxy_endpoints()
        last_error = None
        
        # נסה עם proxy
        if proxy_endpoints:
            for attempt in range(max_retries):
                proxy_url = random.choice(proxy_endpoints)
                logger.info(f"Attempt {attempt + 1} with proxy")
                
                try:
                    result = await StealthScraper._perform_scrape(url, proxy_url)
                    if result['success']:
                        return result
                    last_error = result.get('error', 'Unknown error')
                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"Proxy attempt {attempt + 1} failed: {e}")
                
                await asyncio.sleep(2)  # המתנה בין ניסיונות
        
        # נסה בלי proxy כ-fallback
        logger.info("Trying without proxy as fallback...")
        try:
            result = await StealthScraper._perform_scrape(url, None)
            if result['success']:
                return result
        except Exception as e:
            last_error = str(e)
        
        # החזר כשלון עם הטעות האחרונה
        return {
            'success': False,
            'error': f'All attempts failed. Last error: {last_error}',
            'url': url
        }
    
    @staticmethod
    async def _perform_scrape(url: str, proxy_url: Optional[str]) -> Dict[str, Any]:
        """ביצוע הסקרייפינג עצמו"""
        playwright = None
        browser = None
        context = None
        
        try:
            # יצירת browser
            playwright, browser, context = await StealthScraper.create_browser(proxy_url)
            
            # יצירת page
            page = await context.new_page()
            
            # הגדרת timeout handlers
            page.set_default_timeout(25000)
            page.set_default_navigation_timeout(25000)
            
            # ניווט
            logger.info(f"Navigating to: {url[:100]}...")
            response = await page.goto(url, wait_until='domcontentloaded')
            
            # בדיקת סטטוס
            if response and response.status >= 400:
                logger.warning(f"HTTP {response.status} received")
            
            # המתנה לטעינה
            await asyncio.sleep(5)
            
            # בדיקת Cloudflare
            content = await page.content()
            content_lower = content.lower()
            
            if 'just a moment' in content_lower or 'checking your browser' in content_lower:
                logger.info("Cloudflare detected, waiting 10s...")
                await asyncio.sleep(10)
                
                # נסה לחכות לאלמנט ספציפי
                try:
                    await page.wait_for_selector('body', state='visible', timeout=5000)
                except:
                    pass
                
                content = await page.content()
                content_lower = content.lower()
            
            # ניתוח התוכן
            current_url = page.url
            
            # חילוץ VIN אם קיים
            vin = None
            if 'q=' in url:
                try:
                    vin = url.split('q=')[1].split('&')[0]
                except:
                    pass
            
            # ניתוח מפורט
            analysis = {
                'final_url': current_url,
                'content_size': len(content),
                'has_partsouq': 'partsouq' in content_lower,
                'has_vin': vin.lower() in content_lower if vin else False,
                'has_parts': 'part' in content_lower,
                'has_catalog': 'catalog' in content_lower,
                'has_search': '/search/' in current_url or '/catalog/' in current_url,
                'has_cloudflare': any(cf in content_lower for cf in ['cloudflare', 'just a moment', 'checking your browser']),
                'has_error': 'error' in content_lower or '404' in content,
                'proxy_used': bool(proxy_url),
                'http_status': response.status if response else None
            }
            
            # קביעת הצלחה
            success = (
                analysis['has_partsouq'] and
                not analysis['has_cloudflare'] and
                not analysis['has_error'] and
                (analysis['has_search'] or analysis['has_catalog'])
            )
            
            # דוגמת תוכן
            sample = content[:500]
            sample_clean = ''.join(c if 32 <= ord(c) < 127 else ' ' for c in sample)
            sample_clean = ' '.join(sample_clean.split())[:200]
            
            return {
                'success': success,
                'url': url,
                'vin': vin,
                'final_url': current_url,
                'analysis': analysis,
                'sample_content': sample_clean,
                'timestamp': time.time()
            }
            
        except PlaywrightError as e:
            logger.error(f"Playwright error: {e}")
            return {
                'success': False,
                'error': f'Playwright error: {str(e)}',
                'url': url
            }
        except Exception as e:
            logger.error(f"Scraping error: {e}")
            return {
                'success': False,
                'error': str(e),
                'url': url
            }
        finally:
            # ניקוי משאבים
            try:
                if context:
                    await context.close()
                if browser:
                    await browser.close()
                if playwright:
                    await playwright.stop()
            except:
                pass

# API Endpoints

@app.get("/")
async def root():
    """בדיקת סטטוס בסיסית"""
    return {
        "service": "Partsouq Scraper Production",
        "status": "online",
        "version": "7.0.0",
        "features": {
            "proxy": "smartproxy_residential",
            "browser": "playwright_chromium",
            "stealth": "advanced",
            "concurrency_limit": CONCURRENCY_LIMIT
        },
        "endpoints": [
            "/health",
            "/scrape/{vin}",
            "/scrape-url",
            "/test-browser"
        ]
    }

@app.get("/health")
async def health_check():
    """בדיקת בריאות מתקדמת"""
    checks = {
        "status": "healthy",
        "timestamp": time.time(),
        "proxy_configured": bool(SMARTPROXY_USER and SMARTPROXY_PASS),
        "concurrency_limit": CONCURRENCY_LIMIT,
        "active_tasks": CONCURRENCY_LIMIT - semaphore._value
    }
    
    # בדיקת יכולת יצירת browser
    try:
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(headless=True)
        await browser.close()
        await playwright.stop()
        checks["browser_test"] = "passed"
    except Exception as e:
        checks["browser_test"] = f"failed: {str(e)}"
        checks["status"] = "degraded"
    
    return checks

@app.get("/scrape/{vin}")
async def scrape_by_vin(vin: str):
    """סקרייפינג לפי VIN"""
    
    if not vin or len(vin) < 10:
        raise HTTPException(status_code=400, detail="Invalid VIN format")
    
    async with semaphore:
        logger.info(f"Processing VIN: {vin}")
        
        url = f"https://partsouq.com/en/search/all?q={vin}"
        
        try:
            result = await StealthScraper.scrape_with_retry(url)
            result['vin'] = vin
            result['method'] = 'vin_search'
            return result
            
        except Exception as e:
            logger.error(f"VIN scrape error: {e}")
            return {
                "success": False,
                "error": str(e),
                "vin": vin
            }

@app.post("/scrape-url")
async def scrape_custom_url(request: ScrapeRequest):
    """סקרייפינג URL מותאם אישית"""
    
    if not request.url:
        raise HTTPException(status_code=400, detail="URL is required")
    
    # וידוא שזה URL של partsouq
    if 'partsouq.com' not in request.url.lower():
        logger.warning(f"Non-partsouq URL requested: {request.url}")
    
    async with semaphore:
        logger.info(f"Processing custom URL: {request.url[:100]}")
        
        try:
            result = await StealthScraper.scrape_with_retry(request.url)
            result['identifier'] = request.identifier
            result['method'] = 'custom_url'
            return result
            
        except Exception as e:
            logger.error(f"Custom URL scrape error: {e}")
            return {
                "success": False,
                "error": str(e),
                "url": request.url[:100],
                "identifier": request.identifier
            }

@app.get("/test-browser")
async def test_browser():
    """בדיקת יכולת הרצת browser"""
    
    try:
        # נסה ליצור browser
        playwright, browser, context = await StealthScraper.create_browser()
        
        # נסה לטעון דף פשוט
        page = await context.new_page()
        await page.goto('http://httpbin.org/user-agent', timeout=10000)
        content = await page.content()
        
        # ניקוי
        await context.close()
        await browser.close()
        await playwright.stop()
        
        return {
            "test": "success",
            "browser": "chromium",
            "content_length": len(content),
            "message": "Browser works correctly"
        }
        
    except Exception as e:
        logger.error(f"Browser test failed: {e}")
        return {
            "test": "failed",
            "error": str(e),
            "message": "Check Docker configuration"
        }

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 10000))
    
    logger.info("=" * 50)
    logger.info("🚀 Partsouq Scraper Production v7.0.0")
    logger.info(f"📍 Port: {port}")
    logger.info(f"🔧 Concurrency: {CONCURRENCY_LIMIT}")
    logger.info(f"🌐 Proxy: {'Configured' if SMARTPROXY_USER else 'Not configured'}")
    logger.info("=" * 50)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        workers=1,  # חשוב - רק worker אחד
        log_level="info"
    )
