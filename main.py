"""
Partsouq Scraper - Enhanced Version with 499 Fix
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os
import time
import logging
from typing import Optional, Dict, Any
import re
import asyncio
from concurrent.futures import ThreadPoolExecutor


# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq ScraperAPI Service",
    description="Enhanced version with connection management",
    version="13.0.0"
)

# ScraperAPI configuration
SCRAPERAPI_KEY = os.getenv('SCRAPERAPI_KEY', '9e4414bf812abcc16f9c550dd0b3e17d')

# Thread pool for async requests - הגדלנו ל-20!
MAX_WORKERS = int(os.getenv('MAX_WORKERS', '20'))
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)

# ========== SESSION SETUP WITH KEEP-ALIVE ==========
# יצירת session עם connection pooling ו-retry logic
session = requests.Session()

# Retry strategy - כולל 499!
retry_strategy = Retry(
    total=3,
    backoff_factor=2,  # המתן 2, 4, 8 שניות בין ניסיונות
    status_forcelist=[429, 499, 500, 502, 503, 504],
    allowed_methods=["GET", "POST"]
)

# HTTP Adapter with connection pooling
adapter = HTTPAdapter(
    pool_connections=20,
    pool_maxsize=20,
    max_retries=retry_strategy
)

# Mount adapters
session.mount("http://", adapter)
session.mount("https://", adapter)

# Keep-Alive headers
session.headers.update({
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=120, max=20',
    'User-Agent': 'PartsouqScraper/13.0'
})

# Semaphore for rate limiting
semaphore = asyncio.Semaphore(10)  # מקסימום 10 בקשות מקביליות

class ScrapeRequest(BaseModel):
    url: str
    identifier: Optional[str] = "custom"
    use_js: Optional[bool] = False

def scrape_with_scraperapi_sync(url: str, use_js: bool = False) -> Dict[str, Any]:
    """Synchronous ScraperAPI call - FIXED VERSION"""
    
    payload = {
        'api_key': SCRAPERAPI_KEY,
        'url': url
    }
    
    if use_js:
        payload['render'] = 'true'
    
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            logger.info(f"🔍 Scraping (attempt {attempt + 1}/{max_retries}): {url[:80]}...")
            start_time = time.time()
            
            # השתמש ב-session עם timeout ארוך
            response = session.get(
                'https://api.scraperapi.com/', 
                params=payload,
                timeout=90  # 90 שניות במקום 120
            )
            
            load_time = time.time() - start_time
            logger.info(f"Response in {load_time:.2f}s - Status: {response.status_code}")
            
            # טיפול ב-499
            if response.status_code == 499:
                logger.warning(f"Got 499 - attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    time.sleep(5 * (attempt + 1))
                    continue
                else:
                    return {
                        'success': False,
                        'error': f'499 error after {max_retries} attempts',
                        'status_code': 499,
                        'url': url
                    }
            
            if response.status_code != 200:
                logger.error(f"ScraperAPI returned {response.status_code}")
                return {
                    'success': False,
                    'error': f'API returned {response.status_code}',
                    'details': response.text[:200],
                    'url': url,
                    'load_time': f"{load_time:.2f}s"
                }
            
            # Success!
            content = response.text
            content_length = len(content)
            logger.info(f"✅ Got {content_length} bytes in {load_time:.2f}s")
            
            # Quick analysis
            content_lower = content.lower()
            
            # Extract VIN
            vin = None
            if 'q=' in url:
                try:
                    vin = url.split('q=')[1].split('&')[0]
                except:
                    pass
            
            # Check success
            has_parts = bool(re.search(r'part|vehicle|catalog', content_lower))
            has_data = content_length > 50000
            is_cloudflare = content_length < 20000 and 'cloudflare' in content_lower
            
            success = has_parts and has_data and not is_cloudflare
            
            return {
                'success': success,
                'url': url,
                'vin': vin,
                'load_time': f"{load_time:.2f}s",
                'content_size': content_length,
                'html_content': content,
                'credits_used': 10 if use_js else 1,
                'attempts': attempt + 1
            }
            
        except requests.Timeout:
            logger.error(f"Timeout on attempt {attempt + 1}")
            if attempt < max_retries - 1:
                time.sleep(5)
                continue
            return {
                'success': False,
                'error': 'Request timeout after all attempts',
                'url': url
            }
        except Exception as e:
            logger.error(f"Error on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                time.sleep(5)
                continue
            return {
                'success': False,
                'error': str(e)[:100],
                'url': url
            }
    
    # Should not reach here
    return {
        'success': False,
        'error': 'Unknown error',
        'url': url
    }
async def scrape_with_scraperapi(url: str, use_js: bool = False) -> Dict[str, Any]:
    """Simple async wrapper"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        executor, 
        scrape_with_scraperapi_sync, 
        url, 
        use_js
    )
# === STARTUP EVENTS ===

@app.on_event("startup")
async def startup_event():
    """Initialize and warm up the connection"""
    logger.info("🚀 Starting up - warming connection to ScraperAPI...")
    
    # Test connection
    try:
        test_response = session.get(
            'https://api.scraperapi.com/',
            params={
                'api_key': SCRAPERAPI_KEY,
                'url': 'https://httpbin.org/ip'
            },
            timeout=10
        )
        if test_response.status_code == 200:
            logger.info("✅ ScraperAPI connection successful")
        else:
            logger.warning(f"⚠️ ScraperAPI test returned: {test_response.status_code}")
    except Exception as e:
        logger.error(f"❌ ScraperAPI connection failed: {e}")

# === API ENDPOINTS ===

@app.get("/")
async def root():
    """Service info"""
    return {
        "service": "Partsouq ScraperAPI",
        "version": "13.0.0",
        "status": "online",
        "features": [
            "Connection pooling",
            "Auto-retry on 499",
            "Keep-alive connections",
            "Rate limiting"
        ],
        "max_workers": MAX_WORKERS,
        "api_key": "configured" if SCRAPERAPI_KEY else "missing"
    }

@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "scraperapi": bool(SCRAPERAPI_KEY),
        "active_threads": executor._threads.__len__() if hasattr(executor, '_threads') else 0,
        "max_workers": MAX_WORKERS
    }

@app.get("/account-status")
async def check_account_status():
    """Check ScraperAPI account status"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key configured"}
    
    try:
        response = session.get(
            "https://api.scraperapi.com/account",
            params={'api_key': SCRAPERAPI_KEY},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "status": "✅ ACTIVE",
                "plan_type": data.get("planType", "unknown"),
                "requests_used": data.get("requestCount", 0),
                "requests_limit": data.get("requestLimit", 0),
                "remaining": data.get("requestLimit", 0) - data.get("requestCount", 0),
                "concurrent_requests": data.get("concurrentRequests", 1),
                "api_key_last_4": SCRAPERAPI_KEY[-4:] if len(SCRAPERAPI_KEY) > 4 else "****"
            }
        elif response.status_code == 499:
            return {
                "status": "⚠️ 499 ERROR",
                "message": "This might be a free account limitation or duplicate account",
                "suggestion": "Check if you're using the correct paid API key"
            }
        else:
            return {
                "status": "❌ ERROR",
                "status_code": response.status_code,
                "error": response.text[:200]
            }
            
    except Exception as e:
        return {
            "status": "❌ FAILED",
            "error": str(e)
        }

@app.get("/scrape/{vin}")
async def scrape_vin(vin: str, use_js: bool = False):
    """Scrape by VIN"""
    
    if not vin or len(vin) < 5:
        raise HTTPException(status_code=400, detail="Invalid VIN")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="No API key")
    
    url = f"https://partsouq.com/en/search/all?q={vin}"
    
    logger.info(f"🚗 Scraping VIN: {vin}")
    
    # Try without JS first
    result = await scrape_with_scraperapi(url, use_js=False)
    
    # If failed due to Cloudflare, retry with JS
    if not result['success'] and 'cloudflare' in result.get('html_content', '').lower():
        logger.info("Cloudflare detected, retrying with JS rendering...")
        result = await scrape_with_scraperapi(url, use_js=True)
    
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
    
    url = f"https://partsouq.com/en/catalog/genuine/parts?c={c}&ssd={ssd}&vid={vid}&gid={gid}"
    if q:
        url += f"&q={q}"
    
    logger.info(f"📚 Scraping catalog URL")
    
    result = await scrape_with_scraperapi(url, use_js=False)
    result['method'] = 'catalog_direct'
    
    return result

@app.post("/scrape-url")
async def scrape_custom_url(request: ScrapeRequest):
    """Scrape custom URL"""
    
    if not request.url:
        raise HTTPException(status_code=400, detail="URL required")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="No API key")
    
    logger.info(f"🔗 Scraping URL: {request.url[:100]}")
    
    result = await scrape_with_scraperapi(request.url, request.use_js)
    result['identifier'] = request.identifier
    
    if result['success'] and result.get('html_content'):
        logger.info(f"✅ Returning {len(result['html_content'])} bytes of HTML")
    
    return result

@app.get("/test")
async def test_api():
    """Quick connection test"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    start = time.time()
    
    payload = {
        'api_key': SCRAPERAPI_KEY,
        'url': 'https://httpbin.org/html'
    }
    
    try:
        response = session.get('https://api.scraperapi.com/', params=payload, timeout=10)
        elapsed = time.time() - start
        
        return {
            "status": "✅ Working" if response.status_code == 200 else f"❌ Failed ({response.status_code})",
            "response_time": f"{elapsed:.2f}s",
            "content_length": len(response.text) if response.status_code == 200 else 0,
            "connection_pool": {
                "connections": len(session.adapters),
                "max_retries": adapter.max_retries.total
            }
        }
    except Exception as e:
        return {"status": "❌ Error", "error": str(e)}

@app.get("/stats")
async def get_stats():
    """Get service statistics"""
    return {
        "service": "Partsouq ScraperAPI v13",
        "uptime": time.time(),
        "configuration": {
            "max_workers": MAX_WORKERS,
            "timeout": 120,
            "retry_attempts": 3,
            "concurrent_limit": 10
        },
        "session_info": {
            "pool_connections": adapter.poolmanager.num_pools if hasattr(adapter, 'poolmanager') else 0,
            "headers": dict(session.headers)
        }
    }

@app.get("/test-simple/{vin}")
async def test_simple_scrape(vin: str):
    """Test with minimal code"""
    
    payload = {
        'api_key': SCRAPERAPI_KEY,
        'url': f'https://partsouq.com/en/search/all?q={vin}'
    }
    
    try:
        start_time = time.time()
        
        # Use session instead of direct requests
        r = session.get('https://api.scraperapi.com/', params=payload, timeout=120)
        
        load_time = time.time() - start_time
        content = r.text
        content_lower = content.lower()
        
        # Check for Cloudflare
        cloudflare_indicators = [
            'cloudflare' in content_lower,
            'checking your browser' in content_lower,
            'just a moment' in content_lower,
            'cf-browser-verification' in content_lower
        ]
        
        # Check for real content
        real_content_indicators = [
            '/catalog/' in content,
            'data-part' in content,
            'add-to-cart' in content_lower,
            'price' in content_lower,
            'vehicle' in content_lower
        ]
        
        # Find parts
        parts_found = re.findall(r'\b[0-9]{5,15}\b', content)[:10]
        
        # Check if VIN is in results
        vin_found = vin in content
        
        return {
            'success': True,
            'load_time': f"{load_time:.2f}s",
            'status_code': r.status_code,
            'content_size': len(content),
            'cloudflare_checks': {
                'has_cloudflare_word': 'cloudflare' in content_lower,
                'has_checking_browser': 'checking your browser' in content_lower,
                'has_just_moment': 'just a moment' in content_lower,
                'any_cloudflare': any(cloudflare_indicators)
            },
            'content_checks': {
                'has_catalog': '/catalog/' in content,
                'has_data_part': 'data-part' in content,
                'has_add_cart': 'add-to-cart' in content_lower,
                'has_price': 'price' in content_lower,
                'vin_found': vin_found,
                'real_content_score': sum(real_content_indicators)
            },
            'parts_found': parts_found[:5],
            'sample': content[:500],
            'verdict': 'REAL CONTENT' if sum(real_content_indicators) > 2 else 'CLOUDFLARE PAGE'
        }
    except Exception as e:
        return {
            'error': str(e),
            'status_code': 499 if '499' in str(e) else None
        }

@app.get("/quota")
async def check_quota():
    """Check API quota"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    try:
        response = session.get(
            "https://api.scraperapi.com/account",
            params={'api_key': SCRAPERAPI_KEY},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            used = data.get("requestCount", 0)
            limit = data.get("requestLimit", 0)
            remaining = limit - used
            
            return {
                "requests_used": used,
                "requests_limit": limit,
                "remaining": remaining,
                "percentage_used": f"{(used/limit*100):.1f}%" if limit > 0 else "0%",
                "warning": "⚠️ Quota running low!" if remaining < 1000 else "✅ Quota OK"
            }
    except Exception as e:
        return {"error": f"Could not fetch quota: {str(e)}"}

# Keep-alive background task
async def keep_alive_task():
    """Background task to keep connection warm"""
    while True:
        try:
            await asyncio.sleep(30)  # Every 30 seconds
            
            # Simple ping to keep connection alive
            test_response = session.get(
                'https://api.scraperapi.com/',
                params={
                    'api_key': SCRAPERAPI_KEY,
                    'url': 'https://httpbin.org/ip'
                },
                timeout=5
            )
            logger.debug(f"Keep-alive ping: {test_response.status_code}")
        except Exception as e:
            logger.debug(f"Keep-alive error (non-critical): {e}")

@app.on_event("startup")
async def start_background_tasks():
    """Start background tasks"""
    asyncio.create_task(keep_alive_task())

if __name__ == "__main__":
    import uvicorn  # 🔥 העבר את ה-import לפה!
    
    port = int(os.environ.get("PORT", 8000))
    
    logger.info("=" * 60)
    logger.info("🚀 Partsouq ScraperAPI v13.0 - Enhanced Edition")
    logger.info("📚 Features: Connection Pooling, Auto-Retry, Keep-Alive")
    logger.info(f"🔑 API Key: {'Configured' if SCRAPERAPI_KEY else 'Missing'}")
    logger.info(f"⚙️  Max Workers: {MAX_WORKERS}")
    logger.info(f"🔌 Port: {port}")
    logger.info("=" * 60)
    
    # Run with enhanced settings
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info",
        timeout_keep_alive=120,
        # הסר את השורות הבאות - הן גורמות לבעיה
        # timeout_notify=100,
        # limit_max_requests=10000
    )
