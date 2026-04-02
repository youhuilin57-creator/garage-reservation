import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import { AuthService } from '../services/auth.service'
import { Errors } from '../utils/errors'

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole),
})

export default async function userRoutes(app: FastifyInstance) {
  const authService = new AuthService(app.prisma)
  const adminAuth = { preHandler: [app.authenticate, app.authorize(['ADMIN'])] }
  const selfAuth = { preHandler: [app.authenticate] }

  app.get('/', adminAuth, async (req) => {
    const users = await app.prisma.user.findMany({
      where: { shopId: req.user.shopId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    return { data: users }
  })

  app.post('/', adminAuth, async (req, reply) => {
    const body = createUserSchema.parse(req.body)
    const existing = await app.prisma.user.findUnique({ where: { email: body.email } })
    if (existing) throw Errors.conflict('このメールアドレスはすでに使用されています')

    const passwordHash = await authService.hashPassword(body.password)
    const user = await app.prisma.user.create({
      data: { shopId: req.user.shopId, email: body.email, passwordHash, name: body.name, role: body.role },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })

    // MECHANIC ロールなら Mechanic レコードも作成
    if (body.role === UserRole.MECHANIC) {
      await app.prisma.mechanic.create({
        data: { shopId: req.user.shopId, userId: user.id, name: body.name },
      })
    }

    return reply.status(201).send({ data: user })
  })

  app.put('/:id', adminAuth, async (req) => {
    const { id } = req.params as any
    const body = createUserSchema.omit({ password: true }).partial().parse(req.body)
    const existing = await app.prisma.user.findFirst({ where: { id, shopId: req.user.shopId } })
    if (!existing) throw Errors.notFound('ユーザーが見つかりません')
    const user = await app.prisma.user.update({
      where: { id },
      data: body,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })
    return { data: user }
  })

  app.patch('/:id/password', selfAuth, async (req, reply) => {
    const { id } = req.params as any
    // 自分自身 or ADMIN のみ
    if (req.user.id !== id && req.user.role !== 'ADMIN') {
      throw Errors.forbidden()
    }
    const { password } = req.body as any
    if (!password || password.length < 8) {
      throw Errors.validation('パスワードは8文字以上必要です')
    }
    const passwordHash = await authService.hashPassword(password)
    await app.prisma.user.update({ where: { id }, data: { passwordHash } })
    return reply.status(204).send()
  })
}
