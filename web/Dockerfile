# ── Stage 1: build the SPA ─────────────────────────────────────────────
# VITE_API_URL is baked in at build time, so it must be a build argument.
# In production nginx proxies /api to the api service, so the relative
# "/api/v1" keeps the browser on the same origin and removes CORS entirely.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ── Stage 2: serve ─────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
