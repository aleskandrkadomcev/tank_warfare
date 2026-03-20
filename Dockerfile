# Сборка и runtime одного контейнера: Node.js сервер + статика Vite (client/dist).
# Используется из .k8s-deploy/deploy.ps1 (контекст сборки — корень репозитория).
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY shared ./shared
COPY server ./server
COPY client ./client

RUN npm run build

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3033
CMD ["node", "server/dist/index.js"]
