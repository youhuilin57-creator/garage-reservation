import { FastifyInstance } from 'fastify'
import authRoutes from './auth'
import reservationRoutes from './reservations'
import customerRoutes from './customers'
import vehicleRoutes from './vehicles'
import mechanicRoutes from './mechanics'
import serviceRoutes from './services'
import dashboardRoutes from './dashboard'
import invoiceRoutes from './invoices'
import publicRoutes from './public'
import userRoutes from './users'

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(reservationRoutes, { prefix: '/reservations' })
  await app.register(customerRoutes, { prefix: '/customers' })
  await app.register(vehicleRoutes, { prefix: '/vehicles' })
  await app.register(mechanicRoutes, { prefix: '/mechanics' })
  await app.register(serviceRoutes, { prefix: '/services' })
  await app.register(dashboardRoutes, { prefix: '/dashboard' })
  await app.register(invoiceRoutes, { prefix: '/invoices' })
  await app.register(userRoutes, { prefix: '/users' })
  // 公開API（認証不要）
  await app.register(publicRoutes, { prefix: '/public' })
}
