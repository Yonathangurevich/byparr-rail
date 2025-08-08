# Dockerfile - מתוקן לפי הפידבק
FROM mcr.microsoft.com/playwright/python:v1.44.0-focal

WORKDIR /app

# העתקה והתקנת requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# העתקת הקוד
COPY . .

# הגדרת Playwright browsers
ENV PLAYWRIGHT_BROWSERS_PATH=0
RUN playwright install --with-deps

EXPOSE 10000

# הפעלה ישירה עם uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
