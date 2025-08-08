"""
Partsouq Scraper - Using requests (like your working example)
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests  # שינוי ל-requests כמו בדוגמה שעובדת!
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
    description="Using requests library for reliability",
    version="12.0.0"
)

# ScraperAPI configuration
SCRAPERAPI_KEY = os.getenv('SCRAPERAPI_KEY', '9e4414bf812abcc16f9c550dd0b3e17d')

# Thread pool for async requests
executor = ThreadPoolExecutor(max_workers=5)

class ScrapeRequest(BaseModel):
    url: str
    identifier: Optional[str] = "custom"
    use_js: Optional[bool] = False

def scrape_with_scraperapi_sync(url: str, use_js: bool = False) -> Dict[str, Any]:
    """Synchronous ScraperAPI call - SIMPLIFIED"""
    
    # Minimal payload - בדיוק כמו מה שעובד!
    payload = {
        'api_key': SCRAPERAPI_KEY,
        'url': url
    }
    
    # רק אם באמת צריך JS
    if use_js:
        payload['render'] = 'true'
    
    try:
        logger.info(f"🔍 Scraping: {url[:80]}...")
        start_time = time.time()
        
        # פשוט כמו שעובד לך - בלי פרמטרים מיותרים!
        response = requests.get('https://api.scraperapi.com/', params=payload)
        
        load_time = time.time() - start_time
        logger.info(f"Response in {load_time:.2f}s - Status: {response.status_code}")
        
        load_time = time.time() - start_time
        logger.info(f"Response in {load_time:.2f}s - Status: {response.status_code}")
        
        if response.status_code != 200:
            logger.error(f"ScraperAPI returned {response.status_code}")
            return {
                'success': False,
                'error': f'API returned {response.status_code}',
                'details': response.text[:200],
                'url': url,
                'load_time': f"{load_time:.2f}s"
            }
        
        # Get content
        content = response.text
        content_length = len(content)
        logger.info(f"✅ Got {content_length} bytes in {load_time:.2f}s")
        
        # Quick analysis
        content_lower = content.lower()
        
        # Extract VIN if present
        vin = None
        if 'q=' in url:
            try:
                vin = url.split('q=')[1].split('&')[0]
            except:
                pass
        
        # Check for success indicators
        has_parts = bool(re.search(r'part|vehicle|catalog', content_lower))
        has_data = content_length > 1000
        has_cloudflare = 'cloudflare' in content_lower or 'checking your browser' in content_lower
        
        # Extract part numbers
        parts_found = []
        if has_parts and not has_cloudflare:
            # Common part patterns
            part_patterns = [
                r'\b[0-9]{5}-[A-Z0-9]{5}\b',
                r'\b[A-Z]{2,3}[0-9]{8,10}\b',
                r'\b[0-9]{10,15}\b'
            ]
            
            for pattern in part_patterns:
                matches = re.findall(pattern, content)
                if matches:
                    parts_found.extend(matches[:3])
                    break
            
            parts_found = list(set(parts_found))[:5]
        
        # Determine success
        success = has_parts and has_data and not has_cloudflare
        
        # Get sample
        sample = content[:300] if content else ""
        sample = ''.join(c if 32 <= ord(c) < 127 else ' ' for c in sample)
        
        return {
            'success': success,
            'url': url,
            'vin': vin,
            'load_time': f"{load_time:.2f}s",
            'content_size': content_length,
            'analysis': {
                'has_parts': has_parts,
                'has_cloudflare': has_cloudflare,
                'js_used': use_js
            },
            'parts_found': parts_found,
            'sample': sample[:200],
            'credits_used': 10 if use_js else 1
        }
        
    except requests.Timeout:
        logger.error("Request timeout")
        return {
            'success': False,
            'error': 'Request timeout after 45s',
            'url': url
        }
    except Exception as e:
        logger.error(f"Error: {e}")
        return {
            'success': False,
            'error': str(e)[:100],
            'url': url
        }

async def scrape_with_scraperapi(url: str, use_js: bool = False) -> Dict[str, Any]:
    """Async wrapper for scraping"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, scrape_with_scraperapi_sync, url, use_js)

# === API ENDPOINTS ===

@app.get("/")
async def root():
    """Service info"""
    return {
        "service": "Partsouq ScraperAPI",
        "version": "12.0.0",
        "status": "online",
        "library": "requests (reliable)",
        "api_key": "configured" if SCRAPERAPI_KEY else "missing"
    }

@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "scraperapi": bool(SCRAPERAPI_KEY)
    }

@app.get("/scrape/{vin}")
async def scrape_vin(vin: str, use_js: bool = False):
    """Scrape by VIN - with smart URL strategy"""
    
    if not vin or len(vin) < 5:
        raise HTTPException(status_code=400, detail="Invalid VIN")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="No API key")
    
    # אסטרטגיה חדשה - נסה קודם URL ישיר של catalog
    # אם יש לנו catalog URL מוכן, השתמש בו
    # אחרת, נסה search עם JS
    
    url = f"https://partsouq.com/en/search/all?q={vin}"
    
    logger.info(f"🚗 Scraping VIN: {vin}")
    
    # נסה קודם בלי JS (מהיר)
    result = await scrape_with_scraperapi(url, use_js=False)
    
    # אם נכשל בגלל Cloudflare, נסה עם JS
    if not result['success'] and result.get('analysis', {}).get('has_cloudflare'):
        logger.info("Cloudflare detected, retrying with JS...")
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
    """Direct catalog URL scraping - usually bypasses Cloudflare"""
    
    # בנה את ה-URL המלא
    url = f"https://partsouq.com/en/catalog/genuine/parts?c={c}&ssd={ssd}&vid={vid}&gid={gid}"
    if q:
        url += f"&q={q}"
    
    logger.info(f"📚 Scraping catalog URL")
    
    # Catalog URLs בדרך כלל לא צריכים JS!
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
    
    logger.info(f"🔗 Scraping custom URL")
    
    result = await scrape_with_scraperapi(request.url, request.use_js)
    result['identifier'] = request.identifier
    
    return result

@app.get("/test")
async def test_api():
    """Quick test"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    start = time.time()
    
    # Test exactly like your working example
    payload = {
        'api_key': SCRAPERAPI_KEY,
        'url': 'https://httpbin.org/html'
    }
    
    try:
        response = requests.get('https://api.scraperapi.com/', params=payload, timeout=10)
        elapsed = time.time() - start
        
        return {
            "status": "✅ Working" if response.status_code == 200 else "❌ Failed",
            "response_time": f"{elapsed:.2f}s",
            "content_length": len(response.text) if response.status_code == 200 else 0
        }
    except Exception as e:
        return {"status": "❌ Error", "error": str(e)}

@app.get("/test-simple/{vin}")
async def test_simple_scrape(vin: str):
    """Test with minimal code - exactly like your working example"""
    
    # בדיוק כמו הקוד שעובד לך!
    payload = {
        'api_key': SCRAPERAPI_KEY,
        'url': f'https://partsouq.com/en/search/all?q={vin}'
    }
    
    try:
        # בלי שום פרמטרים נוספים
        r = requests.get('https://api.scraperapi.com/', params=payload)
        
        content = r.text
        content_lower = content.lower()
        
        return {
            'success': True,
            'status_code': r.status_code,
            'content_size': len(content),
            'has_partsouq': 'partsouq' in content_lower,
            'has_cloudflare': 'cloudflare' in content_lower,
            'has_parts': 'part' in content_lower,
            'sample': content[:200]
        }
    except Exception as e:
        return {'error': str(e)}

@app.get("/debug-scrape/{vin}")
async def debug_scrape(vin: str):
    """Debug - compare different approaches"""
    
    results = {}
    
    # Test 1: Minimal (like your working code)
    try:
        payload = {
            'api_key': SCRAPERAPI_KEY,
            'url': f'https://partsouq.com/en/search/all?q={vin}'
        }
        r1 = requests.get('https://api.scraperapi.com/', params=payload)
        results['minimal'] = {
            'status': r1.status_code,
            'size': len(r1.text),
            'cloudflare': 'cloudflare' in r1.text.lower()
        }
    except Exception as e:
        results['minimal'] = {'error': str(e)}
    
    # Test 2: With timeout
    try:
        r2 = requests.get('https://api.scraperapi.com/', params=payload, timeout=30)
        results['with_timeout'] = {
            'status': r2.status_code,
            'size': len(r2.text),
            'cloudflare': 'cloudflare' in r2.text.lower()
        }
    except Exception as e:
        results['with_timeout'] = {'error': str(e)}
    
    # Test 3: With country_code only
    try:
        payload['country_code'] = 'us'
        r3 = requests.get('https://api.scraperapi.com/', params=payload)
        results['with_country'] = {
            'status': r3.status_code,
            'size': len(r3.text),
            'cloudflare': 'cloudflare' in r3.text.lower()
        }
    except Exception as e:
        results['with_country'] = {'error': str(e)}
    
    return {
        'vin': vin,
        'tests': results
    }

@app.get("/quota")
async def check_quota():
    """Check API quota"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    try:
        response = requests.get(
            "https://api.scraperapi.com/account",
            params={'api_key': SCRAPERAPI_KEY},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "requests_used": data.get("requestCount", 0),
                "requests_limit": data.get("requestLimit", 0),
                "remaining": data.get("requestLimit", 0) - data.get("requestCount", 0)
            }
    except:
        pass
    
    return {"error": "Could not fetch quota"}

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 8000))
    
    logger.info("=" * 60)
    logger.info("🚀 Partsouq ScraperAPI v12.0")
    logger.info("📚 Using requests library (proven to work)")
    logger.info(f"🔑 API Key: {'Configured' if SCRAPERAPI_KEY else 'Missing'}")
    logger.info("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
