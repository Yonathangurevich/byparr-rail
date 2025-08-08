"""
Playwright Stealth Solution - הפתרון הסופי
קל, מהיר, יעיל - בלי Chrome הבעייתי
"""

from fastapi import FastAPI, HTTPException
import os
import time
import logging
import json
import asyncio
import random
from playwright.async_api import async_playwright
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq Playwright Stealth",
    description="פתרון מקצועי עם Playwright",
    version="6.0.0"
)

# SmartProxy configs - עם רוטציה
SMARTPROXY_ENDPOINTS = [
    f"http://{os.getenv('SMARTP_USER', 'smart-byparr')}:{os.getenv('SMARTP_PASS', '1209QWEasdzxcv')}@gate.smartproxy.com:7000",
    f"http://{os.getenv('SMARTP_USER', 'smart-byparr')}:{os.getenv('SMARTP_PASS', '1209QWEasdzxcv')}@us.smartproxy.io:10000",
    f"http://{os.getenv('SMARTP_USER', 'smart-byparr')}-session-{random.randint(1000,9999)}:{os.getenv('SMARTP_PASS', '1209QWEasdzxcv')}@gate.smartproxy.com:7000"
]

class PlaywrightStealth:
    """Playwright עם אנטי-זיהוי מתקדם"""
    
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        
    async def init_browser(self, proxy_url: Optional[str] = None):
        """יצירת browser עם stealth"""
        try:
            self.playwright = await async_playwright().start()
            
            # הגדרות browser מתקדמות
            browser_options = {
                'headless': True,
                'args': [
                    '--no-sandbox',
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920,1080'
                ]
            }
            
            # הוספת proxy אם קיים
            if proxy_url:
                browser_options['proxy'] = {'server': proxy_url}
                logger.info(f"Using proxy: {proxy_url}")
            
            self.browser = await self.playwright.chromium.launch(**browser_options)
            
            # יצירת context עם stealth
            self.context = await self.browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                locale='en-US',
                timezone_id='America/New_York'
            )
            
            # הוספת stealth scripts
            await self.context.add_init_script("""
                // הסתרת webdriver
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                
                // הוספת chrome property
                window.chrome = {
                    runtime: {},
                    app: {},
                    csi: {}
                };
                
                // הסתרת automation
                delete window.navigator.__proto__.webdriver;
                
                // שינוי plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
                
                // שינוי languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en']
                });
                
                // הסתרת automation indicators  
                Object.defineProperty(navigator, 'permissions', {
                    get: () => ({
                        query: () => Promise.resolve({ state: 'granted' })
                    })
                });
            """)
            
            return True
            
        except Exception as e:
            logger.error(f"Browser init failed: {str(e)}")
            await self.cleanup()
            return False
    
    async def scrape_partsouq(self, vin: str, timeout: int = 45):
        """סקרייפינג עם Playwright"""
        
        # נסה עם proxy אקראי
        proxy_url = random.choice(SMARTPROXY_ENDPOINTS)
        
        if not await self.init_browser(proxy_url):
            logger.warning("Proxy failed, trying without proxy...")
            if not await self.init_browser():
                return {"success": False, "error": "Browser initialization failed"}
        
        try:
            page = await self.context.new_page()
            
            target_url = f"https://partsouq.com/en/search/all?q={vin}"
            logger.info(f"Navigating to: {target_url}")
            
            # כניסה עם timeout
            await page.goto(target_url, wait_until='domcontentloaded', timeout=timeout*1000)
            
            # המתנה לטעינה
            await asyncio.sleep(8)
            
            # בדיקת Cloudflare
            content = await page.content()
            content_lower = content.lower()
            
            if 'just a moment' in content_lower or 'checking your browser' in content_lower:
                logger.info("Cloudflare detected, waiting...")
                await asyncio.sleep(12)
                content = await page.content()
                content_lower = content.lower()
            
            # ניתוח תוצאות
            current_url = page.url
            
            analysis = {
                'final_url': current_url,
                'content_size': len(content),
                'has_partsouq': 'partsouq' in content_lower,
                'has_vin': vin.lower() in content_lower,
                'has_parts': 'part' in content_lower,
                'has_products': 'product' in content_lower,
                'has_results': 'result' in content_lower,
                'has_cloudflare': 'cloudflare' in content_lower,
                'is_search_page': '/search/' in current_url,
                'proxy_used': bool(proxy_url)
            }
            
            success = (
                analysis['has_partsouq'] and
                not analysis['has_cloudflare'] and
                analysis['is_search_page']
            )
            
            # sample תוכן
            sample = content[:400]
            sample_clean = ''.join(c if 32 <= ord(c) < 127 else ' ' for c in sample)
            sample_clean = ' '.join(sample_clean.split())[:200]
            
            await page.close()
            
            return {
                'success': success,
                'vin': vin,
                'url': target_url,
                'analysis': analysis,
                'sample_content': sample_clean,
                'method': 'playwright_stealth'
            }
            
        except Exception as e:
            logger.error(f"Scraping failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'vin': vin
            }
        finally:
            await self.cleanup()
    
    async def cleanup(self):
        """ניקוי משאבים"""
        try:
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self.playwright:
                await self.playwright.stop()
        except:
            pass
        
        self.context = None
        self.browser = None 
        self.playwright = None

# Endpoints
@app.get("/")
def root():
    return {
        "message": "🎭 Partsouq Playwright Stealth",
        "status": "online",
        "version": "6.0.0",
        "mode": "playwright_stealth",
        "memory_usage": "~200MB (vs Chrome 450MB)"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "browser": "playwright_chromium"
    }

@app.get("/scrape/{vin}")
async def scrape_vin(vin: str, timeout: int = 45):
    """סקרייפינג עם Playwright Stealth"""
    
    logger.info(f"Playwright scraping: {vin}")
    
    scraper = PlaywrightStealth()
    
    try:
        result = await scraper.scrape_partsouq(vin, timeout)
        return result
        
    except Exception as e:
        logger.error(f"Scrape failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "vin": vin
        }

@app.get("/scrape-fast/{vin}")
async def scrape_fast(vin: str):
    """סקרייפינג מהיר - 30 שניות timeout"""
    return await scrape_vin(vin, timeout=30)

@app.get("/test-proxy")
async def test_proxy():
    """בדיקת proxy אקראי"""
    
    scraper = PlaywrightStealth()
    proxy_url = random.choice(SMARTPROXY_ENDPOINTS)
    
    try:
        if await scraper.init_browser(proxy_url):
            page = await scraper.context.new_page()
            await page.goto('http://httpbin.org/ip', timeout=15000)
            
            content = await page.content()
            await scraper.cleanup()
            
            return {
                "proxy_test": "success",
                "proxy_url": proxy_url.split('@')[0] + "@***",  # הסתרת credentials
                "response_preview": content[:200]
            }
        else:
            return {
                "proxy_test": "failed",
                "error": "Browser init failed"
            }
            
    except Exception as e:
        await scraper.cleanup()
        return {
            "proxy_test": "failed", 
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 10000))
    
    logger.info("🎭 Starting Playwright Stealth Scraper")
    logger.info("💪 Light, Fast, Efficient!")
    
    uvicorn.run("main:app", host="0.0.0.0", port=port)
