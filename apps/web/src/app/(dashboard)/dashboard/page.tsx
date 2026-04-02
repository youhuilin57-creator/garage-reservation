'use client'
import { useDashboardToday } from '@/hooks/useDashboard'
import { formatDate, formatTime, formatCurrency, STATUS_LABELS, STATUS_BADGE_CLASS } from '@/lib/utils'
import type { ReservationStatus } from '@/types'

export default function DashboardPage() {
  const { data, isLoading } = useDashboardToday()

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>
  if (!data) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-sm text-gray-500">{formatDate(data.date)}</p>
      </div>

      {/* KPIカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="今日の予約" value={`${data.totalReservations}件`} />
        <KpiCard label="入庫中の車両" value={`${data.inShopVehicles}台`} color="amber" />
        <KpiCard label="売上見込み" value={formatCurrency(data.estimatedRevenue)} color="emerald" />
        <KpiCard
          label="整備士稼働率"
          value={`${Math.round(
            (data.mechanicUtilization.reduce((s, m) => s + m.utilizationRate, 0) /
              Math.max(1, data.mechanicUtilization.length)) * 100,
          )}%`}
          color="violet"
        />
      </div>

      {/* ステータス別内訳 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">予約ステータス内訳</h2>
        <div className="flex flex-wrap gap-3">
          {(Object.entries(data.byStatus) as [ReservationStatus, number][]).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                {STATUS_LABELS[status]}
              </span>
              <span className="text-sm font-bold text-gray-900">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 整備士稼働状況 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">整備士稼働状況</h2>
        <div className="space-y-3">
          {data.mechanicUtilization.map((m) => (
            <div key={m.mechanicId} className="flex items-center gap-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: m.color ?? '#6B7280' }}
              />
              <span className="text-sm text-gray-700 w-20">{m.name}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.round(m.utilizationRate * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right">
                {Math.round(m.utilizationRate * 100)}%
              </span>
              <span className="text-xs text-gray-400">{m.reservationCount}件</span>
            </div>
          ))}
        </div>
      </div>

      {/* 今日の予約リスト */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">今日の予約</h2>
        {data.reservations.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">予約はありません</p>
        ) : (
          <div className="space-y-2">
            {data.reservations.map((r) => (
              <div key={r.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition">
                <span className="text-sm font-mono text-gray-500 w-12">
                  {formatTime(r.startAt)}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
                <span className="text-sm font-medium text-gray-900">{r.customer.name}</span>
                <span className="text-xs text-gray-500">{r.vehicle.plateNumber}</span>
                <span className="text-xs text-gray-400 ml-auto">
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

function KpiCard({
  label,
  value,
  color = 'blue',
}: {
  label: string
  value: string
  color?: 'blue' | 'amber' | 'emerald' | 'violet'
}) {
  const bg = { blue: 'bg-blue-50', amber: 'bg-amber-50', emerald: 'bg-emerald-50', violet: 'bg-violet-50' }
  const text = { blue: 'text-blue-700', amber: 'text-amber-700', emerald: 'text-emerald-700', violet: 'text-violet-700' }
  return (
    <div className={`${bg[color]} rounded-xl p-5`}>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${text[color]}`}>{value}</p>
    </div>
  )
}
