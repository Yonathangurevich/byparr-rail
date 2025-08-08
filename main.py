"""
Partsouq Scraper - Fast ScraperAPI Version
No JavaScript rendering for speed
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import os
import time
import logging
from typing import Optional, Dict, Any
import re

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq Fast ScraperAPI",
    description="Fast scraper - no JS rendering",
    version="11.0.0"
)

# ScraperAPI configuration
SCRAPERAPI_KEY = os.getenv('SCRAPERAPI_KEY', '9e4414bf812abcc16f9c550dd0b3e17d')

class ScrapeRequest(BaseModel):
    url: str
    identifier: Optional[str] = "custom"
    use_js: Optional[bool] = False  # ברירת מחדל - בלי JS

async def scrape_with_scraperapi(url: str, use_js: bool = False) -> Dict[str, Any]:
    """Direct ScraperAPI call - FAST version"""
    
    # ScraperAPI endpoint
    api_url = "https://api.scraperapi.com/"
    
    # Parameters for ScraperAPI - מינימליים למהירות
    params = {
        'api_key': SCRAPERAPI_KEY,
        'url': url,
        'country_code': 'us'
    }
    
    # רק אם באמת צריך JS
    if use_js:
        params['render'] = 'true'
        timeout = 60.0
        logger.info("⚠️ Using JS rendering - will be slower")
    else:
        timeout = 15.0  # 15 שניות מספיק בלי JS
        logger.info("⚡ Fast mode - no JS rendering")
    
    try:
        logger.info(f"🔍 Scraping: {url[:80]}...")
        start_time = time.time()
        
        # Make request to ScraperAPI
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(api_url, params=params)
            
            load_time = time.time() - start_time
            logger.info(f"Response in {load_time:.2f}s - Status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"ScraperAPI error: {response.text[:200]}")
                return {
                    'success': False,
                    'error': f'API returned {response.status_code}',
                    'url': url,
                    'load_time': f"{load_time:.2f}s"
                }
            
            # Get content
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
            
            # Look for success indicators
            has_parts = bool(re.search(r'part|vehicle|catalog', content_lower))
            has_data = content_length > 1000
            has_cloudflare = 'cloudflare' in content_lower or 'checking your browser' in content_lower
            
            # Extract part numbers if found
            parts_found = []
            if has_parts and not has_cloudflare:
                # Common part number patterns
                part_patterns = [
                    r'\b[0-9]{5}-[A-Z0-9]{5}\b',  # 12345-ABC12
                    r'\b[A-Z]{2,3}[0-9]{8,10}\b',  # ABC12345678
                    r'\b[0-9]{10,15}\b'  # Pure numbers
                ]
                
                for pattern in part_patterns:
                    matches = re.findall(pattern, content)
                    if matches:
                        parts_found.extend(matches[:3])
                        break
                
                parts_found = list(set(parts_found))[:5]
            
            # Determine success
            success = has_parts and has_data and not has_cloudflare
            
            # Get sample content
            sample = content[:300] if content else ""
            # Clean non-printable chars
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
            
    except httpx.TimeoutException:
        logger.error(f"Timeout after {timeout}s")
        return {
            'success': False,
            'error': f'Timeout after {timeout}s',
            'url': url
        }
    except Exception as e:
        logger.error(f"Error: {e}")
        return {
            'success': False,
            'error': str(e)[:100],
            'url': url
        }

# === API ENDPOINTS ===

@app.get("/")
async def root():
    """Service info"""
    return {
        "service": "Partsouq Fast ScraperAPI",
        "version": "11.0.0",
        "status": "online",
        "mode": "FAST (no JS by default)",
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
    """Scrape by VIN - FAST by default"""
    
    if not vin or len(vin) < 5:
        raise HTTPException(status_code=400, detail="Invalid VIN")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="No API key")
    
    url = f"https://partsouq.com/en/search/all?q={vin}"
    
    logger.info(f"🚗 Scraping VIN: {vin} (JS: {use_js})")
    
    result = await scrape_with_scraperapi(url, use_js)
    result['method'] = 'fast_scrape'
    result['vin'] = vin
    
    return result

@app.post("/scrape-url")
async def scrape_custom_url(request: ScrapeRequest):
    """Scrape custom URL - handles complex URLs"""
    
    if not request.url:
        raise HTTPException(status_code=400, detail="URL required")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="No API key")
    
    logger.info(f"🔗 Scraping URL (JS: {request.use_js})")
    
    result = await scrape_with_scraperapi(request.url, request.use_js)
    result['identifier'] = request.identifier
    
    return result

@app.get("/test")
async def test_api():
    """Quick test"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    # Test with simple page - NO JS
    start = time.time()
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://api.scraperapi.com/",
            params={
                'api_key': SCRAPERAPI_KEY,
                'url': 'https://httpbin.org/html'
            }
        )
    
    elapsed = time.time() - start
    
    return {
        "status": "✅ Working" if response.status_code == 200 else "❌ Failed",
        "response_time": f"{elapsed:.2f}s",
        "content_length": len(response.text) if response.status_code == 200 else 0
    }

@app.get("/test-partsouq")
async def test_partsouq():
    """Test Partsouq directly"""
    
    test_url = "https://partsouq.com/en/search/all?q=TEST123"
    
    result = await scrape_with_scraperapi(test_url, use_js=False)
    
    return {
        "test": "partsouq_direct",
        "result": result
    }

@app.get("/quota")
async def check_quota():
    """Check API quota"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://api.scraperapi.com/account",
                params={'api_key': SCRAPERAPI_KEY}
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
    logger.info("🚀 Partsouq Fast ScraperAPI v11.0")
    logger.info("⚡ FAST MODE - No JS rendering by default")
    logger.info(f"🔑 API Key: {'Configured' if SCRAPERAPI_KEY else 'Missing'}")
    logger.info("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
