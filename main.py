"""
Partsouq Simple Scraper - בלי Selenium
גישה פשוטה עם requests בלבד
"""

from fastapi import FastAPI, HTTPException
import os
import time
import requests
import logging
from fake_useragent import UserAgent

# הגדרת logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq Simple Scraper",
    description="API פשוט לסקרייפינג Partsouq עם requests",
    version="1.0.0"
)

# הגדרות
PROXY_CONFIG = "smart-byparr:1209QWEasdzxcv@gate.smartproxy.com:10000"
ua = UserAgent()

@app.get("/")
def root():
    """בדיקת חיבור בסיסית"""
    return {
        "message": "🚀 Partsouq Simple Scraper",
        "status": "online",
        "version": "1.0.0",
        "mode": "requests_only",
        "proxy_configured": bool(PROXY_CONFIG)
    }

@app.get("/health")  
def health():
    """בדיקת בריאות המערכת"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "proxy": "configured" if PROXY_CONFIG else "not configured"
    }

@app.get("/test-proxy")
def test_proxy():
    """בדיקת חיבור הפרוקסי"""
    
    proxy_dict = {
        'http': f'http://{PROXY_CONFIG}',
        'https': f'http://{PROXY_CONFIG}'
    }
    
    try:
        logger.info("Testing proxy connection...")
        response = requests.get(
            'http://httpbin.org/ip', 
            proxies=proxy_dict, 
            timeout=15
        )
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Proxy test successful: {result}")
            return {
                "proxy_status": "working",
                "ip_address": result.get('origin'),
                "response_time": response.elapsed.total_seconds()
            }
        else:
            return {
                "proxy_status": "failed",
                "status_code": response.status_code
            }
            
    except Exception as e:
        logger.error(f"Proxy test failed: {str(e)}")
        return {
            "proxy_status": "error",
            "error": str(e)
        }

@app.get("/scrape-simple/{vin}")
def scrape_simple(vin: str):
    """סקרייפינג פשוט עם requests"""
    
    proxy_dict = {
        'http': f'http://{PROXY_CONFIG}',
        'https': f'http://{PROXY_CONFIG}'
    }
    
    headers = {
        'User-Agent': ua.chrome,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }
    
    url = f"https://partsouq.com/en/search/all?q={vin}"
    
    try:
        logger.info(f"Scraping VIN: {vin}")
        
        # בקשה 1: עמוד הבית
        logger.info("Step 1: Home page")
        home_response = requests.get(
            'https://partsouq.com',
            proxies=proxy_dict,
            headers=headers,
            timeout=20,
            allow_redirects=True
        )
        
        if home_response.status_code != 200:
            return {
                "success": False,
                "error": f"Home page failed: {home_response.status_code}"
            }
        
        # המתנה
        time.sleep(3)
        
        # עדכון headers עם referer
        headers['Referer'] = 'https://partsouq.com/'
        
        # בקשה 2: חיפוש VIN
        logger.info(f"Step 2: Search VIN - {url}")
        search_response = requests.get(
            url,
            proxies=proxy_dict,
            headers=headers,
            timeout=20,
            allow_redirects=True
        )
        
        # ניתוח תוצאות
        content = search_response.text
        content_lower = content.lower()
        
        analysis = {
            'status_code': search_response.status_code,
            'content_size': len(content),
            'has_partsouq': 'partsouq' in content_lower,
            'has_vin': vin.lower() in content_lower,
            'has_parts': 'part' in content_lower,
            'has_products': 'product' in content_lower,
            'has_cloudflare': 'cloudflare' in content_lower or 'just a moment' in content_lower,
            'response_time': search_response.elapsed.total_seconds()
        }
        
        logger.info(f"Analysis: {analysis}")
        
        return {
            "success": search_response.status_code == 200,
            "vin": vin,
            "url": url,
            "final_url": search_response.url,
            "analysis": analysis,
            "sample_content": content[:500] if len(content) > 500 else content
        }
        
    except Exception as e:
        logger.error(f"Scraping failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "vin": vin,
            "url": url
        }

@app.get("/test-partsouq-basic")
def test_partsouq_basic():
    """בדיקה בסיסית של Partsouq"""
    
    proxy_dict = {
        'http': f'http://{PROXY_CONFIG}',
        'https': f'http://{PROXY_CONFIG}'
    }
    
    headers = {
        'User-Agent': ua.chrome,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    
    try:
        logger.info("Testing basic Partsouq access...")
        response = requests.get(
            'https://partsouq.com', 
            proxies=proxy_dict,
            headers=headers,
            timeout=15,
            allow_redirects=True
        )
        
        content_lower = response.text.lower()
        
        return {
            "test_status": "completed",
            "status_code": response.status_code,
            "content_size": len(response.text),
            "has_partsouq_content": 'partsouq' in content_lower,
            "has_cloudflare": 'cloudflare' in content_lower,
            "response_time": response.elapsed.total_seconds(),
            "success": response.status_code == 200 and 'partsouq' in content_lower
        }
        
    except Exception as e:
        logger.error(f"Basic test failed: {str(e)}")
        return {
            "test_status": "failed",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 10000))
    
    logger.info(f"🚀 Starting Simple Partsouq Scraper on port {port}")
    logger.info(f"📍 Proxy configured: {bool(PROXY_CONFIG)}")
    
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=port,
        log_level="info"
    )
