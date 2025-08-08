"""
Partsouq Scraper - ScraperAPI Only Version
Optimized for Railway deployment
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import time
import logging
import asyncio
from typing import Optional, Dict, Any
from playwright.async_api import async_playwright

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Partsouq ScraperAPI Service",
    description="Optimized scraper using ScraperAPI only",
    version="9.0.0"
)

# ScraperAPI configuration
SCRAPERAPI_KEY = os.getenv('SCRAPERAPI_KEY', '9e4414bf812abcc16f9c550dd0b3e17d')

# Concurrency control
CONCURRENCY_LIMIT = int(os.getenv('CONCURRENCY_LIMIT', '3'))
semaphore = asyncio.Semaphore(CONCURRENCY_LIMIT)

class ScrapeRequest(BaseModel):
    url: str
    identifier: Optional[str] = "custom"

class ScraperAPIClient:
    """Optimized ScraperAPI client for Partsouq"""
    
    @staticmethod
    def get_proxy_url(render_js: bool = True):
        """Get ScraperAPI proxy URL with optimal settings"""
        if not SCRAPERAPI_KEY:
            raise ValueError("No ScraperAPI key configured")
        
        # ScraperAPI parameters:
        # render=true - Enable JavaScript rendering (costs 10 credits)
        # country_code=us - Use US IPs (most reliable)
        # device_type=desktop - Desktop user agent
        params = "render=true.country_code=us.device_type=desktop"
        
        return f"http://scraperapi.{params}:{SCRAPERAPI_KEY}@proxy-server.scraperapi.com:8001"
    
    @staticmethod
    async def create_browser():
        """Create browser with ScraperAPI proxy"""
        playwright = None
        browser = None
        
        try:
            playwright = await async_playwright().start()
            
            proxy_url = ScraperAPIClient.get_proxy_url()
            logger.info("🔧 Using ScraperAPI with JS rendering")
            
            # Browser configuration
            browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process',
                    '--no-zygote'
                ],
                proxy={'server': proxy_url}
            )
            
            # Context with stealth settings
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                locale='en-US',
                timezone_id='America/New_York'
            )
            
            return playwright, browser, context
            
        except Exception as e:
            logger.error(f"Browser creation failed: {e}")
            if browser:
                await browser.close()
            if playwright:
                await playwright.stop()
            raise
    
    @staticmethod
    async def scrape_url(url: str) -> Dict[str, Any]:
        """Scrape URL using ScraperAPI"""
        
        playwright = None
        browser = None
        context = None
        
        try:
            # Create browser
            playwright, browser, context = await ScraperAPIClient.create_browser()
            
            # Create page
            page = await context.new_page()
            page.set_default_timeout(30000)
            
            # Navigate
            logger.info(f"📍 Navigating to: {url[:80]}...")
            start_time = time.time()
            
            response = await page.goto(url, wait_until='domcontentloaded')
            
            # Wait for content
            await asyncio.sleep(3)
            
            # Try to wait for specific elements
            try:
                await page.wait_for_selector('body', timeout=5000)
            except:
                pass
            
            # Get content
            content = await page.content()
            load_time = time.time() - start_time
            current_url = page.url
            
            # Extract VIN if present
            vin = None
            if 'q=' in url:
                try:
                    vin = url.split('q=')[1].split('&')[0]
                except:
                    pass
            
            # Analyze content
            content_lower = content.lower()
            
            # Success indicators
            has_partsouq = 'partsouq' in content_lower
            has_catalog = 'catalog' in current_url or '/search/' in current_url
            has_parts = 'part' in content_lower or 'vehicle' in content_lower
            has_data = len(content) > 5000
            
            # Failure indicators
            has_cloudflare = 'cloudflare' in content_lower or 'just a moment' in content_lower
            has_error = 'error' in content_lower and '404' in content
            
            success = (
                has_partsouq and 
                (has_catalog or has_parts) and 
                has_data and 
                not has_cloudflare and 
                not has_error
            )
            
            # Extract sample
            sample = content[:500] if content else ""
            sample_clean = ''.join(c if 32 <= ord(c) < 127 else ' ' for c in sample)
            
            # Look for part numbers
            parts_found = []
            if success:
                import re
                # Look for part patterns (e.g., 12345-67890, ABC123DEF)
                patterns = [
                    r'\b[A-Z0-9]{5,6}-[A-Z0-9]{5,6}\b',
                    r'\b[A-Z0-9]{10,15}\b'
                ]
                for pattern in patterns:
                    matches = re.findall(pattern, content)
                    parts_found.extend(matches[:3])
                parts_found = list(set(parts_found))[:5]
            
            result = {
                'success': success,
                'url': url,
                'vin': vin,
                'final_url': current_url,
                'load_time': f"{load_time:.2f}s",
                'content_size': len(content),
                'analysis': {
                    'has_partsouq': has_partsouq,
                    'has_catalog': has_catalog,
                    'has_parts': has_parts,
                    'has_cloudflare': has_cloudflare,
                    'has_error': has_error
                },
                'parts_found': parts_found,
                'sample': sample_clean[:200],
                'timestamp': time.time()
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Scraping failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'url': url
            }
        finally:
            # Cleanup
            try:
                if context:
                    await context.close()
                if browser:
                    await browser.close()
                if playwright:
                    await playwright.stop()
            except:
                pass

# === API ENDPOINTS ===

@app.get("/")
async def root():
    """Service info"""
    return {
        "service": "Partsouq ScraperAPI Service",
        "version": "9.0.0",
        "status": "online",
        "scraperapi": "configured" if SCRAPERAPI_KEY else "missing",
        "endpoints": [
            "/health",
            "/scrape/{vin}",
            "/scrape-url",
            "/test"
        ]
    }

@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "scraperapi_configured": bool(SCRAPERAPI_KEY),
        "api_key_length": len(SCRAPERAPI_KEY) if SCRAPERAPI_KEY else 0,
        "concurrency": f"{CONCURRENCY_LIMIT - semaphore._value}/{CONCURRENCY_LIMIT}"
    }

@app.get("/scrape/{vin}")
async def scrape_vin(vin: str):
    """Scrape by VIN"""
    
    if not vin or len(vin) < 10:
        raise HTTPException(status_code=400, detail="Invalid VIN")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="ScraperAPI not configured")
    
    async with semaphore:
        logger.info(f"🚗 Scraping VIN: {vin}")
        
        url = f"https://partsouq.com/en/search/all?q={vin}"
        
        try:
            result = await ScraperAPIClient.scrape_url(url)
            result['method'] = 'vin_search'
            return result
            
        except Exception as e:
            logger.error(f"VIN scrape error: {e}")
            return {
                "success": False,
                "error": str(e),
                "vin": vin
            }

@app.post("/scrape-url")
async def scrape_custom_url(request: ScrapeRequest):
    """Scrape custom URL"""
    
    if not request.url:
        raise HTTPException(status_code=400, detail="URL required")
    
    if not SCRAPERAPI_KEY:
        raise HTTPException(status_code=500, detail="ScraperAPI not configured")
    
    async with semaphore:
        logger.info(f"🔗 Scraping URL: {request.url[:80]}")
        
        try:
            result = await ScraperAPIClient.scrape_url(request.url)
            result['identifier'] = request.identifier
            result['method'] = 'custom_url'
            return result
            
        except Exception as e:
            logger.error(f"URL scrape error: {e}")
            return {
                "success": False,
                "error": str(e),
                "url": request.url[:100],
                "identifier": request.identifier
            }

@app.get("/test")
async def test_scraperapi():
    """Test ScraperAPI connection"""
    
    if not SCRAPERAPI_KEY:
        return {
            "status": "error",
            "message": "No ScraperAPI key configured"
        }
    
    try:
        # Test with a simple page first
        playwright, browser, context = await ScraperAPIClient.create_browser()
        page = await context.new_page()
        
        # Test 1: Basic connectivity
        await page.goto('http://httpbin.org/ip', timeout=10000)
        ip_content = await page.content()
        
        # Test 2: Partsouq homepage
        await page.goto('https://partsouq.com', timeout=20000)
        await asyncio.sleep(2)
        ps_content = await page.content()
        
        # Cleanup
        await context.close()
        await browser.close()
        await playwright.stop()
        
        return {
            "status": "✅ SUCCESS",
            "scraperapi": "working",
            "ip_test": "passed",
            "partsouq_test": "partsouq" in ps_content.lower(),
            "message": "ScraperAPI is working correctly!"
        }
        
    except Exception as e:
        return {
            "status": "❌ FAILED",
            "error": str(e)[:200],
            "message": "Check API key and quota"
        }

@app.get("/test-vin/{vin}")
async def test_specific_vin(vin: str):
    """Test with specific VIN for debugging"""
    
    if not SCRAPERAPI_KEY:
        return {"error": "No API key"}
    
    url = f"https://partsouq.com/en/search/all?q={vin}"
    
    logger.info(f"🧪 Testing VIN: {vin}")
    
    # Try without semaphore for testing
    result = await ScraperAPIClient.scrape_url(url)
    
    # Add debug info
    result['debug'] = {
        'api_key_used': SCRAPERAPI_KEY[:10] + "...",
        'url_tested': url,
        'vin': vin
    }
    
    return result

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.environ.get("PORT", 8000))
    
    logger.info("=" * 60)
    logger.info("🚀 Partsouq ScraperAPI Service v9.0")
    logger.info(f"📍 Port: {port}")
    logger.info(f"🔑 API Key: {'Configured' if SCRAPERAPI_KEY else 'Missing'}")
    logger.info(f"🔧 Concurrency: {CONCURRENCY_LIMIT}")
    logger.info("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        workers=1,
        log_level="info"
    )
