# Dockerfile - Production Ready for Render/Railway
FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

# הגדרת משתני סביבה חיוניים
ENV PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# התקנת תלויות מערכת נוספות
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# העתקת requirements והתקנה
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# התקנת Playwright עם כל התלויות
RUN playwright install chromium && \
    playwright install-deps chromium

# העתקת קוד האפליקציה
COPY main.py .

# יצירת משתמש לא-root
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app

USER appuser

# חשיפת פורט
EXPOSE 10000

# הפעלה עם uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000", "--workers", "1"]
