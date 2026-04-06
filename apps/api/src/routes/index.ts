import { FastifyInstance } from 'fastify'
import authRoutes from './auth'
import reservationRoutes from './reservations'
import partRoutes from './parts'
import serviceRecordRoutes from './service-records'
import nextServiceReminderRoutes from './next-service-reminders'
import customerRoutes from './customers'
import vehicleRoutes from './vehicles'
import mechanicRoutes from './mechanics'
import serviceRoutes from './services'
import shopCalendarRoutes from './shop-calendar'
import dashboardRoutes from './dashboard'
import invoiceRoutes from './invoices'
import publicRoutes from './public'
import userRoutes from './users'
import reservationTokenRoutes from './reservation-tokens'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(reservationRoutes, { prefix: '/reservations' })
  // 予約に紐づくサブリソース（prefix なしで /reservations/:id/... にマッチ）
  await app.register(partRoutes)
  await app.register(serviceRecordRoutes)
  await app.register(customerRoutes, { prefix: '/customers' })
  await app.register(vehicleRoutes, { prefix: '/vehicles' })
  await app.register(mechanicRoutes, { prefix: '/mechanics' })
  await app.register(serviceRoutes, { prefix: '/services' })
  await app.register(shopCalendarRoutes, { prefix: '/shop/calendar' })
  await app.register(dashboardRoutes, { prefix: '/dashboard' })
  await app.register(invoiceRoutes, { prefix: '/invoices' })
  await app.register(nextServiceReminderRoutes, { prefix: '/next-service-reminders' })
  await app.register(userRoutes, { prefix: '/users' })
  await app.register(reservationTokenRoutes, { prefix: '/reservation-tokens' })
  await app.register(publicRoutes, { prefix: '/public' })
}
