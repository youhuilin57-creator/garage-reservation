FROM node:20-alpine
WORKDIR /app

# モノレポのルートから依存ファイルをコピー
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/database/package*.json ./packages/database/

# 全依存関係インストール
RUN npm ci

# ソースコードをコピー
COPY apps/api ./apps/api
COPY packages/database ./packages/database

# Prisma Client 生成
RUN npx prisma generate --schema=packages/database/schema.prisma

# API ビルド
RUN npm run build --workspace=apps/api

# 不要なdevDependenciesを削除（任意）
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
