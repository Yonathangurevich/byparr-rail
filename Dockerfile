# Dockerfile - Playwright Stealth (קל ומהיר)
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

# הגדרות בסיסיות
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# יצירת משתמש
RUN useradd -m -s /bin/bash scraper
USER scraper
WORKDIR /home/scraper

# התקנת Python packages
COPY --chown=scraper:scraper requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# העתקת הקוד
COPY --chown=scraper:scraper . .

# הוספת Python packages לPATH
ENV PATH="/home/scraper/.local/bin:$PATH"

EXPOSE 10000

CMD ["python", "main.py"]
