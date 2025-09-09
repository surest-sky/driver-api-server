# Multi-stage build
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* .npmrc* ./
RUN npm ci || npm install

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./package.json

# wait for MySQL then init DB and start server
CMD sh -c "echo Waiting for DB... && for i in 1 2 3 4 5 6 7 8 9 10; do nc -z $DB_HOST $DB_PORT && break || sleep 2; done; node dist/init-db.js && node dist/main.js"

