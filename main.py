"""
Ultimate Partsouq Scraper
מחקה את Byparr המקומי - כל הטריקים
"""

from fastapi import FastAPI, HTTPException
import os
import time
import requests
import logging
import json
import random
import base64
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ultimate Partsouq Scraper",
    description="מחקה Byparr מקומי",
    version="4.0.0"
)

# SmartProxy residential (נסה endpoint אחר)
PROXY_CONFIGS = [
    "http://smart-byparr:1209QWEasdzxcv@proxy.smartproxy.net:3120",      # הנוכחי
    "http://smart-byparr:1209QWEasdzxcv@proxy.smartproxy.net:3121",      # residential
    "http://smart-byparr:1209QWEasdzxcv@residential.smartproxy.net:3120", # residential direct
]

class AdvancedScraper:
    def __init__(self):
        self.session = None
        self.proxy_index = 0
        self.init_session()
    
    def init_session(self):
        """יצירת session מתקדם כמו Byparr"""
        self.session = requests.Session()
        
        # Retry strategy כמו דפדפן
        retry_strategy = Retry(
            total=3,
            backoff_factor=2,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=10,
            pool_maxsize=20
        )
        
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # הגדרות SSL כמו Chrome
        self.session.verify = True
        
    def get_real_headers(self):
        """Headers שמחקים Chrome אמיתי"""
        
        windows_versions = ["10.0", "11.0"]
        chrome_versions = ["121.0.0.0", "120.0.0.0", "119.0.0.0"]
        
        os_version = random.choice(windows_versions)
        chrome_version = random.choice(chrome_versions)
        
        return {
            'User-Agent': f'Mozilla/5.0 (Windows NT {os_version}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome_version} Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate', 
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Sec-CH-UA': f'"Not A(Brand";v="99", "Google Chrome";v="{chrome_version.split(".")[0]}", "Chromium";v="{chrome_version.split(".")[0]}"',
            'Sec-CH-UA-Mobile': '?0',
            'Sec-CH-UA-Platform': '"Windows"',
            'Sec-CH-UA-Platform-Version': f'"{os_version}.0"',
            'Cache-Control': 'max-age=0',
            'DNT': '1',
        }
    
    def try_proxy(self, proxy_url):
        """בדיקת proxy ספציפי"""
        try:
            test_response = self.session.get(
                'http://httpbin.org/ip',
                proxies={'http': proxy_url, 'https': proxy_url},
                timeout=10,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            
            if test_response.status_code == 200:
                ip_info = test_response.json()
                return ip_info.get('origin'), True
            return None, False
            
        except Exception as e:
            logger.warning(f"Proxy {proxy_url} failed: {str(e)}")
            return None, False
    
    def find_working_proxy(self):
        """מציאת proxy שעובד"""
        for proxy_url in PROXY_CONFIGS:
            ip, works = self.try_proxy(proxy_url)
            if works:
                logger.info(f"Found working proxy: {proxy_url} -> IP: {ip}")
                return proxy_url, ip
        
        logger.warning("No working proxy found, trying without proxy")
        return None, "direct"
    
    def simulate_real_browsing(self, target_url):
        """סימולציה של גלישה אמיתית כמו Byparr"""
        
        # מציאת proxy שעובד
        working_proxy, ip = self.find_working_proxy()
        proxy_dict = {'http': working_proxy, 'https': working_proxy} if working_proxy else None
        
        logger.info(f"Using IP: {ip}")
        
        try:
            # שלב 1: כניסה לעמוד הבית
            logger.info("Step 1: Home page visit")
            
            headers1 = self.get_real_headers()
            
            home_response = self.session.get(
                'https://partsouq.com',
                proxies=proxy_dict,
                headers=headers1,
                timeout=25,
                allow_redirects=True
            )
            
            logger.info(f"Home response: {home_response.status_code}")
            
            # שמירת cookies
            home_cookies = dict(home_response.cookies)
            logger.info(f"Got {len(home_cookies)} cookies")
            
            # המתנה אנושית
            delay = random.uniform(3, 7)
            logger.info(f"Human delay: {delay:.1f}s")
            time.sleep(delay)
            
            # שלב 2: חיפוש עם הקשר מהעמוד הקודם
            logger.info(f"Step 2: Searching {target_url}")
            
            headers2 = self.get_real_headers()
            headers2.update({
                'Referer': 'https://partsouq.com/',
                'Sec-Fetch-Site': 'same-origin',
                'Cache-Control': 'no-cache',
            })
            
            # עדכון cookies
            self.session.cookies.update(home_response.cookies)
            
            search_response = self.session.get(
                target_url,
                proxies=proxy_dict,
                headers=headers2,
                timeout=30,
                allow_redirects=True
            )
            
            return search_response, working_proxy, ip
            
        except Exception as e:
            logger.error(f"Browsing simulation failed: {str(e)}")
            return None, working_proxy, ip

scraper = AdvancedScraper()

@app.get("/")
def root():
    return {
        "message": "🚀 Ultimate Partsouq Scraper",
        "status": "online",
        "version": "4.0.0",
        "mode": "byparr_simulation",
        "proxies_available": len(PROXY_CONFIGS)
    }

@app.get("/test-proxy-rotation")
def test_proxy_rotation():
    """בדיקת כל ה-proxies"""
    results = {}
    
    for i, proxy_url in enumerate(PROXY_CONFIGS):
        ip, works = scraper.try_proxy(proxy_url)
        results[f"proxy_{i+1}"] = {
            "url": proxy_url,
            "working": works,
            "ip": ip
        }
    
    return {
        "proxy_test_results": results,
        "working_proxies": sum(1 for r in results.values() if r["working"])
    }

@app.get("/scrape-ultimate/{vin}")
def scrape_ultimate(vin: str):
    """סקרייפינג סופי - מחקה Byparr בדיוק"""
    
    try:
        logger.info(f"Ultimate scraping VIN: {vin}")
        
        target_url = f"https://partsouq.com/en/search/all?q={vin}"
        
        # סימולציה מלאה
        response, proxy_used, ip = scraper.simulate_real_browsing(target_url)
        
        if not response:
            return {
                "success": False,
                "error": "Failed to simulate browsing"
            }
        
        # ניתוח מפורט
        content = response.text
        content_lower = content.lower()
        
        analysis = {
            'status_code': response.status_code,
            'content_size': len(content),
            'ip_used': ip,
            'proxy_used': bool(proxy_used),
            'response_time': response.elapsed.total_seconds(),
            'has_partsouq': 'partsouq' in content_lower,
            'has_vin': vin.lower() in content_lower,
            'has_parts': 'part' in content_lower,
            'has_products': 'product' in content_lower,
            'has_results': 'result' in content_lower,
            'is_cloudflare': 'cloudflare' in content_lower,
            'is_blocked': response.status_code in [403, 429],
            'cookies_received': len(response.cookies),
            'final_url': response.url
        }
        
        # דוגמת תוכן (נקיה)
        sample = content[:400].encode('utf-8', errors='ignore').decode('utf-8')
        sample_clean = ''.join(char if ord(char) < 128 else '?' for char in sample)
        
        success = (
            response.status_code == 200 and 
            analysis['has_partsouq'] and 
            not analysis['is_blocked'] and
            not analysis['is_cloudflare']
        )
        
        logger.info(f"Ultimate result: {success} | Status: {response.status_code}")
        
        return {
            "success": success,
            "vin": vin,
            "url": target_url,
            "analysis": analysis,
            "sample_content": sample_clean,
            "method": "ultimate_byparr_simulation"
        }
        
    except Exception as e:
        logger.error(f"Ultimate scraping failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "vin": vin
        }

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": time.time()}

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 10000))
    
    logger.info(f"🚀 Starting Ultimate Partsouq Scraper")
    logger.info(f"📍 Available proxies: {len(PROXY_CONFIGS)}")
    
    uvicorn.run("main:app", host="0.0.0.0", port=port)
