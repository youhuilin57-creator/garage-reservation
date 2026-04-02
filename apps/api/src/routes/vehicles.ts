import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Errors } from '../utils/errors'

const vehicleSchema = z.object({
  customerId: z.string(),
  plateNumber: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  vin: z.string().optional(),
  color: z.string().optional(),
  inspectionDate: z.coerce.date().optional(),
  nextServiceDate: z.coerce.date().optional(),
  lastMileage: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

export default async function vehicleRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (req) => {
    const q = req.query as any
    const shopId = req.user.shopId
    const where: any = { shopId }
    if (q.customerId) where.customerId = q.customerId
    if (q.plateNumber) where.plateNumber = { contains: q.plateNumber }

    const vehicles = await app.prisma.vehicle.findMany({
      where,
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return { data: vehicles }
  })

  // 車検切れ間近（30日以内）
  app.get('/expiring-inspection', auth, async (req) => {
    const shopId = req.user.shopId
    const days = Number((req.query as any).days ?? 30)
    const threshold = new Date()
    threshold.setDate(threshold.getDate() + days)

    const vehicles = await app.prisma.vehicle.findMany({
      where: {
        shopId,
        inspectionDate: { lte: threshold, gte: new Date() },
      },
      include: { customer: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { inspectionDate: 'asc' },
    })
    return { data: vehicles }
  })

  app.post('/', auth, async (req, reply) => {
    const body = vehicleSchema.parse(req.body)
    // 顧客が同一店舗か確認
    const customer = await app.prisma.customer.findFirst({
      where: { id: body.customerId, shopId: req.user.shopId },
    })
    if (!customer) throw Errors.notFound('顧客が見つかりません')

    const vehicle = await app.prisma.vehicle.create({
      data: { ...body, shopId: req.user.shopId },
      include: { customer: true },
    })
    return reply.status(201).send({ data: vehicle })
  })

  app.get('/:id', auth, async (req) => {
    const { id } = req.params as any
    const vehicle = await app.prisma.vehicle.findFirst({
      where: { id, shopId: req.user.shopId },
      include: { customer: true },
    })
    if (!vehicle) throw Errors.notFound('車両が見つかりません')
    return { data: vehicle }
  })

  app.put('/:id', auth, async (req) => {
    const { id } = req.params as any
    const body = vehicleSchema.partial().omit({ customerId: true }).parse(req.body)
    const existing = await app.prisma.vehicle.findFirst({ where: { id, shopId: req.user.shopId } })
    if (!existing) throw Errors.notFound('車両が見つかりません')
    const vehicle = await app.prisma.vehicle.update({ where: { id }, data: body })
    return { data: vehicle }
  })

  app.get('/:id/reservations', auth, async (req) => {
    const { id } = req.params as any
    const reservations = await app.prisma.reservation.findMany({
      where: { vehicleId: id, shopId: req.user.shopId },
      include: { services: { include: { service: true } }, mechanic: true },
      orderBy: { startAt: 'desc' },
    })
    return { data: reservations }
  })

  app.delete('/:id', {
    preHandler: [app.authenticate, app.authorize(['ADMIN'])],
  }, async (req, reply) => {
    const { id } = req.params as any
    const existing = await app.prisma.vehicle.findFirst({ where: { id, shopId: req.user.shopId } })
    if (!existing) throw Errors.notFound('車両が見つかりません')
    await app.prisma.vehicle.delete({ where: { id } })
    return reply.status(204).send()
  })
}
