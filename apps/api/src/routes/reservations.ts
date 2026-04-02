import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ReservationStatus } from '@prisma/client'
import { ReservationService } from '../services/reservation.service'

const createSchema = z.object({
  customerId: z.string(),
  vehicleId: z.string(),
  mechanicId: z.string().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  serviceIds: z.array(z.string()).min(1),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
})

const updateStatusSchema = z.object({
  status: z.nativeEnum(ReservationStatus),
  mileageAtService: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

export default async function reservationRoutes(app: FastifyInstance) {
  const svc = new ReservationService(app.prisma)
  const auth = { preHandler: [app.authenticate] }

  // 重複チェック
  app.get('/conflict-check', auth, async (req) => {
    const q = req.query as any
    const result = await svc.checkConflict({
      shopId: req.user.shopId,
      mechanicId: q.mechanicId,
      startAt: new Date(q.startAt),
      endAt: new Date(q.endAt),
      excludeId: q.excludeId,
    })
    return { data: result }
  })

  // 一覧
  app.get('/', auth, async (req) => {
    const q = req.query as any
    const result = await svc.list(req.user.shopId, {
      startAt: q.startAt ? new Date(q.startAt) : undefined,
      endAt: q.endAt ? new Date(q.endAt) : undefined,
      mechanicId: q.mechanicId,
      status: q.status ? (q.status as string).split(',') as ReservationStatus[] : undefined,
      customerId: q.customerId,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 100,
    })
    return result
  })

  // 作成
  app.post('/', auth, async (req, reply) => {
    const body = createSchema.parse(req.body)
    const reservation = await svc.create(req.user.shopId, req.user.id, body)
    return reply.status(201).send({ data: reservation })
  })

  // 詳細
  app.get('/:id', auth, async (req) => {
    const { id } = req.params as any
    const reservation = await svc.findById(req.user.shopId, id)
    return { data: reservation }
  })

  // 更新
  app.put('/:id', auth, async (req) => {
    const { id } = req.params as any
    const body = createSchema.partial().parse(req.body)
    const reservation = await svc.update(req.user.shopId, id, body)
    return { data: reservation }
  })

  // ステータス変更
  app.patch('/:id/status', auth, async (req) => {
    const { id } = req.params as any
    const body = updateStatusSchema.parse(req.body)
    const reservation = await svc.updateStatus(req.user.shopId, req.user.id, id, body)
    return { data: reservation }
  })

  // 削除
  app.delete('/:id', {
    preHandler: [app.authenticate, app.authorize(['ADMIN'])],
  }, async (req, reply) => {
    const { id } = req.params as any
    await svc.delete(req.user.shopId, id)
    return reply.status(204).send()
  })
}
