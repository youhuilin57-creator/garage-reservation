import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Errors } from '../utils/errors'
import { SLOT_MINUTES } from '../config/constants'

const workHourSchema = z.array(z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isWorkDay: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
}))

export default async function mechanicRoutes(app: FastifyInstance) {
  const auth = { preHandler: [app.authenticate] }
  const adminAuth = { preHandler: [app.authenticate, app.authorize(['ADMIN'])] }

  // 一覧
  app.get('/', auth, async (req) => {
    const mechanics = await app.prisma.mechanic.findMany({
      where: { shopId: req.user.shopId, isActive: true },
      include: {
        user: { select: { email: true } },
        mechanicServices: { include: { service: true } },
        workHours: { orderBy: { dayOfWeek: 'asc' } },
      },
      orderBy: { name: 'asc' },
    })
    return { data: mechanics }
  })

  // 詳細
  app.get('/:id', auth, async (req) => {
    const { id } = req.params as any
    const mechanic = await app.prisma.mechanic.findFirst({
      where: { id, shopId: req.user.shopId },
      include: {
        user: { select: { email: true } },
        mechanicServices: { include: { service: true } },
        workHours: { orderBy: { dayOfWeek: 'asc' } },
        schedules: { orderBy: { date: 'asc' } },
      },
    })
    if (!mechanic) throw Errors.notFound('整備士が見つかりません')
    return { data: mechanic }
  })

  // 通常勤務時間取得
  app.get('/:id/work-hours', auth, async (req) => {
    const { id } = req.params as any
    const workHours = await app.prisma.mechanicWorkHour.findMany({
      where: { mechanicId: id },
      orderBy: { dayOfWeek: 'asc' },
    })
    return { data: workHours }
  })

  // 通常勤務時間一括更新
  app.put('/:id/work-hours', adminAuth, async (req) => {
    const { id } = req.params as any
    const mechanic = await app.prisma.mechanic.findFirst({ where: { id, shopId: req.user.shopId } })
    if (!mechanic) throw Errors.notFound('整備士が見つかりません')

    const body = workHourSchema.parse(req.body)

    await app.prisma.$transaction(async (tx) => {
      await tx.mechanicWorkHour.deleteMany({ where: { mechanicId: id } })
      await tx.mechanicWorkHour.createMany({
        data: body.map((h) => ({ mechanicId: id, ...h })),
      })
    })

    const workHours = await app.prisma.mechanicWorkHour.findMany({
      where: { mechanicId: id },
      orderBy: { dayOfWeek: 'asc' },
    })
    return { data: workHours }
  })

  // 臨時スケジュール一覧
  app.get('/:id/schedules', auth, async (req) => {
    const { id } = req.params as any
    const q = req.query as any
    const schedules = await app.prisma.mechanicSchedule.findMany({
      where: {
        mechanicId: id,
        ...(q.from && { date: { gte: new Date(q.from) } }),
        ...(q.to && { date: { lte: new Date(q.to) } }),
      },
      orderBy: { date: 'asc' },
    })
    return { data: schedules }
  })

  // 臨時スケジュール更新
  app.put('/:id/schedules/:date', adminAuth, async (req) => {
    const { id, date } = req.params as any
    const body = z.object({
      isHoliday: z.boolean().default(false),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      notes: z.string().optional(),
    }).parse(req.body)

    const schedule = await app.prisma.mechanicSchedule.upsert({
      where: { mechanicId_date: { mechanicId: id, date: new Date(date) } },
      create: { mechanicId: id, date: new Date(date), ...body },
      update: body,
    })
    return { data: schedule }
  })

  // 臨時スケジュール削除
  app.delete('/:id/schedules/:date', adminAuth, async (req, reply) => {
    const { id, date } = req.params as any
    await app.prisma.mechanicSchedule.delete({
      where: { mechanicId_date: { mechanicId: id, date: new Date(date) } },
    })
    return reply.status(204).send()
  })

  // 空き時間スロット（勤務時間・臨時・工場休業日を考慮）
  app.get('/:id/availability', auth, async (req) => {
    const { id } = req.params as any
    const q = req.query as any
    const date = new Date(q.date)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayOfWeek = dateOnly.getDay()

    // 1. 工場休業日チェック
    const closedDay = await app.prisma.shopClosedDay.findUnique({
      where: { shopId_date: { shopId: req.user.shopId, date: dateOnly } },
    })
    if (closedDay?.allDay) return { data: { available: false, slots: [], reason: 'shop_closed' } }

    // 2. 整備士臨時スケジュールチェック
    const tempSchedule = await app.prisma.mechanicSchedule.findUnique({
      where: { mechanicId_date: { mechanicId: id, date: dateOnly } },
    })
    if (tempSchedule?.isHoliday) return { data: { available: false, slots: [], reason: 'mechanic_holiday' } }

    // 3. 通常勤務時間を取得
    const workHour = await app.prisma.mechanicWorkHour.findUnique({
      where: { mechanicId_dayOfWeek: { mechanicId: id, dayOfWeek } },
    })
    if (workHour && !workHour.isWorkDay) return { data: { available: false, slots: [], reason: 'day_off' } }

    // 勤務時間の決定（臨時 > 通常 > 工場デフォルト）
    const shop = await app.prisma.shop.findUnique({ where: { id: req.user.shopId } })
    const startStr = tempSchedule?.startTime ?? workHour?.startTime ?? shop?.openTime ?? '08:00'
    const endStr = tempSchedule?.endTime ?? workHour?.endTime ?? shop?.closeTime ?? '20:00'

    const [sh, sm] = startStr.split(':').map(Number)
    const [eh, em] = endStr.split(':').map(Number)
    const dayStart = new Date(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate(), sh, sm)
    const dayEnd = new Date(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate(), eh, em)

    // 4. 当日の予約済み時間帯を取得
    const reservations = await app.prisma.reservation.findMany({
      where: {
        mechanicId: id,
        shopId: req.user.shopId,
        status: { notIn: ['CANCELLED', 'DELIVERED'] },
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      orderBy: { startAt: 'asc' },
    })

    // 5. スロット生成
    const slots: { start: string; end: string; available: boolean }[] = []
    let current = new Date(dayStart)

    while (current.getTime() + SLOT_MINUTES * 60000 <= dayEnd.getTime()) {
      const slotEnd = new Date(current.getTime() + SLOT_MINUTES * 60000)
      const isBusy = reservations.some((r) => r.startAt < slotEnd && r.endAt > current)
      slots.push({
        start: toHHMM(current),
        end: toHHMM(slotEnd),
        available: !isBusy,
      })
      current = slotEnd
    }

    return { data: { available: true, slots } }
  })

  // 稼働率
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

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
