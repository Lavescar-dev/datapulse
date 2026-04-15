FROM oven/bun:1.3.0

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  libglib2.0-0 \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libdbus-1-3 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  fonts-liberation \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY shared/package.json shared/package.json

RUN bun install --frozen-lockfile

COPY backend ./backend
COPY shared ./shared

ENV NODE_ENV=production
ENV PORT=8080
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app/backend

EXPOSE 8080

CMD ["bun", "run", "start"]
