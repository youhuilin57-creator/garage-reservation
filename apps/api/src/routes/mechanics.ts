import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Errors } from '../utils/errors'

export default async function mechanicRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] }
  const adminAuth = { preHandler: [app.authenticate, app.authorize(['ADMIN'])] }

  app.get('/', auth, async (req) => {
    const mechanics = await app.prisma.mechanic.findMany({
      where: { shopId: req.user.shopId, isActive: true },
      include: {
        user: { select: { email: true } },
        mechanicServices: { include: { service: true } },
      },
      orderBy: { name: 'asc' },
    })
    return { data: mechanics }
  })

  app.get('/:id', auth, async (req) => {
    const { id } = req.params as any
    const mechanic = await app.prisma.mechanic.findFirst({
      where: { id, shopId: req.user.shopId },
      include: {
        user: { select: { email: true } },
        mechanicServices: { include: { service: true } },
        schedules: { orderBy: { date: 'asc' } },
      },
    })
    if (!mechanic) throw Errors.notFound('整備士が見つかりません')
    return { data: mechanic }
  })

  // 空き時間スロット
  app.get('/:id/availability', auth, async (req) => {
    const { id } = req.params as any
    const q = req.query as any
    const date = new Date(q.date)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8, 0)
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 20, 0)

    // 当日の特殊スケジュール確認
    const schedule = await app.prisma.mechanicSchedule.findFirst({
      where: {
        mechanicId: id,
        date: {
          gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
        },
      },
    })

    if (schedule?.isHoliday) {
      return { data: { available: false, slots: [] } }
    }

    // 当日の予約済み時間帯を取得
    const reservations = await app.prisma.reservation.findMany({
      where: {
        mechanicId: id,
        shopId: req.user.shopId,
        status: { notIn: ['CANCELLED', 'DELIVERED'] },
        startAt: { gte: dayStart },
        endAt: { lte: dayEnd },
      },
      orderBy: { startAt: 'asc' },
    })

    // 30分刻みで空きスロットを計算
    const slots: { start: string; end: string; available: boolean }[] = []
    const slotMinutes = 30
    let current = new Date(dayStart)

    while (current < dayEnd) {
      const slotEnd = new Date(current.getTime() + slotMinutes * 60000)
      const isBusy = reservations.some(
        (r) => r.startAt < slotEnd && r.endAt > current,
      )
      const hh = String(current.getHours()).padStart(2, '0')
      const mm = String(current.getMinutes()).padStart(2, '0')
      const ehh = String(slotEnd.getHours()).padStart(2, '0')
      const emm = String(slotEnd.getMinutes()).padStart(2, '0')
      slots.push({ start: `${hh}:${mm}`, end: `${ehh}:${emm}`, available: !isBusy })
      current = slotEnd
    }

    return { data: { available: true, slots } }
  })

  app.get('/utilization', adminAuth, async (req) => {
    const q = req.query as any
    const start = q.startAt ? new Date(q.startAt) : new Date()

    const mechanics = await app.prisma.mechanic.findMany({
      where: { shopId: req.user.shopId, isActive: true },
      include: {
        reservations: {
          where: { startAt: { gte: start }, status: { notIn: ['CANCELLED'] } },
        },
      },
    })

    const data = mechanics.map((m) => ({
      mechanicId: m.id,
      name: m.name,
      reservationCount: m.reservations.length,
      totalMinutes: m.reservations.reduce(
        (sum, r) => sum + (r.endAt.getTime() - r.startAt.getTime()) / 60000,
        0,
      ),
    }))

    return { data }
  })
}
