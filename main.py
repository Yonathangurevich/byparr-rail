from fastapi import FastAPI, HTTPException
import os
import asyncio
from seleniumbase import SB
import time

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Partsouq Scraper Working!", "status": "online"}

@app.get("/health")  
def health():
    return {"status": "healthy"}

@app.get("/test-simple")
def test_simple():
    """בדיקה פשוטה בלי סלניום"""
    import requests
    
    proxy = {
        'http': 'http://smart-byparr:1209QWEasdzxcv@gate.smartproxy.com:10000',
        'https': 'http://smart-byparr:1209QWEasdzxcv@gate.smartproxy.com:10000'
    }
    
    try:
        response = requests.get('http://httpbin.org/ip', proxies=proxy, timeout=10)
        return {"proxy_works": True, "ip": response.json()}
    except Exception as e:
        return {"proxy_works": False, "error": str(e)}

@app.get("/scrape-vin/{vin}")
def scrape_vin(vin: str):
    """חיפוש VIN בPartsouq"""
    
    proxy_string = "smart-byparr:1209QWEasdzxcv@gate.smartproxy.com:10000"
    url = f"https://partsouq.com/en/search/all?q={vin}"
    
    try:
        with SB(uc=True, headless=True, proxy=proxy_string) as sb:
            sb.open(url)
            sb.sleep(10)
            
            content = sb.get_page_source()
            
            return {
                "success": True,
                "url": url,
                "vin": vin,
                "content_size": len(content),
                "has_partsouq": 'partsouq' in content.lower(),
                "has_vin": vin.lower() in content.lower()
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
