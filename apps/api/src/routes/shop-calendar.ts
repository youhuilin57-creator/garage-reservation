import { FastifyInstance } from 'fastify'
import { z } from 'zod'

const closedDaySchema = z.object({
  date: z.coerce.date(),
  allDay: z.boolean().default(true),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().optional(),
})

export default async function shopCalendarRoutes(app: FastifyInstance) {
  const adminOnly = { preHandler: [app.authenticate, app.authorize(['ADMIN'])] }
  const auth = { preHandler: [app.authenticate] }

  // 休業日一覧
  app.get('/closed-days', auth, async (req) => {
    const q = req.query as any
    const where: any = { shopId: req.user.shopId }
    if (q.from) where.date = { gte: new Date(q.from) }
    if (q.to) where.date = { ...where.date, lte: new Date(q.to) }

    const days = await app.prisma.shopClosedDay.findMany({
      where,
      orderBy: { date: 'asc' },
    })
    return { data: days }
  })

  // 休業日登録
  app.post('/closed-days', adminOnly, async (req, reply) => {
    const body = closedDaySchema.parse(req.body)
    const day = await app.prisma.shopClosedDay.upsert({
      where: { shopId_date: { shopId: req.user.shopId, date: body.date } },
      create: { shopId: req.user.shopId, ...body },
      update: body,
    })
    return reply.status(201).send({ data: day })
  })

  // 休業日更新
  app.put('/closed-days/:date', adminOnly, async (req) => {
    const { date } = req.params as any
    const body = closedDaySchema.partial().parse(req.body)
    const day = await app.prisma.shopClosedDay.update({
      where: { shopId_date: { shopId: req.user.shopId, date: new Date(date) } },
      data: body,
    })
    return { data: day }
  })

  // 休業日削除
  app.delete('/closed-days/:date', adminOnly, async (req, reply) => {
    const { date } = req.params as any
    await app.prisma.shopClosedDay.delete({
      where: { shopId_date: { shopId: req.user.shopId, date: new Date(date) } },
    })
    return reply.status(204).send()
  })
}
