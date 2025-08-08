"""
Partsouq Scraper - Simple ScraperAPI Version (No Playwright)
Super lightweight - just uses ScraperAPI directly
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import os
import time
import logging
from typing import Optional, Dict, Any

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq Simple ScraperAPI",
    description="Lightweight scraper using ScraperAPI only",
    version="10.0.0"
)

# ScraperAPI configuration
SCRAPERAPI_KEY = os.getenv('SCRAPERAPI_KEY', '9e4414bf812abcc16f9c550dd0b3e17d')

class ScrapeRequest(BaseModel):
    url: str
    identifier: Optional[str] = "custom"

async def scrape_with_scraperapi(url: str) -> Dict[str, Any]:
    """Direct ScraperAPI call - no Playwright needed"""
    
    # ScraperAPI endpoint
    api_url = "http://api.scraperapi.com"
    
    # Parameters for ScraperAPI
    params = {
        'api_key': SCRAPERAPI_KEY,
        'url': url,
        'render': 'true',  # Enable JavaScript rendering
        'country_code': 'us',
        'device_type': 'desktop',
        'premium': 'true'  # Use premium proxies
    }
    
    try:
        logger.info(f"🔍 Scraping: {url[:80]}...")
        start_time = time.time()
        
        # Make request to ScraperAPI
        async with httpx.AsyncClient(timeout=40.0) as client:
            response = await client.get(api_url, params=params)
            
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': f'ScraperAPI returned {response.status_code}',
                    'url': url
                }
            
            # Get content
            content = response.text
            load_time = time.time() - start_time
            
            # Extract VIN if present
            vin = None
            if 'q=' in url:
                try:
                    vin = url.split('q=')[1].split('&')[0]
                except:
                    pass
            
            # Analyze content
            content_lower = content.lower()
            
            # Check success indicators
            has_partsouq = 'partsouq' in content_lower
            has_parts = 'part' in content_lower or 'vehicle' in content_lower
            has_cloudflare = 'cloudflare' in content_lower or 'just a moment' in content_lower
            has_data = len(content) > 5000
            
            success = (
                has_partsouq and 
                has_parts and 
                has_data and 
                not has_cloudflare
            )
            
            # Extract part numbers
            parts_found = []
            if success:
                import re
                # Look for part number patterns
                patterns = [
                    r'\b[A-Z0-9]{5,6}-[A-Z0-9]{5,6}\b',
                    r'\b[A-Z0-9]{10,15}\b'
                ]
                for pattern in patterns:
                    matches = re.findall(pattern, content)
                    parts_found.extend(matches[:3])
                parts_found = list(set(parts_found))[:5]
            
            return {
                'success': success,
                'url': url,
                'vin': vin,
                'load_time': f"{load_time:.2f}s",
                'content_size': len(content),
                'analysis': {
                    'has_partsouq': has_partsouq,
                    'has_parts': has_parts,
                    'has_cloudflare': has_cloudflare
                },
                'parts_found': parts_found,
                'sample': content[:200] if content else "",
                'credits_used': 10 if params['render'] == 'true' else 1
            }
            
    except httpx.TimeoutException:
        logger.error(f"Timeout scraping {url}")
        return {
            'success': False,
            'error': 'Request timeout',
            'url': url
        }
    except Exception as e:
        logger.error(f"Error scraping {url}: {e}")
        return {
            'success': False,
            'error': str(e),
            'url': url
        }

# === API ENDPOINTS ===

@app.get("/")
async def root():
    """Service info"""
    return {
        "service": "Partsouq Simple ScraperAPI",
        "version": "10.0.0",
        "status": "online",
        "method": "Direct ScraperAPI (no Playwright)",
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
async def scrape_vin(vin: str):
    """Scrape by VIN"""
    
    if not vin or len(vin) < 10:
        raise HTTPException(status_code=400, detail="Invalid VIN")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="ScraperAPI not configured")
    
    url = f"https://partsouq.com/en/search/all?q={vin}"
    
    logger.info(f"🚗 Scraping VIN: {vin}")
    
    result = await scrape_with_scraperapi(url)
    result['method'] = 'scraperapi_direct'
    
    return result

@app.post("/scrape-url")
async def scrape_custom_url(request: ScrapeRequest):
    """Scrape custom URL"""
    
    if not request.url:
        raise HTTPException(status_code=400, detail="URL required")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="ScraperAPI not configured")
    
    logger.info(f"🔗 Scraping URL: {request.url[:80]}")
    
    result = await scrape_with_scraperapi(request.url)
    result['identifier'] = request.identifier
    
    return result

@app.get("/test")
async def test_api():
    """Test ScraperAPI"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    # Test with simple page
    test_url = "https://httpbin.org/html"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "http://api.scraperapi.com",
            params={
                'api_key': SCRAPERAPI_KEY,
                'url': test_url
            }
        )
        
        return {
            "status": "✅ Working" if response.status_code == 200 else "❌ Failed",
            "status_code": response.status_code,
            "content_length": len(response.text)
        }

@app.get("/quota")
async def check_quota():
    """Check ScraperAPI quota"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.scraperapi.com/account",
            params={'api_key': SCRAPERAPI_KEY}
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": "Could not fetch quota"}

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 8000))
    
    logger.info("=" * 60)
    logger.info("🚀 Partsouq Simple ScraperAPI v10.0")
    logger.info("📍 No Playwright - Direct API calls only")
    logger.info(f"🔑 API Key: {'Configured' if SCRAPERAPI_KEY else 'Missing'}")
    logger.info("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
