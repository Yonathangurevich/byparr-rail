# Dockerfile - Byparr מקצועי בענן
FROM python:3.11-bullseye

# הגדרת משתנים
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99

# התקנת תלויות מערכת
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates \
    xvfb x11vnc fluxbox \
    fonts-liberation fonts-dejavu-core fonts-freefont-ttf \
    --no-install-recommends

# התקנת Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# יצירת משתמש לא-root
RUN useradd -m -s /bin/bash scraper
USER scraper
WORKDIR /home/scraper

# התקנת Byparr מהמקור
RUN pip install --user git+https://github.com/ThePhaseless/Byparr.git

# התקנת תלויות נוספות
RUN pip install --user \
    fastapi \
    uvicorn \
    requests \
    seleniumbase \
    undetected-chromedriver

# העתקת הקוד שלנו
COPY --chown=scraper:scraper . .

# הוספת Python packages לPATH
ENV PATH="/home/scraper/.local/bin:$PATH"

# יצירת סקריפט הפעלה
RUN echo '#!/bin/bash\n\
export DISPLAY=:99\n\
Xvfb :99 -screen 0 1920x1080x24 &\n\
sleep 2\n\
python byparr_api.py\n\
' > start.sh && chmod +x start.sh

EXPOSE 10000

CMD ["./start.sh"]
