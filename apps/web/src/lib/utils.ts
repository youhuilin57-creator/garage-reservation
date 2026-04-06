import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { ReservationStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'yyyy年M月d日(E)') {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt, { locale: ja })
}

export function formatTime(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'HH:mm', { locale: ja })
}

export function formatDateTime(date: string | Date) {
  return `${formatDate(date)} ${formatTime(date)}`
}

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: '承認待ち',
  RESERVED: '予約済',
  CHECKED_IN: '入庫',
  IN_PROGRESS: '整備中',
  WAITING_FOR_PARTS: '部品待ち',
  COMPLETED: '整備完了',
  DELIVERED: '引渡し済',
  CANCELLED: 'キャンセル',
}

export const STATUS_COLORS: Record<ReservationStatus, string> = {
  PENDING: '#F97316',
  RESERVED: '#3B82F6',
  CHECKED_IN: '#F59E0B',
  IN_PROGRESS: '#8B5CF6',
  WAITING_FOR_PARTS: '#EC4899',
  COMPLETED: '#10B981',
  DELIVERED: '#6B7280',
  CANCELLED: '#EF4444',
}

export const STATUS_BADGE_CLASS: Record<ReservationStatus, string> = {
  PENDING: 'bg-orange-100 text-orange-800',
  RESERVED: 'bg-blue-100 text-blue-800',
  CHECKED_IN: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-violet-100 text-violet-800',
  WAITING_FOR_PARTS: 'bg-pink-100 text-pink-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  DELIVERED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' })
}
