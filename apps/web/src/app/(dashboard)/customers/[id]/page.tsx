'use client'
import { useCustomer } from '@/hooks/useCustomers'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { formatDate, formatTime, STATUS_LABELS, STATUS_BADGE_CLASS } from '@/lib/utils'
import type { Reservation, Vehicle } from '@/types'

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { data: customer, isLoading } = useCustomer(id)

  const { data: reservations = [] } = useQuery({
    queryKey: ['customer-reservations', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/customers/${id}/reservations`)
      return data.data as Reservation[]
    },
    enabled: !!id,
  })

  if (isLoading) return <div className="text-center py-12 text-gray-400">読み込み中...</div>
  if (!customer) return null

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>

      {/* 基本情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['フリガナ', customer.kana ?? '-'],
            ['電話番号', customer.phone ?? '-'],
            ['メール', customer.email ?? '-'],
            ['住所', customer.address ?? '-'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-gray-500 text-xs mb-0.5">{k}</dt>
              <dd className="text-gray-900">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 車両 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">登録車両</h2>
        {customer.vehicles?.length === 0 ? (
          <p className="text-sm text-gray-400">車両が登録されていません</p>
        ) : (
          <div className="space-y-2">
            {customer.vehicles?.map((v: Vehicle) => (
              <div key={v.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                <span className="font-medium">{v.plateNumber}</span>
                <span className="text-gray-600">{v.make} {v.model}（{v.year}年）</span>
                {v.inspectionDate && (
                  <span className="ml-auto text-xs text-gray-400">
                    車検: {formatDate(v.inspectionDate, 'yyyy年M月d日')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 整備履歴 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">整備履歴</h2>
        {reservations.length === 0 ? (
          <p className="text-sm text-gray-400">整備履歴がありません</p>
        ) : (
          <div className="space-y-2">
            {reservations.map((r) => (
              <div key={r.id} className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg text-sm">
                <span className="text-gray-500 w-28">{formatDate(r.startAt, 'yyyy/MM/dd')}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
                <span className="text-gray-600">{r.vehicle.plateNumber}</span>
                <span className="text-gray-500 text-xs ml-auto">
                  {r.services.map((s) => s.service.name).join('・')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
