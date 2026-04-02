import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AuthService } from '../services/auth.service'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export default async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app.prisma)

  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body)
    const result = await authService.login(body.email, body.password)

    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 60 * 60 * 24 * 7,
    })

    return { data: { accessToken: result.accessToken, user: result.user } }
  })

  app.post('/logout', async (req, reply) => {
    const token = req.cookies.refreshToken
    if (token) await authService.logout(token)
    reply.clearCookie('refreshToken', { path: '/api/v1/auth' })
    return { data: { ok: true } }
  })

  app.post('/refresh', async (req, reply) => {
    const token = req.cookies.refreshToken
    if (!token) return reply.status(401).send({ error: { code: 'UNAUTHORIZED' } })

    const result = await authService.refresh(token)

    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 60 * 60 * 24 * 7,
    })

    return { data: { accessToken: result.accessToken } }
  })

  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (req) => {
    const user = await app.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { shop: true },
    })
    return { data: user }
  })
}
