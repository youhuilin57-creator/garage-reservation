import { Resend } from 'resend'
import { env } from '../config/env'

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

export class NotificationService {
  async sendReservationReminder(params: {
    customerEmail: string
    customerName: string
    vehicleName: string
    startAt: Date
    services: string[]
    shopName: string
    shopPhone: string
  }) {
    if (!resend) {
      console.log('[Email] Resend not configured, skipping email:', params.customerEmail)
      return
    }

    const dateStr = params.startAt.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.customerEmail,
      subject: `【${params.shopName}】明日の整備予約のご確認`,
      html: `
        <p>${params.customerName} 様</p>
        <p>明日の整備予約をご確認ください。</p>
        <table border="0" cellpadding="8">
          <tr><th align="left">日時</th><td>${dateStr}</td></tr>
          <tr><th align="left">車両</th><td>${params.vehicleName}</td></tr>
          <tr><th align="left">整備内容</th><td>${params.services.join('、')}</td></tr>
        </table>
        <p>変更・キャンセルはお電話にてご連絡ください。<br>
        ${params.shopName}: ${params.shopPhone}</p>
      `,
    })
  }

  async sendReservationConfirmation(params: {
    customerEmail: string
    customerName: string
    vehicleName: string
    startAt: Date
    services: string[]
    shopName: string
    shopPhone: string
  }) {
    if (!resend) return

    const dateStr = params.startAt.toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: 'long', day: 'numeric',
      weekday: 'short', hour: '2-digit', minute: '2-digit',
    })

    await resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.customerEmail,
      subject: `【${params.shopName}】ご予約を承りました`,
      html: `
        <p>${params.customerName} 様</p>
        <p>以下の内容でご予約を承りました。</p>
        <table border="0" cellpadding="8">
          <tr><th align="left">日時</th><td>${dateStr}</td></tr>
          <tr><th align="left">車両</th><td>${params.vehicleName}</td></tr>
          <tr><th align="left">整備内容</th><td>${params.services.join('、')}</td></tr>
        </table>
        <p>${params.shopName}: ${params.shopPhone}</p>
      `,
    })
  }
}
