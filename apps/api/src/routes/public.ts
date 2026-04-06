import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Errors } from '../utils/errors'
import { NotificationService } from '../services/notification.service'

const selfBookSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().email().optional(),
  plateNumber: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900),
  serviceIds: z.array(z.string()).min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  notes: z.string().optional(),
})

export default async function publicRoutes(app: FastifyInstance) {
  const notifSvc = new NotificationService()

  // 空き枠取得
  app.get('/book/:token/availability', async (req) => {
    const { token } = req.params as any
    const { date, serviceIds } = req.query as { date?: string; serviceIds?: string }

    if (!date || !serviceIds) throw Errors.validation('date と serviceIds は必須です')

    const rt = await app.prisma.reservationToken.findUnique({
      where: { token },
      include: { shop: true },
    })
    if (!rt || !rt.isActive) throw Errors.notFound('予約ページが見つかりません')

    const shopId = rt.shopId
    const serviceIdList = serviceIds.split(',').filter(Boolean)

    // 合計作業時間（分）
    const services = await app.prisma.service.findMany({
      where: { id: { in: serviceIdList }, shopId, isActive: true },
    })
    const totalMin = services.reduce((sum, s) => sum + s.durationMin, 0)
    if (totalMin === 0) return { data: { slots: [] } }

    // 営業時間
    const [openH, openM] = rt.shop.openTime.split(':').map(Number)
    const [closeH, closeM] = rt.shop.closeTime.split(':').map(Number)

    // 対象日の予約一覧（キャンセル・引渡し済み除く）
    const dayStart = new Date(`${date}T00:00:00`)
    const dayEnd = new Date(`${date}T23:59:59`)
    const existingReservations = await app.prisma.reservation.findMany({
      where: {
        shopId,
        startAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ['CANCELLED', 'DELIVERED'] },
      },
      select: { mechanicId: true, startAt: true, endAt: true },
    })

    // 整備士一覧
    const mechanics = await app.prisma.mechanic.findMany({
      where: { shopId, isActive: true },
      select: { id: true },
    })

    // 30分刻みでスロット生成
    const slots: string[] = []
    const slotMin = rt.shop.slotMin ?? 30
    const openTotal = openH * 60 + openM
    const closeTotal = closeH * 60 + closeM

    for (let t = openTotal; t + totalMin <= closeTotal; t += slotMin) {
      const slotH = Math.floor(t / 60)
      const slotM = t % 60
      const slotStart = new Date(`${date}T${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}:00`)
      const slotEnd = new Date(slotStart.getTime() + totalMin * 60 * 1000)

      // 過去スロットは除外
      if (slotStart <= new Date()) continue

      if (mechanics.length === 0) {
        // 整備士未設定 → 時間枠内ならすべて空き
        slots.push(`${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`)
      } else {
        // 少なくとも1人の整備士が空いているか確認
        const hasAvailableMechanic = mechanics.some((mechanic) => {
          const conflicts = existingReservations.filter(
            (r) =>
              r.mechanicId === mechanic.id &&
              r.startAt < slotEnd &&
              r.endAt > slotStart,
          )
          return conflicts.length === 0
        })
        if (hasAvailableMechanic) {
          slots.push(`${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`)
        }
      }
    }

    return { data: { slots, totalMin } }
  })

  // トークン検証（公開予約ページの初期表示用）
  app.get('/book/:token', async (req) => {
    const { token } = req.params as any
    const rt = await app.prisma.reservationToken.findUnique({
      where: { token },
      include: { shop: { include: { services: { where: { isActive: true } } } } },
    })
    if (!rt || !rt.isActive) throw Errors.notFound('予約ページが見つかりません')
    if (rt.expiresAt && rt.expiresAt < new Date()) throw Errors.unprocessable('この予約ページは期限切れです')

    return {
      data: {
        shopName: rt.shop.name,
        shopPhone: rt.shop.phone,
        businessHours: {
          start: rt.shop.openTime,
          end: rt.shop.closeTime,
        },
        services: rt.shop.services,
      },
    }
  })

  // セルフ予約作成
  app.post('/book/:token', async (req, reply) => {
    const { token } = req.params as any
    const body = selfBookSchema.parse(req.body)

    const rt = await app.prisma.reservationToken.findUnique({
      where: { token },
      include: { shop: true },
    })
    if (!rt || !rt.isActive) throw Errors.notFound('予約ページが見つかりません')
    if (rt.expiresAt && rt.expiresAt < new Date()) throw Errors.unprocessable('この予約ページは期限切れです')

    const shopId = rt.shopId

    // 整備メニュー確認
    const services = await app.prisma.service.findMany({
      where: { id: { in: body.serviceIds }, shopId, isActive: true },
    })
    if (services.length !== body.serviceIds.length) {
      throw Errors.notFound('指定された整備メニューが見つかりません')
    }

    const reservation = await app.prisma.$transaction(async (tx) => {
      // 顧客検索 or 作成
      let customer = await tx.customer.findFirst({
        where: { shopId, phone: body.customerPhone },
      })
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            shopId,
            name: body.customerName,
            phone: body.customerPhone,
            email: body.customerEmail,
          },
        })
      }

      // 車両検索 or 作成
      let vehicle = await tx.vehicle.findFirst({
        where: { shopId, customerId: customer.id, plateNumber: body.plateNumber },
      })
      if (!vehicle) {
        vehicle = await tx.vehicle.create({
          data: {
            shopId,
            customerId: customer.id,
            plateNumber: body.plateNumber,
            make: body.make,
            model: body.model,
            year: body.year,
          },
        })
      }

      return tx.reservation.create({
        data: {
          shopId,
          customerId: customer.id,
          vehicleId: vehicle.id,
          startAt: body.startAt,
          endAt: body.endAt,
          notes: body.notes,
          services: {
            create: services.map((s) => ({ serviceId: s.id, price: s.basePrice })),
          },
          statusLogs: { create: { toStatus: 'RESERVED' } },
          reminders: {
            create: [{
              type: 'BOOKING_CONFIRM' as const,
              scheduledAt: new Date(),
            }, {
              type: 'REMINDER_DAY_BEFORE' as const,
              scheduledAt: new Date(body.startAt.getTime() - 24 * 60 * 60 * 1000),
            }],
          },
        },
        include: { customer: true, vehicle: true, services: { include: { service: true } } },
      })
    })

    // 確認メール送信
    if (body.customerEmail) {
      await notifSvc.sendReservationConfirmation({
        customerEmail: body.customerEmail,
        customerName: body.customerName,
        vehicleName: `${body.make} ${body.model}`,
        startAt: body.startAt,
        services: services.map((s) => s.name),
        shopName: rt.shop.name,
        shopPhone: rt.shop.phone ?? '',
      })
    }

    return reply.status(201).send({
      data: {
        reservationId: reservation.id,
        message: 'ご予約を承りました。確認メールをお送りしました。',
      },
    })
  })
}
