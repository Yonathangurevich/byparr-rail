const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

async function scrape(url) {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ]
    });
    
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Check for Cloudflare
    const title = await page.title();
    if (title.includes('Just a moment')) {
        console.log('Cloudflare detected, waiting...');
        await page.waitForTimeout(10000);
    }
    
    const content = await page.content();
    const finalUrl = page.url();
    
    await browser.close();
    
    return { content, url: finalUrl };
}

app.post('/v1', async (req, res) => {
    try {
        const { url } = req.body;
        const result = await scrape(url);
        
        res.json({
            status: 'ok',
            solution: {
                response: result.content,
                url: result.url
            }
        });
    } catch (error) {
        res.json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.send('Scraper Running');
});

app.listen(PORT, () => {
    console.log(`Server on port ${PORT}`);
});
