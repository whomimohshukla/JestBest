# ── Stage 1: build ─────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Lockfile first: `npm ci` is reproducible and caches independently of source.
COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY prisma ./prisma
RUN npx prisma generate
RUN npm run build

# ── Stage 2: production ────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
# prisma is a runtime dependency on purpose: the container runs
# `npx prisma migrate deploy` before starting the server.
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

# Playwright is only needed for real browser execution. Installing the browser
# and its OS libraries roughly doubles the image, so it is opt-in:
#   docker build --build-arg INSTALL_BROWSERS=1 .
# Without it the API, tests, webhooks and every non-browser flow work normally.
# The path must be a fixed, world-readable location: the process runs as an
# unprivileged user, and a browser cached under /root would be unreachable.
ARG INSTALL_BROWSERS=0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN mkdir -p /ms-playwright \
    && if [ "$INSTALL_BROWSERS" = "1" ]; then \
         npx playwright install --with-deps chromium; \
       fi

# Run as the unprivileged image user; 4000 needs no root.
RUN addgroup -S jestbest && adduser -S jestbest -G jestbest \
    && chown -R jestbest:jestbest /app /ms-playwright
USER jestbest

EXPOSE 4000

CMD ["node", "dist/server.js"]
