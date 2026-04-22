FROM node:20-alpine AS base
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

# ─── deps layer ──────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install --include=dev

# ─── build ───────────────────────────────────────
FROM deps AS builder
COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
RUN npm run build

# ─── runner ──────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

# La porta la fornisce Railway via $PORT — Fastify la legge da env
EXPOSE 3000

# Default: API server. Il worker usa lo stesso image con comando override.
CMD ["node", "dist/index.js"]
