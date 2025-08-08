"""
Partsouq Simple Scraper - תיקון פרוקסי
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

# הגדרות פרוקסי - תוקן!
PROXY_URL = "http://smart-byparr:1209QWEasdzxcv@gate.smartproxy.com:10000"
ua = UserAgent()

def get_proxy_dict():
    """קבלת הגדרות פרוקסי נכונות"""
    return {
        'http': PROXY_URL,
        'https': PROXY_URL
    }

def get_headers():
    """קבלת headers מתקדמים"""
    return {
        'User-Agent': ua.chrome,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-CH-UA': '"Not A(Brand";v="99", "Chromium";v="121", "Google Chrome";v="121"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"'
    }

@app.get("/")
def root():
    """בדיקת חיבור בסיסית"""
    return {
        "message": "🚀 Partsouq Simple Scraper",
        "status": "online",
        "version": "1.0.0",
        "mode": "requests_only",
        "proxy_configured": bool(PROXY_URL)
    }

@app.get("/health")  
def health():
    """בדיקת בריאות המערכת"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "proxy": "configured" if PROXY_URL else "not configured"
    }

@app.get("/test-proxy")
def test_proxy():
    """בדיקת חיבור הפרוקסי"""
    
    try:
        logger.info("Testing proxy connection...")
        
        # בדיקה עם httpbin
        response = requests.get(
            'http://httpbin.org/ip', 
            proxies=get_proxy_dict(), 
            timeout=20,
            headers={'User-Agent': ua.chrome}
        )
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Proxy test successful: {result}")
            return {
                "proxy_status": "working",
                "ip_address": result.get('origin'),
                "response_time": response.elapsed.total_seconds(),
                "proxy_url": PROXY_URL
            }
        else:
            return {
                "proxy_status": "failed",
                "status_code": response.status_code,
                "proxy_url": PROXY_URL
            }
            
    except Exception as e:
        logger.error(f"Proxy test failed: {str(e)}")
        return {
            "proxy_status": "error",
            "error": str(e),
            "proxy_url": PROXY_URL
        }

@app.get("/test-no-proxy")
def test_no_proxy():
    """בדיקה בלי פרוקסי - לוודא שהשירות עובד"""
    
    try:
        response = requests.get(
            'http://httpbin.org/ip', 
            timeout=15,
            headers={'User-Agent': ua.chrome}
        )
        
        if response.status_code == 200:
            result = response.json()
            return {
                "no_proxy_status": "working",
                "ip_address": result.get('origin'),
                "response_time": response.elapsed.total_seconds()
            }
        else:
            return {
                "no_proxy_status": "failed",
                "status_code": response.status_code
            }
            
    except Exception as e:
        return {
            "no_proxy_status": "error",
            "error": str(e)
        }

@app.get("/scrape-simple/{vin}")
def scrape_simple(vin: str):
    """סקרייפינג פשוט עם requests"""
    
    try:
        logger.info(f"Scraping VIN: {vin}")
        
        # ניסיון ראשון עם פרוקסי
        try:
            url = f"https://partsouq.com/en/search/all?q={vin}"
            
            # בקשה עם פרוקסי
            response = requests.get(
                url,
                proxies=get_proxy_dict(),
                headers=get_headers(),
                timeout=25,
                allow_redirects=True
            )
            
            proxy_used = True
            
        except Exception as proxy_error:
            logger.warning(f"Proxy failed: {proxy_error}, trying without proxy...")
            
            # ניסיון בלי פרוקסי
            response = requests.get(
                url,
                headers=get_headers(),
                timeout=20,
                allow_redirects=True
            )
            
            proxy_used = False
        
        # ניתוח תוצאות
        content = response.text
        content_lower = content.lower()
        
        analysis = {
            'status_code': response.status_code,
            'content_size': len(content),
            'proxy_used': proxy_used,
            'has_partsouq': 'partsouq' in content_lower,
            'has_vin': vin.lower() in content_lower,
            'has_parts': 'part' in content_lower,
            'has_products': 'product' in content_lower,
            'has_cloudflare': 'cloudflare' in content_lower or 'just a moment' in content_lower,
            'response_time': response.elapsed.total_seconds()
        }
        
        logger.info(f"Analysis: {analysis}")
        
        # דוח הצלחה
        success = (
            response.status_code == 200 and 
            'partsouq' in content_lower and
            'cloudflare' not in content_lower
        )
        
        return {
            "success": success,
            "vin": vin,
            "url": url,
            "final_url": response.url,
            "analysis": analysis,
            "sample_content": content[:300] if len(content) > 300 else content
        }
        
    except Exception as e:
        logger.error(f"Scraping failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "vin": vin,
            "url": url if 'url' in locals() else None
        }

@app.get("/test-partsouq-basic")
def test_partsouq_basic():
    """בדיקה בסיסית של Partsouq"""
    
    try:
        logger.info("Testing basic Partsouq access...")
        
        # ניסיון עם פרוקסי
        try:
            response = requests.get(
                'https://partsouq.com', 
                proxies=get_proxy_dict(),
                headers=get_headers(),
                timeout=20,
                allow_redirects=True
            )
            proxy_used = True
            
        except Exception as proxy_error:
            logger.warning(f"Proxy failed, trying without: {proxy_error}")
            
            # ניסיון בלי פרוקסי
            response = requests.get(
                'https://partsouq.com', 
                headers=get_headers(),
                timeout=15,
                allow_redirects=True
            )
            proxy_used = False
        
        content_lower = response.text.lower()
        
        return {
            "test_status": "completed",
            "status_code": response.status_code,
            "content_size": len(response.text),
            "proxy_used": proxy_used,
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
    logger.info(f"📍 Proxy URL: {PROXY_URL}")
    
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=port,
        log_level="info"
    )
