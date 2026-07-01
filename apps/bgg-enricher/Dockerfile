FROM node:22-slim

WORKDIR /app
RUN corepack enable
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false --ignore-scripts

COPY tsconfig.base.json ./
COPY libs/data/db-postgres/prisma ./libs/data/db-postgres/prisma
RUN pnpm exec prisma generate --schema libs/data/db-postgres/prisma/schema.prisma

COPY apps/bgg-enricher ./apps/bgg-enricher

ENV BGG_ENRICHER_HEALTH_PORT=3002
EXPOSE 3002

CMD ["pnpm", "exec", "tsx", "--tsconfig", "apps/bgg-enricher/tsconfig.json", "apps/bgg-enricher/src/main.ts"]
