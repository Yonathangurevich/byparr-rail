# Dockerfile - תיקון Browser Init Failed
FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy

WORKDIR /app

# העתקה והתקנת requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# הגדרת Playwright browsers לפני העתקת הקוד
ENV PLAYWRIGHT_BROWSERS_PATH=0

# התקנת Chromium עם כל התלויות
RUN playwright install --with-deps chromium

# העתקת הקוד
COPY . .

EXPOSE 10000

# הפעלה ישירה עם uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
