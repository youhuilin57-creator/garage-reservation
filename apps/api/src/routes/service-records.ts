import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Errors } from '../utils/errors'

const recordSchema = z.object({
  mileageAtDelivery: z.number().int().positive().optional(),
  workSummary: z.string().optional(),
  nextRecommend: z.string().optional(),
})

export default async function serviceRecordRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] }

  // 整備記録書取得
  app.get('/reservations/:id/service-record', auth, async (req) => {
    const { id } = req.params as any
    await assertReservationOwner(app, req.user.shopId, id)
    const record = await app.prisma.serviceRecord.findUnique({
      where: { reservationId: id },
    })
    if (!record) throw Errors.notFound('整備記録書が見つかりません')
    return { data: record }
  })

  // 整備記録書作成・更新（upsert）
  app.put('/reservations/:id/service-record', auth, async (req) => {
    const { id } = req.params as any
    await assertReservationOwner(app, req.user.shopId, id)
    const body = recordSchema.parse(req.body)
    const record = await app.prisma.serviceRecord.upsert({
      where: { reservationId: id },
      create: {
        reservationId: id,
        createdByUserId: req.user.id,
        ...body,
      },
      update: body,
    })
    return { data: record }
  })
}

async function assertReservationOwner(app: FastifyInstance, shopId: string, reservationId: string) {
  const reservation = await app.prisma.reservation.findFirst({
    where: { id: reservationId, shopId },
  })
  if (!reservation) throw Errors.notFound('予約が見つかりません')
  return reservation
}
