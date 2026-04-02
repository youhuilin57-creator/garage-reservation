export const BUSINESS_HOURS = {
  start: '08:00',
  end: '20:00',
} as const

export const ACCESS_TOKEN_TTL = '15m'
export const REFRESH_TOKEN_TTL_DAYS = 7
export const REMINDER_HOURS_BEFORE = 24 // 予約24時間前にリマインド

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  RESERVED:    ['ARRIVED', 'CANCELLED'],
  ARRIVED:     ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED:   ['DELIVERED'],
  DELIVERED:   [],
  CANCELLED:   [],
}
