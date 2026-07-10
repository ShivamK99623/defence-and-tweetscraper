# syntax=docker/dockerfile:1.7

############################
# Builder
############################
FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .

RUN npm run build

############################
# Runtime
############################
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Standalone output already contains a minimal node_modules + server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/filters >/dev/null || exit 1

CMD ["node", "server.js"]