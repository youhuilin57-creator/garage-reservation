import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Errors } from '../utils/errors'

const createSchema = z.object({
  label: z.string().optional(),
  expiresAt: z.coerce.date().optional(),
})

const updateSchema = z.object({
  label: z.string().optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
})

export default async function reservationTokenRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: [app.authenticate, app.authorize(['ADMIN'])] }

  // 一覧
  app.get('/', adminOnly, async (req) => {
    const { shopId } = req.user
    const tokens = await app.prisma.reservationToken.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
    })
    return { data: tokens }
  })

  // 生成
  app.post('/', adminOnly, async (req, reply) => {
    const { shopId } = req.user
    const body = createSchema.parse(req.body)
    const token = await app.prisma.reservationToken.create({
      data: { shopId, ...body },
    })
    return reply.status(201).send({ data: token })
  })

  // 更新（ラベル・有効フラグ・有効期限）
  app.patch('/:id', adminOnly, async (req) => {
    const { id } = req.params as { id: string }
    const { shopId } = req.user
    const body = updateSchema.parse(req.body)

    const existing = await app.prisma.reservationToken.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shopId) throw Errors.notFound('トークンが見つかりません')

    const token = await app.prisma.reservationToken.update({
      where: { id },
      data: body,
    })
    return { data: token }
  })

  // 削除
  app.delete('/:id', adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { shopId } = req.user

    const existing = await app.prisma.reservationToken.findUnique({ where: { id } })
    if (!existing || existing.shopId !== shopId) throw Errors.notFound('トークンが見つかりません')

    await app.prisma.reservationToken.delete({ where: { id } })
    return reply.status(204).send()
  })
}
