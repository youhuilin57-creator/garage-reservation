import fp from 'fastify-plugin'
import { verifyAccessToken } from '../utils/token'
import { Errors } from '../utils/errors'

export default fp(async (app) => {
  app.decorate('authenticate', async (req: any, reply: any) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: Errors.unauthorized() })
    }
    try {
      const payload = await verifyAccessToken(auth.slice(7))
      req.user = { id: payload.sub, role: payload.role, shopId: payload.shopId }
    } catch {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'トークンが無効です' } })
    }
  })

  app.decorate('authorize', (roles: string[]) => async (req: any, reply: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: '権限がありません' } })
    }
  })

  // エラーハンドラー
  app.setErrorHandler((error: any, _req, reply) => {
    if (error.name === 'AppError') {
      return reply.status(error.statusCode ?? 400).send({
        error: { code: error.code, message: error.message, details: error.details },
      })
    }
    app.log.error(error)
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'サーバーエラーが発生しました' },
    })
  })
})
