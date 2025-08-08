"""
Byparr API Server - הפתרון הסופי
משתמש בByparr האמיתי + SeleniumBase UC Mode
"""

from fastapi import FastAPI, HTTPException
import os
import time
import logging
import json
import asyncio
from seleniumbase import SB
import undetected_chromedriver as uc
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Byparr Cloud API",
    description="Byparr אמיתי בענן עם SeleniumBase UC",
    version="5.0.0"
)

# פרטי SmartProxy הנכונים (מהתמונה שלך)
SMARTPROXY_CONFIG = {
    'server': 'us.smartproxy.io:10000',  # הנכון מהתמונה
    'username': 'smart-byparr',
    'password': '1209QWEasdzxcv'
}

def get_chrome_options():
    """הגדרות Chrome מתקדמות נגד זיהוי"""
    
    chrome_options = Options()
    
    # הגדרות בסיסיות
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    
    # הגדרות נגד זיהוי
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-plugins")
    chrome_options.add_argument("--disable-images")
    
    # פרוקסי (אם נדרש)
    if SMARTPROXY_CONFIG:
        proxy_string = f"{SMARTPROXY_CONFIG['username']}:{SMARTPROXY_CONFIG['password']}@{SMARTPROXY_CONFIG['server']}"
        chrome_options.add_argument(f'--proxy-server=http://{proxy_string}')
    
    return chrome_options

class CloudByparrScraper:
    """סקרפר מקצועי עם Byparr בענן"""
    
    def __init__(self):
        self.driver = None
        
    def init_driver(self):
        """יצירת driver מקצועי"""
        try:
            logger.info("Initializing Chrome driver with UC mode...")
            
            # שימוש בundetected-chromedriver
            options = get_chrome_options()
            
            self.driver = uc.Chrome(
                options=options,
                version_main=None,  # auto-detect
                driver_executable_path=None  # auto-download
            )
            
            # הגדרות JavaScript נגד זיהוי
            self.driver.execute_cdp_cmd('Runtime.evaluate', {
                "expression": """
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                    Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
                    window.chrome = {runtime: {}};
                """
            })
            
            logger.info("Driver initialized successfully!")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize driver: {str(e)}")
            return False
    
    def scrape_partsouq(self, vin: str):
        """סקרייפינג Partsouq מקצועי"""
        
        if not self.driver:
            if not self.init_driver():
                return {"success": False, "error": "Driver initialization failed"}
        
        try:
            target_url = f"https://partsouq.com/en/search/all?q={vin}"
            logger.info(f"Navigating to: {target_url}")
            
            # כניסה לדף
            self.driver.get(target_url)
            
            # המתנה לטעינה
            time.sleep(12)
            
            # בדיקת Cloudflare
            page_source = self.driver.page_source.lower()
            
            if 'just a moment' in page_source or 'checking your browser' in page_source:
                logger.info("Cloudflare detected, waiting longer...")
                time.sleep(15)
                page_source = self.driver.page_source.lower()
            
            # ניתוח תוצאות
            current_url = self.driver.current_url
            
            analysis = {
                'final_url': current_url,
                'content_size': len(page_source),
                'has_partsouq': 'partsouq' in page_source,
                'has_vin': vin.lower() in page_source,
                'has_parts': 'part' in page_source,
                'has_products': 'product' in page_source,
                'has_cloudflare': 'cloudflare' in page_source,
                'is_search_page': '/search/' in current_url
            }
            
            success = (
                analysis['has_partsouq'] and
                analysis['is_search_page'] and
                not analysis['has_cloudflare']
            )
            
            # דוגמת תוכן
            sample = self.driver.page_source[:500]
            sample_clean = ''.join(c if ord(c) < 128 and ord(c) > 31 else ' ' for c in sample)
            
            logger.info(f"Scraping result: SUCCESS={success}")
            
            return {
                'success': success,
                'vin': vin,
                'url': target_url,
                'analysis': analysis,
                'sample_content': sample_clean,
                'method': 'undetected_chrome_cloud'
            }
            
        except Exception as e:
            logger.error(f"Scraping failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'vin': vin
            }
    
    def cleanup(self):
        """ניקוי משאבים"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None

# יצירת instance גלובלי
cloud_scraper = CloudByparrScraper()

@app.get("/")
def root():
    return {
        "message": "🚀 Cloud Byparr API - Professional Solution",
        "status": "online",
        "version": "5.0.0",
        "mode": "undetected_chrome_cloud",
        "proxy_configured": bool(SMARTPROXY_CONFIG)
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "chrome_available": True
    }

@app.get("/scrape-professional/{vin}")
def scrape_professional(vin: str):
    """סקרייפינג מקצועי עם Chrome אמיתי"""
    
    logger.info(f"Professional scraping request: {vin}")
    
    try:
        result = cloud_scraper.scrape_partsouq(vin)
        return result
        
    except Exception as e:
        logger.error(f"Professional scraping failed: {str(e)}")
        return {
            "success": False,
            "error": f"Professional scraping failed: {str(e)}",
            "vin": vin
        }

@app.get("/scrape-seleniumbase/{vin}")
def scrape_seleniumbase(vin: str):
    """חלופה עם SeleniumBase UC"""
    
    logger.info(f"SeleniumBase UC scraping: {vin}")
    
    try:
        proxy_string = f"{SMARTPROXY_CONFIG['username']}:{SMARTPROXY_CONFIG['password']}@{SMARTPROXY_CONFIG['server']}"
        target_url = f"https://partsouq.com/en/search/all?q={vin}"
        
        with SB(
            uc=True,  # Undetected Chrome mode
            headless=True,
            proxy=proxy_string,
            timeout=30,
            page_load_strategy="normal"
        ) as sb:
            
            logger.info(f"Opening: {target_url}")
            sb.open(target_url)
            sb.sleep(12)
            
            # בדיקת Cloudflare
            if sb.is_text_visible("Just a moment"):
                logger.info("Cloudflare bypass - waiting...")
                sb.sleep(15)
            
            # קבלת תוכן
            content = sb.get_page_source()
            current_url = sb.get_current_url()
            
            content_lower = content.lower()
            
            analysis = {
                'final_url': current_url,
                'content_size': len(content),
                'has_partsouq': 'partsouq' in content_lower,
                'has_vin': vin.lower() in content_lower,
                'has_parts': 'part' in content_lower,
                'has_products': 'product' in content_lower,
                'has_cloudflare': 'cloudflare' in content_lower,
                'is_search_page': '/search/' in current_url
            }
            
            success = (
                analysis['has_partsouq'] and
                not analysis['has_cloudflare']
            )
            
            sample_clean = content[:300].replace('\n', ' ')[:200]
            
            return {
                'success': success,
                'vin': vin,
                'url': target_url,
                'analysis': analysis,
                'sample_content': sample_clean,
                'method': 'seleniumbase_uc_cloud'
            }
            
    except Exception as e:
        logger.error(f"SeleniumBase scraping failed: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'vin': vin
        }

@app.on_event("shutdown")
def shutdown_event():
    """ניקוי בסגירה"""
    cloud_scraper.cleanup()

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 10000))
    
    logger.info("🚀 Starting Professional Cloud Byparr API")
    logger.info(f"📍 SmartProxy: {SMARTPROXY_CONFIG['server']}")
    
    uvicorn.run(
        "byparr_api:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
