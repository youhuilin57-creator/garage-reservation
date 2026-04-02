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
          start: rt.shop.businessHoursStart,
          end: rt.shop.businessHoursEnd,
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
