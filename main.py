"""
Railway Byparr Implementation
API server שמחקה את Byparr עם הפרוקסי שלך
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio
import os
from seleniumbase import BaseCase, SB
import json
import time
from typing import Optional

app = FastAPI(title="Partsouq Byparr API", version="1.0.0")

# הגדרת פרוקסי
PROXY_CONFIG = "smart-byparr:1209QWEasdzxcv@gate.smartproxy.com:10000"

class ScrapeRequest(BaseModel):
    url: str
    wait_time: Optional[int] = 10
    proxy: Optional[str] = None

class ScrapeResponse(BaseModel):
    success: bool
    url: str
    status_code: int
    content: str
    cookies: dict
    headers: dict
    response_time: float

class PartsouqScraper:
    """סקרפר Partsouq עם SeleniumBase"""
    
    def __init__(self):
        self.proxy = PROXY_CONFIG
    
    async def scrape_url(self, url: str, wait_time: int = 10) -> ScrapeResponse:
        """סקרייפינג URL עם SeleniumBase UC Mode"""
        
        start_time = time.time()
        
        try:
            with SB(
                uc=True,  # Undetected Chrome
                headless=True,
                proxy=self.proxy,
                page_load_strategy="normal",
                timeout=30
            ) as sb:
                
                print(f"🎯 Scraping: {url}")
                
                # פתיחת הדף
                sb.open(url)
                sb.sleep(wait_time)
                
                # בדיקת Cloudflare
                if sb.is_text_visible("Just a moment") or sb.is_text_visible("Checking"):
                    print("⏳ Cloudflare detected - waiting...")
                    sb.sleep(15)
                
                # קבלת תוכן
                content = sb.get_page_source()
                cookies = sb.get_cookies()
                current_url = sb.get_current_url()
                
                # המרת cookies לdict
                cookies_dict = {}
                for cookie in cookies:
                    cookies_dict[cookie['name']] = cookie['value']
                
                response_time = time.time() - start_time
                
                return ScrapeResponse(
                    success=True,
                    url=current_url,
                    status_code=200,
                    content=content,
                    cookies=cookies_dict,
                    headers={},
                    response_time=response_time
                )
                
        except Exception as e:
            response_time = time.time() - start_time
            print(f"❌ Error scraping {url}: {str(e)}")
            
            return ScrapeResponse(
                success=False,
                url=url,
                status_code=500,
                content=f"Error: {str(e)}",
                cookies={},
                headers={},
                response_time=response_time
            )

# יצירת instance של הסקרפר
scraper = PartsouqScraper()

@app.get("/")
async def root():
    """דף בית"""
    return {
        "message": "Partsouq Byparr API",
        "version": "1.0.0",
        "status": "running",
        "proxy_configured": bool(PROXY_CONFIG)
    }

@app.get("/health")
async def health_check():
    """בדיקת בריאות"""
    return {"status": "healthy", "proxy": "configured"}

@app.post("/scrape")
async def scrape_endpoint(request: ScrapeRequest):
    """נקודת כניסה לסקרייפינג"""
    
    print(f"📨 Scrape request: {request.url}")
    
    # בדיקת URL
    if not request.url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid URL")
    
    # ביצוע סקרייפינג
    result = await scraper.scrape_url(
        url=request.url,
        wait_time=request.wait_time or 10
    )
    
    return result

@app.get("/scrape-vin/{vin}")
async def scrape_vin(vin: str):
    """סקרייפינג VIN ספציפי"""
    
    partsouq_url = f"https://partsouq.com/en/search/all?q={vin}"
    
    result = await scraper.scrape_url(partsouq_url)
    
    # ניתוח תוצאות
    if result.success and 'partsouq' in result.content.lower():
        # בדיקה אם נמצאו תוצאות
        content_lower = result.content.lower()
        found_indicators = {
            'vin_found': vin.lower() in content_lower,
            'parts_found': 'part' in content_lower,
            'products_found': 'product' in content_lower,
            'prices_found': 'price' in content_lower
        }
        
        result_dict = result.dict()
        result_dict['analysis'] = found_indicators
        result_dict['search_term'] = vin
        
        return result_dict
    else:
        raise HTTPException(status_code=500, detail="Failed to scrape Partsouq")

@app.get("/test-partsouq")
async def test_partsouq():
    """בדיקה מהירה של Partsouq"""
    
    test_url = "https://partsouq.com"
    result = await scraper.scrape_url(test_url, wait_time=8)
    
    if result.success:
        return {
            "status": "success",
            "message": "Partsouq accessible",
            "response_time": result.response_time,
            "content_size": len(result.content),
            "has_partsouq_content": 'partsouq' in result.content.lower()
        }
    else:
        return {
            "status": "failed",
            "message": "Cannot access Partsouq",
            "error": result.content
        }

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting Partsouq Byparr API...")
    print(f"📍 Proxy configured: {bool(PROXY_CONFIG)}")
    
    # הפעלת השרת
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8080)),
        reload=False
    )
