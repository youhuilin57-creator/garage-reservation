import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { parsePagination } from '../utils/pagination'
import { Errors } from '../utils/errors'

const customerSchema = z.object({
  name: z.string().min(1),
  kana: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  birthday: z.coerce.date().optional(),
  notes: z.string().optional(),
})

export default async function customerRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (req) => {
    const q = req.query as any
    const { skip, take, page, limit } = parsePagination({ page: q.page, limit: q.limit })
    const shopId = req.user.shopId

    const where: any = { shopId }
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { kana: { contains: q.q, mode: 'insensitive' } },
        { phone: { contains: q.q } },
        { email: { contains: q.q, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      app.prisma.customer.findMany({
        where,
        include: { vehicles: { select: { id: true, plateNumber: true, make: true, model: true } } },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      app.prisma.customer.count({ where }),
    ])

    return { data, meta: { total, page, limit } }
  })

  app.post('/', auth, async (req, reply) => {
    const body = customerSchema.parse(req.body)
    const customer = await app.prisma.customer.create({
      data: { ...body, shopId: req.user.shopId },
    })
    return reply.status(201).send({ data: customer })
  })

  app.get('/:id', auth, async (req) => {
    const { id } = req.params as any
    const customer = await app.prisma.customer.findFirst({
      where: { id, shopId: req.user.shopId },
      include: { vehicles: true },
    })
    if (!customer) throw Errors.notFound('顧客が見つかりません')
    return { data: customer }
  })

  app.put('/:id', auth, async (req) => {
    const { id } = req.params as any
    const body = customerSchema.partial().parse(req.body)
    const existing = await app.prisma.customer.findFirst({ where: { id, shopId: req.user.shopId } })
    if (!existing) throw Errors.notFound('顧客が見つかりません')
    const customer = await app.prisma.customer.update({ where: { id }, data: body })
    return { data: customer }
  })

  app.get('/:id/vehicles', auth, async (req) => {
    const { id } = req.params as any
    const vehicles = await app.prisma.vehicle.findMany({
      where: { customerId: id, shopId: req.user.shopId },
      orderBy: { createdAt: 'desc' },
    })
    return { data: vehicles }
  })

  app.get('/:id/reservations', auth, async (req) => {
    const { id } = req.params as any
    const reservations = await app.prisma.reservation.findMany({
      where: { customerId: id, shopId: req.user.shopId },
      include: { vehicle: true, mechanic: true, services: { include: { service: true } } },
      orderBy: { startAt: 'desc' },
    })
    return { data: reservations }
  })

  app.delete('/:id', {
    preHandler: [app.authenticate, app.authorize(['ADMIN'])],
  }, async (req, reply) => {
    const { id } = req.params as any
    const existing = await app.prisma.customer.findFirst({ where: { id, shopId: req.user.shopId } })
    if (!existing) throw Errors.notFound('顧客が見つかりません')
    await app.prisma.customer.delete({ where: { id } })
    return reply.status(204).send()
  })
}
