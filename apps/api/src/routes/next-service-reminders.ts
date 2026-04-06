import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { NextServiceType } from '@prisma/client'
import { Errors } from '../utils/errors'

const createSchema = z.object({
  vehicleId: z.string(),
  type: z.nativeEnum(NextServiceType),
  title: z.string().min(1),
  dueDate: z.coerce.date(),
  reminderAt: z.array(z.coerce.date()).default([]),
  notes: z.string().optional(),
})

export default async function nextServiceReminderRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] }
  const receptionist = { preHandler: [app.authenticate, app.authorize(['ADMIN', 'RECEPTIONIST'])] }

  // 一覧
  app.get('/', auth, async (req) => {
    const q = req.query as any
    const where: any = {
      shopId: req.user.shopId,
      isCompleted: false,
      ...(q.type && { type: { in: (q.type as string).split(',') } }),
    }
    if (q.withinDays) {
      const limit = new Date()
      limit.setDate(limit.getDate() + Number(q.withinDays))
      where.dueDate = { lte: limit }
    }
    const reminders = await app.prisma.nextServiceReminder.findMany({
      where,
      include: { vehicle: { include: { customer: true } } },
      orderBy: { dueDate: 'asc' },
    })
    return { data: reminders }
  })

  // 作成
  app.post('/', auth, async (req, reply) => {
    const body = createSchema.parse(req.body)
    const vehicle = await app.prisma.vehicle.findFirst({
      where: { id: body.vehicleId, shopId: req.user.shopId },
    })
    if (!vehicle) throw Errors.notFound('車両が見つかりません')

    const reminder = await app.prisma.nextServiceReminder.create({
      data: { shopId: req.user.shopId, ...body },
      include: { vehicle: true },
    })
    return reply.status(201).send({ data: reminder })
  })

  // 更新
  app.put('/:id', receptionist, async (req) => {
    const { id } = req.params as any
    const body = createSchema.omit({ vehicleId: true }).partial().parse(req.body)
    const reminder = await app.prisma.nextServiceReminder.update({
      where: { id },
      data: body,
    })
    return { data: reminder }
  })

  // 対応済みにする
  app.patch('/:id/complete', receptionist, async (req) => {
    const { id } = req.params as any
    const reminder = await app.prisma.nextServiceReminder.update({
      where: { id },
      data: { isCompleted: true },
    })
    return { data: reminder }
  })

  // 削除
  app.delete('/:id', receptionist, async (req, reply) => {
    const { id } = req.params as any
    await app.prisma.nextServiceReminder.delete({ where: { id } })
    return reply.status(204).send()
  })
}
