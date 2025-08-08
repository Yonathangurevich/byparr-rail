"""
Partsouq Advanced Scraper - נגד 403 Forbidden
Headers מתקדמים + session management
"""

from fastapi import FastAPI, HTTPException
import os
import time
import requests
import logging
import random
from fake_useragent import UserAgent

# הגדרת logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq Advanced Scraper",
    description="API מתקדם עם אנטי-בוט",
    version="2.0.0"
)

# הגדרות
PROXY_URL = "http://smart-byparr:1209QWEasdzxcv@proxy.smartproxy.net:3120"
ua = UserAgent()

def get_proxy_dict():
    """קבלת הגדרות פרוקסי"""
    return {
        'http': PROXY_URL,
        'https': PROXY_URL
    }

def get_advanced_headers():
    """Headers מתקדמים נגד זיהוי automation"""
    
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
    ]
    
    return {
        'User-Agent': random.choice(user_agents),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8,ar;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Sec-CH-UA': '"Not A(Brand";v="99", "Chromium";v="121", "Google Chrome";v="121"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Pragma': 'no-cache'
    }

def create_session():
    """יצירת session מתקדם"""
    session = requests.Session()
    
    # הגדרת מתאם לretries
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    
    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    return session

@app.get("/")
def root():
    """בדיקת חיבור בסיסית"""
    return {
        "message": "🚀 Partsouq Advanced Scraper",
        "status": "online",
        "version": "2.0.0",
        "mode": "advanced_anti_bot",
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
        
        session = create_session()
        response = session.get(
            'http://httpbin.org/ip', 
            proxies=get_proxy_dict(), 
            timeout=20,
            headers=get_advanced_headers()
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
                "status_code": response.status_code
            }
            
    except Exception as e:
        logger.error(f"Proxy test failed: {str(e)}")
        return {
            "proxy_status": "error",
            "error": str(e)
        }

@app.get("/scrape-advanced/{vin}")
def scrape_advanced(vin: str):
    """סקרייפינג מתקדם עם אנטי-בוט"""
    
    try:
        logger.info(f"Advanced scraping VIN: {vin}")
        
        session = create_session()
        
        # שלב 1: כניסה לעמוד הבית (חקיקת גלישה טבעית)
        logger.info("Step 1: Visiting home page")
        
        home_headers = get_advanced_headers()
        
        home_response = session.get(
            'https://partsouq.com',
            proxies=get_proxy_dict(),
            headers=home_headers,
            timeout=25,
            allow_redirects=True
        )
        
        if home_response.status_code != 200:
            logger.warning(f"Home page status: {home_response.status_code}")
        
        # המתנה כמו משתמש אמיתי
        wait_time = random.uniform(3, 6)
        logger.info(f"Waiting {wait_time:.1f}s like a human...")
        time.sleep(wait_time)
        
        # שלב 2: חיפוש VIN עם headers מעודכנים
        logger.info("Step 2: Searching VIN")
        
        search_url = f"https://partsouq.com/en/search/all?q={vin}"
        search_headers = get_advanced_headers()
        search_headers['Referer'] = 'https://partsouq.com/'
        search_headers['Sec-Fetch-Site'] = 'same-origin'
        
        # הוספת cookies אם יש
        if home_response.cookies:
            session.cookies.update(home_response.cookies)
        
        search_response = session.get(
            search_url,
            proxies=get_proxy_dict(),
            headers=search_headers,
            timeout=30,
            allow_redirects=True
        )
        
        # ניתוח תוצאות מתקדם
        content = search_response.text
        content_lower = content.lower()
        
        # בדיקות מפורטות
        analysis = {
            'status_code': search_response.status_code,
            'content_size': len(content),
            'proxy_used': True,
            'has_partsouq': 'partsouq' in content_lower,
            'has_vin': vin.lower() in content_lower,
            'has_parts': 'part' in content_lower,
            'has_products': 'product' in content_lower,
            'has_search_results': 'search result' in content_lower or 'result' in content_lower,
            'has_cloudflare': 'cloudflare' in content_lower or 'just a moment' in content_lower,
            'is_blocked': any(block in content_lower for block in ['blocked', 'access denied', 'forbidden']),
            'response_time': search_response.elapsed.total_seconds(),
            'cookies_count': len(search_response.cookies)
        }
        
        # קבלת sample נקי יותר
        sample_content = content[:500].replace('\n', ' ').replace('\t', ' ')
        sample_content = ' '.join(sample_content.split())  # ניקוי רווחים כפולים
        
        logger.info(f"Advanced analysis: {analysis}")
        
        # הגדרת הצלחה
        success = (
            search_response.status_code == 200 and 
            'partsouq' in content_lower and
            not analysis['is_blocked'] and
            not analysis['has_cloudflare']
        )
        
        return {
            "success": success,
            "vin": vin,
            "url": search_url,
            "final_url": search_response.url,
            "analysis": analysis,
            "sample_content": sample_content,
            "improvement_status": "advanced_headers_applied"
        }
        
    except Exception as e:
        logger.error(f"Advanced scraping failed: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "vin": vin,
            "url": search_url if 'search_url' in locals() else None
        }

@app.get("/test-partsouq-advanced")
def test_partsouq_advanced():
    """בדיקה מתקדמת של Partsouq"""
    
    try:
        logger.info("Advanced Partsouq test...")
        
        session = create_session()
        headers = get_advanced_headers()
        
        response = session.get(
            'https://partsouq.com', 
            proxies=get_proxy_dict(),
            headers=headers,
            timeout=20,
            allow_redirects=True
        )
        
        content_lower = response.text.lower()
        
        return {
            "test_status": "completed",
            "status_code": response.status_code,
            "content_size": len(response.text),
            "proxy_used": True,
            "has_partsouq_content": 'partsouq' in content_lower,
            "has_cloudflare": 'cloudflare' in content_lower,
            "is_blocked": response.status_code == 403,
            "response_time": response.elapsed.total_seconds(),
            "success": response.status_code == 200 and 'partsouq' in content_lower,
            "improvement": "advanced_headers_session"
        }
        
    except Exception as e:
        logger.error(f"Advanced test failed: {str(e)}")
        return {
            "test_status": "failed",
            "error": str(e)
        }

# נתיבים ישנים לתאימות
@app.get("/scrape-simple/{vin}")
def scrape_simple(vin: str):
    """Forward לגרסה המתקדמת"""
    return scrape_advanced(vin)

@app.get("/test-partsouq-basic")
def test_partsouq_basic():
    """Forward לגרסה המתקדמת"""
    return test_partsouq_advanced()

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 10000))
    
    logger.info(f"🚀 Starting Advanced Partsouq Scraper on port {port}")
    logger.info(f"📍 Proxy URL: {PROXY_URL}")
    
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=port,
        log_level="info"
    )
