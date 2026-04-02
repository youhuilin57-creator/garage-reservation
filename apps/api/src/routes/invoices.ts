import { FastifyInstance } from 'fastify'
import { InvoiceStatus } from '@prisma/client'
import { InvoiceService } from '../services/invoice.service'

export default async function invoiceRoutes(app: FastifyInstance) {
  const svc = new InvoiceService(app.prisma)
  const auth = { preHandler: [app.authenticate] }

  app.get('/', auth, async (req) => {
    const q = req.query as any
    const result = await svc.list(req.user.shopId, {
      status: q.status as InvoiceStatus | undefined,
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 20,
    })
    return result
  })

  app.post('/', auth, async (req, reply) => {
    const { reservationId } = req.body as any
    const invoice = await svc.createFromReservation(req.user.shopId, reservationId)
    return reply.status(201).send({ data: invoice })
  })

  app.get('/:id', auth, async (req) => {
    const { id } = req.params as any
    const invoice = await svc.findById(req.user.shopId, id)
    return { data: invoice }
  })

  app.patch('/:id/issue', auth, async (req) => {
    const { id } = req.params as any
    const invoice = await svc.issue(req.user.shopId, id)
    return { data: invoice }
  })

  app.patch('/:id/paid', auth, async (req) => {
    const { id } = req.params as any
    const invoice = await svc.markPaid(req.user.shopId, id)
    return { data: invoice }
  })
}
