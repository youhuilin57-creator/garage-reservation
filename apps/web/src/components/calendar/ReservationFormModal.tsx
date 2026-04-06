'use client'
import { useState, useEffect } from 'react'
import { useReservation, useCreateReservation, useUpdateReservation, useUpdateReservationStatus, useApproveReservation, useConflictCheck } from '@/hooks/useReservations'
import { useCustomers } from '@/hooks/useCustomers'
import { useMechanics } from '@/hooks/useMechanics'
import { apiClient } from '@/lib/api-client'
import { formatDateTime, STATUS_LABELS, STATUS_BADGE_CLASS } from '@/lib/utils'
import type { Service, Vehicle, ReservationStatus } from '@/types'

interface Props {
  defaultStart?: Date
  defaultEnd?: Date
  reservationId?: string
  onClose: () => void
}

// 通常遷移（受付・管理者操作）
const STATUS_NEXT: Partial<Record<ReservationStatus, ReservationStatus>> = {
  RESERVED: 'CHECKED_IN',
  CHECKED_IN: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  WAITING_FOR_PARTS: 'IN_PROGRESS',
  COMPLETED: 'DELIVERED',
}

export function ReservationFormModal({ defaultStart, defaultEnd, reservationId, onClose }: Props) {
  const isEdit = !!reservationId

  const { data: existing } = useReservation(reservationId)
  const { data: customers = [] } = useCustomers()
  const { data: mechanics = [] } = useMechanics()
  const { mutate: create, isPending: creating } = useCreateReservation()
  const { mutate: update, isPending: updating } = useUpdateReservation()
  const { mutate: updateStatus } = useUpdateReservationStatus()
  const { mutate: approve } = useApproveReservation()

  const [services, setServices] = useState<Service[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  const [customerId, setCustomerId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [mechanicId, setMechanicId] = useState('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [startAt, setStartAt] = useState(defaultStart ? toDatetimeLocal(defaultStart) : '')
  const [endAt, setEndAt] = useState(defaultEnd ? toDatetimeLocal(defaultEnd) : '')
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [freeWorkNote, setFreeWorkNote] = useState('')

  // 整備メニュー取得
  useEffect(() => {
    apiClient.get('/services').then(({ data }) => setServices(data.data))
  }, [])

  // 顧客選択時に車両リスト取得
  useEffect(() => {
    if (!customerId) { setVehicles([]); return }
    apiClient.get(`/customers/${customerId}/vehicles`).then(({ data }) => setVehicles(data.data))
  }, [customerId])

  // 編集時は既存データを反映
  useEffect(() => {
    if (!existing) return
    setCustomerId(existing.customerId)
    setVehicleId(existing.vehicleId)
    setMechanicId(existing.mechanicId ?? '')
    setServiceIds(existing.services.map((s) => s.service.id))
    setStartAt(toDatetimeLocal(new Date(existing.startAt)))
    setEndAt(toDatetimeLocal(new Date(existing.endAt)))
    setNotes(existing.notes ?? '')
    setInternalNotes(existing.internalNotes ?? '')
    setFreeWorkNote(existing.freeWorkNote ?? '')
  }, [existing])

  // 重複チェック
  const { data: conflictData } = useConflictCheck(
    mechanicId && startAt && endAt
      ? { mechanicId, startAt: new Date(startAt), endAt: new Date(endAt), excludeId: reservationId }
      : null,
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      customerId,
      vehicleId,
      mechanicId: mechanicId || undefined,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      serviceIds,
      notes: notes || undefined,
      internalNotes: internalNotes || undefined,
    }

    if (isEdit && reservationId) {
      update({ id: reservationId, ...payload }, { onSuccess: onClose })
    } else {
      create(payload, { onSuccess: onClose })
    }
  }

  const isPending = creating || updating
  const nextStatus = existing ? STATUS_NEXT[existing.status] : undefined
  const isPendingApproval = existing?.status === 'PENDING'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? '予約詳細・編集' : '予約作成'}
            </h2>
            {existing?.isWalkIn && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                飛び込み
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* ステータス（編集時） */}
          {existing && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[existing.status]}`}>
                {STATUS_LABELS[existing.status]}
              </span>
              {isPendingApproval && (
                <button
                  type="button"
                  onClick={() => approve(reservationId!, { onSuccess: onClose })}
                  className="ml-auto text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  承認して予約確定
                </button>
              )}
              {!isPendingApproval && nextStatus && (
                <button
                  type="button"
                  onClick={() => updateStatus({ id: reservationId!, status: nextStatus }, { onSuccess: onClose })}
                  className="ml-auto text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  → {STATUS_LABELS[nextStatus]}
                </button>
              )}
            </div>
          )}

          {/* 顧客 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">顧客 *</label>
            <select
              value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setVehicleId('') }}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">選択してください</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `（${c.phone}）` : ''}</option>
              ))}
            </select>
          </div>

          {/* 車両 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">車両 *</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              required
              disabled={!customerId}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
            >
              <option value="">選択してください</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} - {v.make} {v.model}{v.year ? `（${v.year}年）` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 日時 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開始 *</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
                step={1800}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">終了 *</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
                step={1800}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* 整備士 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">担当整備士</label>
            <select
              value={mechanicId}
              onChange={(e) => setMechanicId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">未アサイン</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {conflictData?.hasConflict && (
              <p className="mt-1 text-xs text-red-600">この整備士はこの時間帯に予約があります</p>
            )}
          </div>

          {/* 整備メニュー */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">整備内容 *</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={(e) => {
                      setServiceIds((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                      )
                    }}
                    className="rounded"
                  />
                  <span className="flex-1">{s.name}</span>
                  {s.requiresApproval && (
                    <span className="text-xs text-orange-600 border border-orange-200 rounded px-1">要承認</span>
                  )}
                  <span className="text-gray-400">{s.durationMin}分</span>
                  {s.basePrice && (
                    <span className="text-gray-500">¥{s.basePrice.toLocaleString()}</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="顧客向けメモ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">内部メモ</label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="整備士向けメモ（顧客には非表示）"
            />
          </div>

          {/* 自由作業メモ（編集時のみ） */}
          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">作業メモ</label>
              <textarea
                value={freeWorkNote}
                onChange={(e) => setFreeWorkNote(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="整備中の自由記述メモ"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending || !customerId || !vehicleId || serviceIds.length === 0 || conflictData?.hasConflict}
              className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? '保存中...' : isEdit ? '更新' : '予約作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
