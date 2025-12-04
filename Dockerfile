# syntax=docker/dockerfile:1

# =============================================
# TailDeck Dockerfile
# Multi-stage build for optimal image size
# =============================================

# Base stage with Node.js
FROM node:20.19.6-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Placeholder env vars for build time (required by Next.js static analysis)
# These are overridden at runtime by actual values from docker-compose env_file
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV AUTH_SECRET="placeholder-secret-at-least-32-chars-long"
ENV AUTH_URL="http://localhost:3000"
ENV AUTH_AUTHENTIK_ID="placeholder"
ENV AUTH_AUTHENTIK_SECRET="placeholder"
ENV AUTH_AUTHENTIK_ISSUER="http://localhost:9000/application/o/placeholder/"
ENV HEADSCALE_URL="http://localhost:8080"
ENV HEADSCALE_API_KEY="placeholder-api-key"

RUN npm run build

# Runner stage (production)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma files for runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
