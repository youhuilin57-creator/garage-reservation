import { PrismaClient, ReservationStatus } from '@prisma/client'

export class DashboardService {
  constructor(private prisma: PrismaClient) {}

  async getToday(shopId: string) {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const [reservations, mechanics] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          shopId,
          startAt: { gte: todayStart },
          endAt: { lt: todayEnd },
          status: { not: ReservationStatus.CANCELLED },
        },
        include: {
          customer: true,
          vehicle: true,
          mechanic: true,
          services: { include: { service: true } },
        },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.mechanic.findMany({
        where: { shopId, isActive: true },
        include: {
          reservations: {
            where: {
              startAt: { gte: todayStart },
              endAt: { lt: todayEnd },
              status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.DELIVERED] },
            },
          },
        },
      }),
    ])

    const byStatus = Object.values(ReservationStatus).reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<ReservationStatus, number>,
    )
    reservations.forEach((r) => byStatus[r.status]++)

    const inShopVehicles = reservations.filter((r) =>
      ([ReservationStatus.ARRIVED, ReservationStatus.IN_PROGRESS] as ReservationStatus[]).includes(r.status),
    ).length

    const estimatedRevenue = reservations
      .filter((r) => r.status !== ReservationStatus.CANCELLED)
      .reduce((sum, r) => {
        const amount = r.totalAmount
          ? Number(r.totalAmount)
          : r.services.reduce((s, rs) => s + Number(rs.price ?? rs.service.basePrice ?? 0), 0)
        return sum + amount
      }, 0)

    const workingMinutes = 12 * 60 // 08:00-20:00
    const mechanicUtilization = mechanics.map((m) => {
      const busyMinutes = m.reservations.reduce((sum, r) => {
        const duration = (r.endAt.getTime() - r.startAt.getTime()) / 60000
        return sum + duration
      }, 0)
      return {
        mechanicId: m.id,
        name: m.name,
        color: m.color,
        utilizationRate: Math.min(1, busyMinutes / workingMinutes),
        reservationCount: m.reservations.length,
      }
    })

    return {
      date: todayStart,
      totalReservations: reservations.length,
      byStatus,
      inShopVehicles,
      estimatedRevenue,
      mechanicUtilization,
      reservations,
    }
  }

  async getStats(shopId: string, startAt: Date, endAt: Date) {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        shopId,
        startAt: { gte: startAt },
        endAt: { lte: endAt },
        status: { not: ReservationStatus.CANCELLED },
      },
      include: { services: { include: { service: true } } },
    })

    const revenueByService: Record<string, number> = {}
    reservations.forEach((r) => {
      r.services.forEach((rs) => {
        const name = rs.service.name
        revenueByService[name] = (revenueByService[name] ?? 0) + Number(rs.price ?? rs.service.basePrice ?? 0)
      })
    })

    return {
      period: { startAt, endAt },
      totalReservations: reservations.length,
      totalRevenue: Object.values(revenueByService).reduce((a, b) => a + b, 0),
      revenueByService,
    }
  }
}
