import { PrismaClient, ReservationStatus, ReminderType, Prisma } from '@prisma/client'
import { Errors } from '../utils/errors'
import { STATUS_TRANSITIONS, MECHANIC_ALLOWED_TRANSITIONS } from '../config/constants'
import { parsePagination } from '../utils/pagination'

const reservationInclude = {
  customer: true,
  vehicle: true,
  mechanic: { include: { user: { select: { name: true, email: true } } } },
  services: { include: { service: true } },
  parts: true,
} satisfies Prisma.ReservationInclude

export class ReservationService {
  constructor(private prisma: PrismaClient) {}

  async list(shopId: string, filters: {
    startAt?: Date
    endAt?: Date
    mechanicId?: string
    status?: ReservationStatus[]
    customerId?: string
    isWalkIn?: boolean
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
      ...(filters.isWalkIn !== undefined && { isWalkIn: filters.isWalkIn }),
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
        serviceRecord: true,
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
    freeWorkNote?: string
    notes?: string
    internalNotes?: string
  }) {
    const [customer, vehicle] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: data.customerId, shopId } }),
      this.prisma.vehicle.findFirst({ where: { id: data.vehicleId, shopId, customerId: data.customerId } }),
    ])
    if (!customer) throw Errors.notFound('顧客が見つかりません')
    if (!vehicle) throw Errors.notFound('車両が見つかりません')

    if (data.mechanicId) {
      const { hasConflict, conflictingReservations } = await this.checkConflict({
        shopId,
        mechanicId: data.mechanicId,
        startAt: data.startAt,
        endAt: data.endAt,
      })
      if (hasConflict) {
        throw Errors.conflict('この整備士はこの時間帯に予約があります', { conflictingReservations })
      }
    }

    const services = await this.prisma.service.findMany({
      where: { id: { in: data.serviceIds }, shopId, isActive: true },
    })
    if (services.length !== data.serviceIds.length) {
      throw Errors.notFound('指定された整備メニューが見つかりません')
    }

    // requiresApproval のサービスが1つでもあれば PENDING
    const requiresApproval = services.some((s) => s.requiresApproval)
    const initialStatus = requiresApproval ? ReservationStatus.PENDING : ReservationStatus.RESERVED

    const now = new Date()
    const reminders = this._buildReminders(data.startAt, now)

    return this.prisma.$transaction(async (tx) => {
      return tx.reservation.create({
        data: {
          shopId,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          mechanicId: data.mechanicId,
          startAt: data.startAt,
          endAt: data.endAt,
          status: initialStatus,
          freeWorkNote: data.freeWorkNote,
          notes: data.notes,
          internalNotes: data.internalNotes,
          services: {
            create: services.map((s) => ({ serviceId: s.id, price: s.basePrice })),
          },
          statusLogs: {
            create: { toStatus: initialStatus, changedByUserId: userId },
          },
          reminders: { create: reminders },
        },
        include: reservationInclude,
      })
    })
  }

  async createWalkIn(shopId: string, userId: string, data: {
    customerId: string
    vehicleId: string
    mechanicId?: string
    serviceIds: string[]
    freeWorkNote?: string
    mileageAtService?: number
    internalNotes?: string
  }) {
    const [customer, vehicle] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: data.customerId, shopId } }),
      this.prisma.vehicle.findFirst({ where: { id: data.vehicleId, shopId, customerId: data.customerId } }),
    ])
    if (!customer) throw Errors.notFound('顧客が見つかりません')
    if (!vehicle) throw Errors.notFound('車両が見つかりません')

    const services = data.serviceIds.length > 0
      ? await this.prisma.service.findMany({ where: { id: { in: data.serviceIds }, shopId, isActive: true } })
      : []

    const totalMin = services.reduce((sum, s) => sum + s.durationMin, 0) || 60
    const startAt = new Date()
    const endAt = new Date(startAt.getTime() + totalMin * 60 * 1000)

    return this.prisma.$transaction(async (tx) => {
      if (data.mileageAtService) {
        await tx.vehicle.update({
          where: { id: data.vehicleId },
          data: { lastMileage: data.mileageAtService },
        })
      }
      return tx.reservation.create({
        data: {
          shopId,
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          mechanicId: data.mechanicId,
          startAt,
          endAt,
          status: ReservationStatus.CHECKED_IN,
          isWalkIn: true,
          freeWorkNote: data.freeWorkNote,
          internalNotes: data.internalNotes,
          mileageAtService: data.mileageAtService,
          services: {
            create: services.map((s) => ({ serviceId: s.id, price: s.basePrice })),
          },
          statusLogs: {
            create: { toStatus: ReservationStatus.CHECKED_IN, changedByUserId: userId },
          },
        },
        include: reservationInclude,
      })
    })
  }

  async approve(shopId: string, userId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({ where: { id, shopId } })
    if (!reservation) throw Errors.notFound('予約が見つかりません')
    if (reservation.status !== ReservationStatus.PENDING) {
      throw Errors.unprocessable('仮予約（PENDING）状態の予約のみ承認できます')
    }

    const now = new Date()
    const reminders = this._buildReminders(reservation.startAt, now)

    return this.prisma.$transaction(async (tx) => {
      await tx.reminder.deleteMany({ where: { reservationId: id } })
      await tx.reminder.createMany({ data: reminders.map((r) => ({ ...r, reservationId: id })) })

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: ReservationStatus.RESERVED },
        include: reservationInclude,
      })

      await tx.reservationStatusLog.create({
        data: {
          reservationId: id,
          fromStatus: ReservationStatus.PENDING,
          toStatus: ReservationStatus.RESERVED,
          changedByUserId: userId,
        },
      })

      return updated
    })
  }

  async update(shopId: string, id: string, data: {
    mechanicId?: string | null
    startAt?: Date
    endAt?: Date
    freeWorkNote?: string
    notes?: string
    internalNotes?: string
    serviceIds?: string[]
  }) {
    const existing = await this.prisma.reservation.findFirst({ where: { id, shopId } })
    if (!existing) throw Errors.notFound('予約が見つかりません')

    if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(existing.status)) {
      throw Errors.unprocessable('完了・引渡し済・キャンセルの予約は変更できません')
    }

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
          freeWorkNote: data.freeWorkNote,
          notes: data.notes,
          internalNotes: data.internalNotes,
        },
        include: reservationInclude,
      })
    })
  }

  async updateStatus(shopId: string, userId: string, id: string, role: string, data: {
    status: ReservationStatus
    mileageAtService?: number
    notes?: string
  }) {
    const reservation = await this.prisma.reservation.findFirst({ where: { id, shopId } })
    if (!reservation) throw Errors.notFound('予約が見つかりません')

    // MECHANIC は自分の担当予約かつ限定遷移のみ
    if (role === 'MECHANIC') {
      if (reservation.mechanicId !== null) {
        const mechanic = await this.prisma.mechanic.findFirst({ where: { userId, shopId } })
        if (!mechanic || mechanic.id !== reservation.mechanicId) {
          throw Errors.forbidden('自分が担当する予約のみ操作できます')
        }
      }
      const allowed = MECHANIC_ALLOWED_TRANSITIONS[reservation.status] ?? []
      if (!allowed.includes(data.status)) {
        throw Errors.unprocessable(`${reservation.status} → ${data.status} への遷移は許可されていません`)
      }
    } else {
      const allowed = STATUS_TRANSITIONS[reservation.status] ?? []
      if (!allowed.includes(data.status)) {
        throw Errors.unprocessable(`${reservation.status} → ${data.status} への遷移は許可されていません`)
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.status === ReservationStatus.CHECKED_IN && data.mileageAtService) {
        await tx.vehicle.update({
          where: { id: reservation.vehicleId },
          data: { lastMileage: data.mileageAtService },
        })
      }

      // COMPLETED 時: 作業完了通知リマインダーを作成
      if (data.status === ReservationStatus.COMPLETED) {
        await tx.reminder.create({
          data: {
            reservationId: id,
            type: ReminderType.WORK_COMPLETED,
            scheduledAt: new Date(), // 即時送信
          },
        })

        // キャンセル済みの未送信リマインダーを無効化
        await tx.reminder.updateMany({
          where: {
            reservationId: id,
            status: 'PENDING',
            type: { not: ReminderType.WORK_COMPLETED },
          },
          data: { status: 'CANCELLED' },
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

  private _buildReminders(startAt: Date, now: Date) {
    const reminders: { type: ReminderType; scheduledAt: Date }[] = [
      {
        type: ReminderType.BOOKING_CONFIRM,
        scheduledAt: now,
      },
    ]

    const dayBefore = new Date(startAt.getTime() - 24 * 60 * 60 * 1000)
    if (dayBefore > now) {
      reminders.push({ type: ReminderType.REMINDER_DAY_BEFORE, scheduledAt: dayBefore })
    }

    const morningOfDay = new Date(startAt)
    morningOfDay.setHours(8, 0, 0, 0)
    if (morningOfDay > now && morningOfDay < startAt) {
      reminders.push({ type: ReminderType.REMINDER_MORNING, scheduledAt: morningOfDay })
    }

    const oneHourBefore = new Date(startAt.getTime() - 60 * 60 * 1000)
    if (oneHourBefore > now) {
      reminders.push({ type: ReminderType.REMINDER_1H_BEFORE, scheduledAt: oneHourBefore })
    }

    return reminders
  }
}
