import { FastifyInstance } from 'fastify'
import { DashboardService } from '../services/dashboard.service'

export default async function dashboardRoutes(app: FastifyInstance) {
  const svc = new DashboardService(app.prisma)
  const auth = { preHandler: [app.authenticate] }

  app.get('/today', auth, async (req) => {
    const data = await svc.getToday(req.user.shopId)
    return { data }
  })

  app.get('/stats', {
    preHandler: [app.authenticate, app.authorize(['ADMIN'])],
  }, async (req) => {
    const q = req.query as any
    const startAt = q.startAt ? new Date(q.startAt) : new Date(new Date().setDate(1))
    const endAt = q.endAt ? new Date(q.endAt) : new Date()
    const data = await svc.getStats(req.user.shopId, startAt, endAt)
    return { data }
  })
}
