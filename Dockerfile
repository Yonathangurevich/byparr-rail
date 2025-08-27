# Use Node.js 20 slim for optimal performance
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Environment variables for Cloud Run (removed problematic NODE_OPTIONS)
ENV PUPPETEER_SKIP_DOWNLOAD=false
ENV NODE_ENV=production
ENV PORT=8080

# Install system dependencies required by Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libgconf-2-4 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    fonts-liberation \
    libappindicator3-1 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgbm1 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Copy application source code
COPY . .

# Create user to run the application (security best practice)
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /usr/src/app

# Switch to non-root user
USER pptruser

# Expose the port
EXPOSE 8080

# Health check for Cloud Run
HEALTHCHECK --interval=30s --timeout=15s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))" || exit 1

# Start the application
CMD ["node", "server.js"]
