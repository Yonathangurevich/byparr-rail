# Simple Dockerfile that should definitely work
FROM node:20-slim

WORKDIR /usr/src/app

# Basic environment setup
ENV NODE_ENV=production
ENV PORT=8080
ENV PUPPETEER_SKIP_DOWNLOAD=false

# Install basic dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy and install npm packages
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Simple health check
HEALTHCHECK CMD curl --fail http://localhost:8080/health || exit 1

# Start the app
CMD ["node", "server.js"]
