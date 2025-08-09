"""
Partsouq Scraper - Fixed Version (No Retry Loops)
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import os
import time
import logging
from typing import Optional, Dict, Any
import re
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Disable warnings
import urllib3
urllib3.disable_warnings()

# Setup logging
logging.basicConfig(level=logging.INFO)
logging.getLogger("urllib3").setLevel(logging.ERROR)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq ScraperAPI Service",
    description="Fixed version - no retry loops",
    version="14.0.0"
)

# ScraperAPI configuration
SCRAPERAPI_KEY = os.getenv('SCRAPERAPI_KEY', '9e4414bf812abcc16f9c550dd0b3e17d')

# Thread pool
MAX_WORKERS = int(os.getenv('MAX_WORKERS', '10'))
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)

# ========== SIMPLE SESSION - NO RETRY! ==========
session = requests.Session()
session.headers.update({
    'User-Agent': 'PartsouqScraper/14.0'
})

class ScrapeRequest(BaseModel):
    url: str
    identifier: Optional[str] = "custom"
    use_js: Optional[bool] = False

def scrape_with_scraperapi_sync(url: str, use_js: bool = False) -> Dict[str, Any]:
    """
    SIMPLE ScraperAPI call - NO AUTOMATIC RETRY
    כל קריאה עולה כסף - לא עושים retry אוטומטי!
    """
    
    payload = {
        'api_key': SCRAPERAPI_KEY,
        'url': url
    }
    
    if use_js:
        payload['render'] = 'true'
    
    try:
        logger.info(f"🔍 Scraping: {url[:80]}...")
        start_time = time.time()
        
        # בקשה אחת בלבד - בלי retry!
        response = requests.get(
            'https://api.scraperapi.com/', 
            params=payload,
            timeout=90  # 90 שניות timeout
        )
        
        load_time = time.time() - start_time
        status = response.status_code
        
        logger.info(f"📊 Response: {status} in {load_time:.2f}s")
        
        # אם קיבלנו 499 - אל תנסה שוב אוטומטית!
        if status == 499:
            logger.warning("⚠️ Got 499 - Free account limit or rate limit")
            return {
                'success': False,
                'error': 'Rate limit - try again later',
                'status_code': 499,
                'url': url,
                'load_time': f"{load_time:.2f}s",
                'suggestion': 'Wait 10 seconds before next request'
            }
        
        # כל סטטוס אחר שאינו 200
        if status != 200:
            logger.error(f"❌ Status {status}")
            return {
                'success': False,
                'error': f'API returned {status}',
                'status_code': status,
                'url': url,
                'load_time': f"{load_time:.2f}s"
            }
        
        # Success!
        content = response.text
        content_length = len(content)
        logger.info(f"✅ Got {content_length} bytes")
        
        # בדיקה בסיסית
        content_lower = content.lower()
        is_valid = content_length > 10000
        is_cloudflare = 'cloudflare' in content_lower and content_length < 20000
        
        return {
            'success': is_valid and not is_cloudflare,
            'url': url,
            'load_time': f"{load_time:.2f}s",
            'content_size': content_length,
            'html_content': content,
            'credits_used': 10 if use_js else 1,
            'status_code': status
        }
        
    except requests.Timeout:
        logger.error("⏱️ Timeout after 90s")
        return {
            'success': False,
            'error': 'Timeout - page took too long',
            'url': url
        }
    except requests.ConnectionError:
        logger.error("🔌 Connection failed")
        return {
            'success': False,
            'error': 'Connection failed',
            'url': url
        }
    except Exception as e:
        logger.error(f"❌ Error: {str(e)[:100]}")
        return {
            'success': False,
            'error': str(e)[:100],
            'url': url
        }

async def scrape_with_scraperapi(url: str, use_js: bool = False) -> Dict[str, Any]:
    """Async wrapper - simple"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, scrape_with_scraperapi_sync, url, use_js)

# === RATE LIMITING ===
last_request_time = {}

def check_rate_limit(identifier: str) -> bool:
    """בדוק אם עברו לפחות 5 שניות מהבקשה האחרונה"""
    current_time = time.time()
    if identifier in last_request_time:
        time_passed = current_time - last_request_time[identifier]
        if time_passed < 5:  # המתן 5 שניות בין בקשות
            return False
    last_request_time[identifier] = current_time
    return True

# === API ENDPOINTS ===

@app.get("/")
async def root():
    return {
        "service": "Partsouq ScraperAPI v14",
        "status": "online",
        "warning": "No automatic retries - each request costs credits",
        "api_key": "configured" if SCRAPERAPI_KEY else "missing"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": time.time()
    }

@app.get("/scrape/{vin}")
async def scrape_vin(vin: str, use_js: bool = False):
    """Scrape by VIN with rate limiting"""
    
    if not vin or len(vin) < 5:
        raise HTTPException(status_code=400, detail="Invalid VIN")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="No API key")
    
    # Rate limiting
    if not check_rate_limit(vin):
        raise HTTPException(
            status_code=429, 
            detail="Rate limit - wait 5 seconds between requests"
        )
    
    url = f"https://partsouq.com/en/search/all?q={vin}"
    logger.info(f"🚗 Scraping VIN: {vin}")
    
    # רק ניסיון אחד!
    result = await scrape_with_scraperapi(url, use_js)
    
    result['method'] = 'vin_search'
    result['vin'] = vin
    
    return result

@app.get("/scrape-catalog")
async def scrape_catalog(
    c: str,
    ssd: str,
    vid: str,
    gid: str,
    q: Optional[str] = None
):
    """Direct catalog URL scraping"""
    
    # Rate limiting
    rate_limit_key = f"{c}_{ssd}_{vid}_{gid}"
    if not check_rate_limit(rate_limit_key):
        raise HTTPException(
            status_code=429,
            detail="Rate limit - wait 5 seconds"
        )
    
    url = f"https://partsouq.com/en/catalog/genuine/parts?c={c}&ssd={ssd}&vid={vid}&gid={gid}"
    if q:
        url += f"&q={q}"
    
    logger.info(f"📚 Scraping catalog URL")
    
    result = await scrape_with_scraperapi(url, use_js=False)
    result['method'] = 'catalog_direct'
    
    return result

@app.post("/scrape-url")
async def scrape_custom_url(request: ScrapeRequest):
    """Scrape custom URL with rate limiting"""
    
    if not request.url:
        raise HTTPException(status_code=400, detail="URL required")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="No API key")
    
    # Rate limiting
    if not check_rate_limit(request.url):
        raise HTTPException(
            status_code=429,
            detail="Rate limit - wait 5 seconds"
        )
    
    logger.info(f"🔗 Scraping URL: {request.url[:100]}")
    
    result = await scrape_with_scraperapi(request.url, request.use_js)
    result['identifier'] = request.identifier
    
    return result

@app.get("/quota")
async def check_quota():
    """Check API quota"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    try:
        # בקשה פשוטה בלי retry
        response = requests.get(
            "https://api.scraperapi.com/account",
            params={'api_key': SCRAPERAPI_KEY},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            used = data.get("requestCount", 0)
            limit = data.get("requestLimit", 0)
            remaining = limit - used
            
            # אזהרה אם נגמר הקרדיט
            if remaining < 100:
                logger.warning(f"⚠️ Low credits: {remaining} left!")
            
            return {
                "requests_used": used,
                "requests_limit": limit,
                "remaining": remaining,
                "percentage_used": f"{(used/limit*100):.1f}%" if limit > 0 else "0%",
                "warning": "⚠️ Credits running low!" if remaining < 1000 else "✅ OK"
            }
    except Exception as e:
        return {"error": str(e)}

@app.get("/test")
async def test_api():
    """Test without using credits"""
    return {
        "status": "✅ Service is running",
        "tip": "Use /quota to check credits",
        "warning": "Each scrape costs credits - no automatic retries"
    }

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 8000))
    
    logger.info("=" * 60)
    logger.info("🚀 Partsouq ScraperAPI v14.0 - NO RETRY VERSION")
    logger.info("⚠️  No automatic retries - each request costs credits")
    logger.info(f"🔑 API Key: {'Configured' if SCRAPERAPI_KEY else 'Missing'}")
    logger.info(f"🔌 Port: {port}")
    logger.info("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=False
    )
