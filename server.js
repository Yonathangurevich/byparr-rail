const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8191;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Byparr proxy is running' });
});

// Main endpoint that mimics FlareSolverr
app.post('/v1', async (req, res) => {
    const { cmd, url, maxTimeout = 60000 } = req.body;
    
    console.log(`Processing request: ${cmd} for ${url}`);
    
    if (cmd === 'request.get') {
        try {
            // Try simple HTTP request first
            const response = await axios.get(url, {
                timeout: maxTimeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            res.json({
                status: 'ok',
                message: 'Success',
                solution: {
                    url: url,
                    status: response.status,
                    response: response.data,
                    cookies: [],
                    userAgent: response.config.headers['User-Agent']
                }
            });
        } catch (error) {
            // If simple request fails, try with Puppeteer
            console.log('Simple request failed, trying Puppeteer...');
            
            try {
                const browser = await puppeteer.launch({
                    headless: 'new',
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu'
                    ]
                });
                
                const page = await browser.newPage();
                await page.goto(url, { 
                    waitUntil: 'networkidle2',
                    timeout: maxTimeout 
                });
                
                const content = await page.content();
                const cookies = await page.cookies();
                
                await browser.close();
                
                res.json({
                    status: 'ok',
                    message: 'Success with Puppeteer',
                    solution: {
                        url: url,
                        status: 200,
                        response: content,
                        cookies: cookies,
                        userAgent: await page.evaluate(() => navigator.userAgent)
                    }
                });
            } catch (puppeteerError) {
                console.error('Puppeteer error:', puppeteerError);
                res.status(500).json({
                    status: 'error',
                    message: puppeteerError.message
                });
            }
        }
    } else {
        res.status(400).json({
            status: 'error',
            message: `Command ${cmd} not supported`
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Byparr Proxy Service',
        version: '1.0.0',
        endpoints: ['/v1', '/health']
    });
});

app.listen(PORT, () => {
    console.log(`Byparr proxy running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
