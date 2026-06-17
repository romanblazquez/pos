FROM node:22-slim

WORKDIR /app
RUN corepack enable

# Install workspace deps (bgg-scraper has no own package.json — it shares the root's)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false --ignore-scripts

# Playwright's own Chromium + the OS libs it needs to actually render pages.
RUN pnpm exec playwright install --with-deps chromium

COPY tsconfig.base.json ./
COPY apps/bgg-scraper ./apps/bgg-scraper

ENV PORT=3001
EXPOSE 3001

CMD ["pnpm", "exec", "tsx", "--tsconfig", "apps/bgg-scraper/tsconfig.json", "apps/bgg-scraper/src/main.ts"]
