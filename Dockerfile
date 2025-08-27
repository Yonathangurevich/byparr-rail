FROM node:18

WORKDIR /app

RUN apt-get update && apt-get install -y chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json .
RUN npm install

COPY server.js .

EXPOSE 8080
CMD ["node", "server.js"]
