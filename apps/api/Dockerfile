FROM node:20-alpine
WORKDIR /app

# 依存ファイルをコピー（apps/apiがrootDirectoryなのでそのまま）
COPY package*.json ./
COPY schema.prisma ./

# 依存関係インストール
RUN npm ci

# Prisma Client 生成
RUN npx prisma generate

# ソースコードをコピー
COPY src ./src
COPY tsconfig.json ./

# ビルド
RUN npm run build

# devDependencies削除
RUN npm prune --omit=dev

EXPOSE 3001

CMD ["node", "dist/index.js"]
