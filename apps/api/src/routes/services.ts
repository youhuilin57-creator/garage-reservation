import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Errors } from '../utils/errors'

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMin: z.number().int().positive(),
  basePrice: z.number().positive().optional(),
  isActive: z.boolean().optional(),
})

export default async function serviceRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] }
  const adminAuth = { preHandler: [app.authenticate, app.authorize(['ADMIN'])] }

  app.get('/', auth, async (req) => {
    const services = await app.prisma.service.findMany({
      where: { shopId: req.user.shopId, isActive: true },
      orderBy: { name: 'asc' },
    })
    return { data: services }
  })

  app.post('/', adminAuth, async (req, reply) => {
    const body = serviceSchema.parse(req.body)
    const service = await app.prisma.service.create({
      data: { ...body, shopId: req.user.shopId },
    })
    return reply.status(201).send({ data: service })
  })

  app.put('/:id', adminAuth, async (req) => {
    const { id } = req.params as any
    const body = serviceSchema.partial().parse(req.body)
    const existing = await app.prisma.service.findFirst({ where: { id, shopId: req.user.shopId } })
    if (!existing) throw Errors.notFound('整備メニューが見つかりません')
    const service = await app.prisma.service.update({ where: { id }, data: body })
    return { data: service }
  })

  // ソフト削除（isActive: false）
  app.delete('/:id', adminAuth, async (req, reply) => {
    const { id } = req.params as any
    const existing = await app.prisma.service.findFirst({ where: { id, shopId: req.user.shopId } })
    if (!existing) throw Errors.notFound('整備メニューが見つかりません')
    await app.prisma.service.update({ where: { id }, data: { isActive: false } })
    return reply.status(204).send()
  })
}
