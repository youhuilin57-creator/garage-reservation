export const BUSINESS_HOURS = {
  start: '08:00',
  end: '20:00',
} as const

export const ACCESS_TOKEN_TTL = '15m'
export const REFRESH_TOKEN_TTL_DAYS = 7

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING:           ['RESERVED', 'CANCELLED'],
  RESERVED:          ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN:        ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS:       ['WAITING_FOR_PARTS', 'COMPLETED'],
  WAITING_FOR_PARTS: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED:         ['DELIVERED'],
  DELIVERED:         [],
  CANCELLED:         [],
}

// ロール別に許可するステータス遷移
export const MECHANIC_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CHECKED_IN:        ['IN_PROGRESS'],
  IN_PROGRESS:       ['WAITING_FOR_PARTS', 'COMPLETED'],
  WAITING_FOR_PARTS: ['IN_PROGRESS'],
}

export const SLOT_MINUTES = 30
