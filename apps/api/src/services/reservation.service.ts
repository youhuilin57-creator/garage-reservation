import { PrismaClient, ReservationStatus, Prisma } from '@prisma/client'
import { Errors } from '../utils/errors'
import { STATUS_TRANSITIONS, REMINDER_HOURS_BEFORE } from '../config/constants'
import { parsePagination } from '../utils/pagination'

const reservationInclude = {
  customer: true,
  vehicle: true,
  mechanic: { include: { user: { select: { name: true, email: true } } } },
  services: { include: { service: true } },
} satisfies Prisma.ReservationInclude

export class ReservationService {
  constructor(private prisma: PrismaClient) {}

  async list(shopId: string, filters: {
    startAt?: Date
    endAt?: Date
    mechanicId?: string
    status?: ReservationStatus[]
    customerId?: string
    page?: number
    limit?: number
  }) {
    const { skip, take, page, limit } = parsePagination(filters)
    const where: Prisma.ReservationWhereInput = {
      shopId,
      ...(filters.startAt && { startAt: { gte: filters.startAt } }),
      ...(filters.endAt && { endAt: { lte: filters.endAt } }),
      ...(filters.mechanicId && { mechanicId: filters.mechanicId }),
      ...(filters.status?.length && { status: { in: filters.status } }),
      ...(filters.customerId && { customerId: filters.customerId }),
    }

    const [data, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: reservationInclude,
        orderBy: { startAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.reservation.count({ where }),
    ])

    return { data, meta: { total, page, limit } }
  }

  async findById(shopId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, shopId },
      include: {
        ...reservationInclude,
        statusLogs: { orderBy: { createdAt: 'asc' } },
        invoice: true,
      },
    })
    if (!reservation) throw Errors.notFound('予約が見つかりません')
    return reservation
  }

  async checkConflict(params: {
    shopId: string
    mechanicId: string
    startAt: Date
    endAt: Date
    excludeId?: string
  }) {
    const conflicting = await this.prisma.reservation.findMany({
      where: {
        shopId: params.shopId,
        mechanicId: params.mechanicId,
        status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.DELIVERED] },
        startAt: { lt: params.endAt },
        endAt: { gt: params.startAt },
        ...(params.excludeId && { id: { not: params.excludeId } }),
      },
      include: { mechanic: true },
    })

    return {
      hasConflict: conflicting.length > 0,
      conflictingReservations: conflicting,
    }
  }

  async create(shopId: string, userId: string, data: {
    customerId: string
    vehicleId: string
    mechanicId?: string
    startAt: Date
    endAt: Date
    serviceIds: string[]
    notes?: string
    internalNotes?: string
  }) {
    // 顧客・車両の所有確認
    const [customer, vehicle] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: data.customerId, shopId } }),
      this.prisma.vehicle.findFirst({ where: { id: data.vehicleId, shopId, customerId: data.customerId } }),
    ])
    if (!customer) throw Errors.notFound('顧客が見つかりません')
    if (!vehicle) throw Errors.notFound('車両が見つかりません')

    // 重複チェック
    if (data.mechanicId) {
      const { hasConflict, conflictingReservations } = await this.checkConflict({
        shopId,
        mechanicId: data.mechanicId,
        startAt: data.startAt,
        endAt: data.endAt,
      })
      if (hasConflict) {
        throw Errors.conflict('この整備士はこの時間帯に予約があります', {
          conflictingReservations,
        })
      }
    }

    // 整備メニュー取得（価格スナップショット用）
    const services = await this.prisma.service.findMany({
      where: { id: { in: data.serviceIds }, shopId, isActive: true },
    })
    if (services.length !== data.serviceIds.length) {
      throw Errors.notFound('指定された整備メニューが見つかりません')
    }

    const reminderAt = new Date(data.startAt.getTime() - REMINDER_HOURS_BEFORE * 60 * 60 * 1000)

    return this.prisma.$transaction(async (tx) => {
      return tx.reservation.create({
        data: {
          shopId,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          mechanicId: data.mechanicId,
          startAt: data.startAt,
          endAt: data.endAt,
          notes: data.notes,
          internalNotes: data.internalNotes,
          services: {
            create: services.map((s) => ({
              serviceId: s.id,
              price: s.basePrice,
            })),
          },
          statusLogs: {
            create: {
              toStatus: ReservationStatus.RESERVED,
              changedByUserId: userId,
            },
          },
          reminders: {
            create: [{ scheduledAt: reminderAt }],
          },
        },
        include: reservationInclude,
      })
    })
  }

  async update(shopId: string, id: string, data: {
    mechanicId?: string | null
    startAt?: Date
    endAt?: Date
    notes?: string
    internalNotes?: string
    serviceIds?: string[]
  }) {
    const existing = await this.prisma.reservation.findFirst({ where: { id, shopId } })
    if (!existing) throw Errors.notFound('予約が見つかりません')

    if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(existing.status)) {
      throw Errors.unprocessable('完了・引渡し済・キャンセルの予約は変更できません')
    }

    // 時間変更 or 整備士変更時は重複チェック
    const newStart = data.startAt ?? existing.startAt
    const newEnd = data.endAt ?? existing.endAt
    const newMechanicId = data.mechanicId !== undefined ? data.mechanicId : existing.mechanicId

    if (newMechanicId) {
      const { hasConflict, conflictingReservations } = await this.checkConflict({
        shopId,
        mechanicId: newMechanicId,
        startAt: newStart,
        endAt: newEnd,
        excludeId: id,
      })
      if (hasConflict) {
        throw Errors.conflict('この整備士はこの時間帯に予約があります', { conflictingReservations })
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.serviceIds) {
        await tx.reservationService.deleteMany({ where: { reservationId: id } })
        const services = await tx.service.findMany({
          where: { id: { in: data.serviceIds }, shopId, isActive: true },
        })
        await tx.reservationService.createMany({
          data: services.map((s) => ({ reservationId: id, serviceId: s.id, price: s.basePrice })),
        })
      }

      return tx.reservation.update({
        where: { id },
        data: {
          mechanicId: data.mechanicId,
          startAt: data.startAt,
          endAt: data.endAt,
          notes: data.notes,
          internalNotes: data.internalNotes,
        },
        include: reservationInclude,
      })
    })
  }

  async updateStatus(shopId: string, userId: string, id: string, data: {
    status: ReservationStatus
    mileageAtService?: number
    notes?: string
  }) {
    const reservation = await this.prisma.reservation.findFirst({ where: { id, shopId } })
    if (!reservation) throw Errors.notFound('予約が見つかりません')

    const allowed = STATUS_TRANSITIONS[reservation.status] ?? []
    if (!allowed.includes(data.status)) {
      throw Errors.unprocessable(`${reservation.status} → ${data.status} への遷移は許可されていません`)
    }

    return this.prisma.$transaction(async (tx) => {
      // 入庫時に車両走行距離を更新
      if (data.status === ReservationStatus.ARRIVED && data.mileageAtService) {
        await tx.vehicle.update({
          where: { id: reservation.vehicleId },
          data: { lastMileage: data.mileageAtService },
        })
      }

      const updated = await tx.reservation.update({
        where: { id },
        data: {
          status: data.status,
          ...(data.mileageAtService && { mileageAtService: data.mileageAtService }),
        },
        include: reservationInclude,
      })

      await tx.reservationStatusLog.create({
        data: {
          reservationId: id,
          fromStatus: reservation.status,
          toStatus: data.status,
          changedByUserId: userId,
          notes: data.notes,
        },
      })

      return updated
    })
  }

  async delete(shopId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({ where: { id, shopId } })
    if (!reservation) throw Errors.notFound('予約が見つかりません')

    if (reservation.status === ReservationStatus.IN_PROGRESS) {
      throw Errors.unprocessable('整備中の予約は削除できません')
    }

    await this.prisma.reservation.delete({ where: { id } })
  }
}
