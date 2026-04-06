import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Errors } from '../utils/errors'

const partSchema = z.object({
  partNumber: z.string().optional(),
  name: z.string().min(1),
  unitPrice: z.number().positive(),
  quantity: z.number().int().positive().default(1),
  notes: z.string().optional(),
})

export default async function partRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] }

  // 部品一覧取得
  app.get('/reservations/:id/parts', auth, async (req) => {
    const { id } = req.params as any
    await assertReservationOwner(app, req.user.shopId, id)
    const parts = await app.prisma.reservationPart.findMany({
      where: { reservationId: id },
      orderBy: { createdAt: 'asc' },
    })
    return { data: parts }
  })

  // 部品追加
  app.post('/reservations/:id/parts', auth, async (req, reply) => {
    const { id } = req.params as any
    await assertReservationOwner(app, req.user.shopId, id)
    const body = partSchema.parse(req.body)
    const part = await app.prisma.reservationPart.create({
      data: { reservationId: id, ...body },
    })
    return reply.status(201).send({ data: part })
  })

  // 部品更新
  app.put('/reservations/:id/parts/:partId', auth, async (req) => {
    const { id, partId } = req.params as any
    await assertReservationOwner(app, req.user.shopId, id)
    const body = partSchema.partial().parse(req.body)
    const part = await app.prisma.reservationPart.update({
      where: { id: partId },
      data: body,
    })
    return { data: part }
  })

  // 部品削除
  app.delete('/reservations/:id/parts/:partId', {
    preHandler: [app.authenticate, app.authorize(['ADMIN', 'RECEPTIONIST'])],
  }, async (req, reply) => {
    const { id, partId } = req.params as any
    await assertReservationOwner(app, req.user.shopId, id)
    await app.prisma.reservationPart.delete({ where: { id: partId } })
    return reply.status(204).send()
  })
}

async function assertReservationOwner(app: FastifyInstance, shopId: string, reservationId: string) {
  const reservation = await app.prisma.reservation.findFirst({
    where: { id: reservationId, shopId },
  })
  if (!reservation) throw Errors.notFound('予約が見つかりません')
  return reservation
}
