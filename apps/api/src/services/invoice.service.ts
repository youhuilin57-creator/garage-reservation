import { PrismaClient, InvoiceStatus } from '@prisma/client'
import { Errors } from '../utils/errors'
import { env } from '../config/env'

export class InvoiceService {
  constructor(private prisma: PrismaClient) {}

  private async generateInvoiceNumber(shopId: string): Promise<string> {
    const year = new Date().getFullYear()
    const count = await this.prisma.invoice.count({
      where: { shopId, invoiceNumber: { startsWith: `INV-${year}-` } },
    })
    const seq = String(count + 1).padStart(4, '0')
    return `INV-${year}-${seq}`
  }

  async createFromReservation(shopId: string, reservationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, shopId },
      include: { services: { include: { service: true } }, invoice: true },
    })
    if (!reservation) throw Errors.notFound('予約が見つかりません')
    if (reservation.invoice) throw Errors.conflict('この予約の請求書はすでに作成済みです')

    const taxRate = env.INVOICE_TAX_RATE
    const items = reservation.services.map((rs) => ({
      name: rs.service.name,
      quantity: 1,
      unitPrice: rs.price ?? rs.service.basePrice ?? 0,
      amount: rs.price ?? rs.service.basePrice ?? 0,
    }))

    const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)
    const taxAmount = Math.floor(subtotal * taxRate)
    const totalAmount = subtotal + taxAmount
    const invoiceNumber = await this.generateInvoiceNumber(shopId)

    return this.prisma.invoice.create({
      data: {
        shopId,
        reservationId,
        invoiceNumber,
        status: InvoiceStatus.DRAFT,
        subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        items: { create: items },
      },
      include: { items: true, reservation: { include: { customer: true, vehicle: true } } },
    })
  }

  async findById(shopId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, shopId },
      include: {
        items: true,
        shop: true,
        reservation: { include: { customer: true, vehicle: true } },
      },
    })
    if (!invoice) throw Errors.notFound('請求書が見つかりません')
    return invoice
  }

  async issue(shopId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, shopId } })
    if (!invoice) throw Errors.notFound('請求書が見つかりません')
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw Errors.unprocessable('下書き以外の請求書は発行できません')
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.ISSUED, issueDate: new Date() },
      include: { items: true },
    })
  }

  async markPaid(shopId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, shopId } })
    if (!invoice) throw Errors.notFound('請求書が見つかりません')

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      include: { items: true },
    })
  }

  async list(shopId: string, filters: { status?: InvoiceStatus; page?: number; limit?: number }) {
    const page = Math.max(1, filters.page ?? 1)
    const limit = Math.min(100, filters.limit ?? 20)
    const skip = (page - 1) * limit

    const where = { shopId, ...(filters.status && { status: filters.status }) }
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { items: true, reservation: { include: { customer: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ])

    return { data, meta: { total, page, limit } }
  }
}
