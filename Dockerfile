# Dockerfile מתוקן עבור Railway + Byparr + Proxy
FROM python:3.11-slim

# הגדרת משתנים
ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:99
ENV PROXY_URL=http://smart-byparr:1209QWEasdzxcv@gate.smartproxy.com:10000

# התקנת תלויות מערכת נדרשות
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    unzip \
    curl \
    xvfb \
    chromium \
    chromium-driver \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# התקנת Chrome (אם chromium לא מספיק)
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# יצירת תיקיית עבודה
WORKDIR /app

# העתקת קבצי Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# התקנת Byparr
RUN pip install git+https://github.com/ThePhaseless/Byparr.git

# העתקת קבצי האפליקציה
COPY . .

# יצירת סקריפט הפעלה
RUN echo '#!/bin/bash\n\
Xvfb :99 -screen 0 1024x768x24 &\n\
export DISPLAY=:99\n\
python main.py\n\
' > /app/start.sh && chmod +x /app/start.sh

# Port
EXPOSE 8080

# הפעלה
CMD ["/app/start.sh"]
