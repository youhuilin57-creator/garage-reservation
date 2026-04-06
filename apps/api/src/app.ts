import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { env } from './config/env'
import prismaPlugin from './plugins/prisma'
import authPlugin from './plugins/auth'
import { registerRoutes } from './routes'

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: true,
  })

  // セキュリティ
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, {
    origin: env.FRONTEND_URL,
    credentials: true,
  })
  await app.register(cookie, { secret: env.JWT_SECRET })
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  // プラグイン
  await app.register(prismaPlugin)
  await app.register(authPlugin)

  // ルート
  await app.register(registerRoutes, { prefix: '/api/v1' })

  // ヘルスチェック
  app.get('/health', async () => ({ status: 'ok', version: '1.1.0' }))

  return app
}
