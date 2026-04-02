'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import type { Vehicle } from '@/types'

export default function VehiclesPage() {
  const { data: expiring = [], isLoading: loadingExpiring } = useQuery({
    queryKey: ['vehicles-expiring'],
    queryFn: async () => {
      const { data } = await apiClient.get('/vehicles/expiring-inspection', { params: { days: 60 } })
      return data.data as (Vehicle & { customer: { name: string; phone: string } })[]
    },
  })

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => {
      const { data } = await apiClient.get('/vehicles')
      return data.data as (Vehicle & { customer: { name: string } })[]
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">車両管理</h1>

      {/* 車検切れ間近アラート */}
      {expiring.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-3">車検切れ間近（60日以内）</h2>
          <div className="space-y-2">
            {expiring.map((v) => (
              <div key={v.id} className="flex items-center gap-4 text-sm">
                <span className="font-medium text-gray-900">{v.plateNumber}</span>
                <span className="text-gray-600">{v.make} {v.model}</span>
                <span className="text-amber-700 font-medium">
                  {formatDate(v.inspectionDate!, 'yyyy年M月d日')}まで
                </span>
                <span className="text-gray-500">{v.customer.name}</span>
                <span className="text-gray-400">{v.customer.phone}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 車両一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['ナンバー', 'メーカー/車種', '年式', '顧客', '車検満了日', '走行距離'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.plateNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{v.make} {v.model}</td>
                  <td className="px-4 py-3 text-gray-600">{v.year}年</td>
                  <td className="px-4 py-3 text-gray-600">{v.customer.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {v.inspectionDate ? formatDate(v.inspectionDate, 'yyyy/MM/dd') : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {v.lastMileage ? `${v.lastMileage.toLocaleString()}km` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
