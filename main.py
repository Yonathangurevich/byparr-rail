"""
Ultimate Partsouq Scraper - FIXED
תיקון הבעיות בקוד
"""

from fastapi import FastAPI, HTTPException
import os
import time
import requests
import logging
import json
import random
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ultimate Partsouq Scraper - FIXED",
    description="תיקון הבעיות",
    version="4.1.0"
)

# SmartProxy configs (רק אלה שעובדים)
PROXY_CONFIGS = [
    "http://smart-byparr:1209QWEasdzxcv@proxy.smartproxy.net:3120",
    "http://smart-byparr:1209QWEasdzxcv@proxy.smartproxy.net:3121",
]

class AdvancedScraper:
    def __init__(self):
        self.session = None
        self.init_session()
    
    def init_session(self):
        """יצירת session מתקדם"""
        self.session = requests.Session()
        
        # Retry strategy
        retry_strategy = Retry(
            total=2,  # פחות retries
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
    def get_real_headers(self):
        """Headers אמיתיים"""
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate', 
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Sec-CH-UA': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-CH-UA-Mobile': '?0',
            'Sec-CH-UA-Platform': '"Windows"',
            'Cache-Control': 'max-age=0',
            'DNT': '1',
        }
    
    def try_proxy(self, proxy_url):
        """בדיקת proxy"""
        try:
            test_response = self.session.get(
                'http://httpbin.org/ip',
                proxies={'http': proxy_url, 'https': proxy_url},
                timeout=15,
                headers=self.get_real_headers()
            )
            
            if test_response.status_code == 200:
                ip_info = test_response.json()
                return ip_info.get('origin'), True
            return None, False
            
        except Exception as e:
            logger.warning(f"Proxy test failed: {str(e)}")
            return None, False
    
    def find_working_proxy(self):
        """מציאת proxy עובד"""
        for proxy_url in PROXY_CONFIGS:
            ip, works = self.try_proxy(proxy_url)
            if works:
                logger.info(f"Using proxy: {proxy_url} -> {ip}")
                return proxy_url, ip
        
        logger.warning("No proxy works, going direct")
        return None, "direct"
    
    def scrape_with_fallback(self, target_url):
        """סקרייפינג עם fallback"""
        
        # ניסיון 1: עם proxy
        working_proxy, ip = self.find_working_proxy()
        
        for attempt in range(3):  # 3 ניסיונות
            try:
                logger.info(f"Attempt {attempt + 1}: {target_url}")
                
                proxy_dict = None
                if working_proxy:
                    proxy_dict = {'http': working_proxy, 'https': working_proxy}
                    logger.info(f"Using proxy: {ip}")
                else:
                    logger.info("Using direct connection")
                
                # בקשה אחת פשוטה - בלי סימולציה מורכבת
                headers = self.get_real_headers()
                
                response = self.session.get(
                    target_url,
                    proxies=proxy_dict,
                    headers=headers,
                    timeout=30,  # timeout ארוך יותר
                    allow_redirects=True
                )
                
                logger.info(f"Response: {response.status_code} | Size: {len(response.text)}")
                
                return response, working_proxy, ip
                
            except requests.exceptions.Timeout:
                logger.warning(f"Timeout on attempt {attempt + 1}")
                if attempt < 2:  # אם זה לא הניסיון האחרון
                    time.sleep(2)
                    continue
                    
            except Exception as e:
                logger.error(f"Attempt {attempt + 1} failed: {str(e)}")
                if attempt < 2:
                    # נסה עם proxy אחר או בלי proxy
                    if working_proxy and attempt == 0:
                        logger.info("Trying without proxy...")
                        working_proxy, ip = None, "direct"
                    time.sleep(2)
                    continue
        
        logger.error("All attempts failed")
        return None, working_proxy, ip

scraper = AdvancedScraper()

@app.get("/")
def root():
    return {
        "message": "🚀 Ultimate Partsouq Scraper - FIXED",
        "status": "online",
        "version": "4.1.0",
        "mode": "simplified_robust"
    }

@app.get("/test-proxy-rotation")
def test_proxy_rotation():
    """בדיקת proxies"""
    results = {}
    
    for i, proxy_url in enumerate(PROXY_CONFIGS):
        ip, works = scraper.try_proxy(proxy_url)
        results[f"proxy_{i+1}"] = {
            "url": proxy_url.replace("1209QWEasdzxcv", "***"),  # הסתרת סיסמה
            "working": works,
            "ip": ip
        }
    
    return {
        "proxy_test_results": results,
        "working_proxies": sum(1 for r in results.values() if r["working"])
    }

@app.get("/scrape-ultimate/{vin}")
def scrape_ultimate(vin: str):
    """סקרייפינג מתוקן"""
    
    try:
        logger.info(f"Scraping VIN: {vin}")
        
        target_url = f"https://partsouq.com/en/search/all?q={vin}"
        
        # סקרייפינג עם fallback
        response, proxy_used, ip = scraper.scrape_with_fallback(target_url)
        
        if not response:
            return {
                "success": False,
                "error": "All scraping attempts failed",
                "vin": vin,
                "url": target_url
            }
        
        # ניתוח
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
            'is_cloudflare': 'cloudflare' in content_lower or 'just a moment' in content_lower,
            'is_blocked': response.status_code in [403, 429, 451],
            'cookies_received': len(response.cookies),
            'final_url': response.url
        }
        
        # sample נקי
        try:
            sample = content[:300]
            # ניקוי תווים מוזרים
            sample_clean = ''.join(c if ord(c) < 128 and ord(c) > 31 else ' ' for c in sample)
            sample_clean = ' '.join(sample_clean.split())  # ניקוי רווחים
        except:
            sample_clean = "Content contains special characters"
        
        # הערכת הצלחה
        success = (
            response.status_code == 200 and 
            analysis['has_partsouq'] and 
            not analysis['is_blocked'] and
            not analysis['is_cloudflare']
        )
        
        logger.info(f"Final result: SUCCESS={success} | Status={response.status_code} | Partsouq={analysis['has_partsouq']} | Blocked={analysis['is_blocked']}")
        
        return {
            "success": success,
            "vin": vin,
            "url": target_url,
            "analysis": analysis,
            "sample_content": sample_clean,
            "method": "fixed_ultimate_scraper",
            "debug_info": {
                "proxy_worked": bool(proxy_used),
                "ip_address": ip,
                "content_preview": sample_clean[:100]
            }
        }
        
    except Exception as e:
        logger.error(f"Scraping failed completely: {str(e)}")
        return {
            "success": False,
            "error": f"Exception: {str(e)}",
            "vin": vin,
            "url": target_url if 'target_url' in locals() else None
        }

@app.get("/health")
def health():
    return {"status": "healthy", "timestamp": time.time()}

@app.get("/test-simple-request/{vin}")
def test_simple_request(vin: str):
    """בדיקה פשוטה מאוד"""
    try:
        url = f"https://partsouq.com/en/search/all?q={vin}"
        
        response = requests.get(
            url, 
            timeout=20,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        
        return {
            "simple_test": True,
            "status_code": response.status_code,
            "content_size": len(response.text),
            "has_partsouq": 'partsouq' in response.text.lower(),
            "url": url
        }
    except Exception as e:
        return {
            "simple_test": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 10000))
    logger.info("🚀 Starting FIXED Ultimate Partsouq Scraper")
    uvicorn.run("main:app", host="0.0.0.0", port=port)
