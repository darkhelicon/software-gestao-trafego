# ========================
# Base
# ========================
FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ========================
# Dependencies
# ========================
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/integrations/package.json ./packages/integrations/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# ========================
# Development
# ========================
FROM deps AS development
COPY . .
RUN pnpm --filter @helzo-scale/database db:generate
EXPOSE 3001
CMD ["pnpm", "--filter", "@helzo-scale/api", "dev"]

# ========================
# Builder
# ========================
FROM deps AS builder
COPY . .
RUN pnpm --filter @helzo-scale/database db:generate
RUN pnpm --filter @helzo-scale/config build
RUN pnpm --filter @helzo-scale/types build
RUN pnpm --filter @helzo-scale/integrations build
RUN pnpm --filter @helzo-scale/database build
RUN pnpm --filter @helzo-scale/api build

# ========================
# Production
# ========================
FROM node:20-alpine AS production
RUN npm install -g pnpm@9
WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/config/package.json ./packages/config/
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/integrations/package.json ./packages/integrations/
COPY --from=builder /app/apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/integrations/dist ./packages/integrations/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

RUN pnpm --filter @helzo-scale/database db:generate

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
