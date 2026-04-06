'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import type { Service } from '@/types'

function ServiceModal({
  service,
  onClose,
}: {
  service?: Service
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!service

  const [form, setForm] = useState({
    name: service?.name ?? '',
    description: service?.description ?? '',
    durationMin: service?.durationMin ?? 60,
    basePrice: service?.basePrice ?? '',
    requiresApproval: service?.requiresApproval ?? false,
  })

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        description: form.description || undefined,
        durationMin: Number(form.durationMin),
        basePrice: form.basePrice ? Number(form.basePrice) : undefined,
        requiresApproval: form.requiresApproval,
      }
      if (isEdit) {
        const { data } = await apiClient.put(`/services/${service.id}`, body)
        return data.data
      } else {
        const { data } = await apiClient.post('/services', body)
        return data.data
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      onClose()
    },
  })

  const del = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/services/${service!.id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? '整備メニュー編集' : '整備メニュー追加'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"><X className="w-4 h-4" /></button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate() }}
          className="p-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メニュー名 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requiresApproval}
                onChange={(e) => setForm((f) => ({ ...f, requiresApproval: e.target.checked }))}
                className="rounded accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">承認が必要なメニュー</span>
            </label>
            <p className="text-xs text-gray-400 mt-0.5 ml-6">オンにするとセルフ予約が「承認待ち」ステータスになります</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">所要時間（分） *</label>
              <input
                type="number"
                value={form.durationMin}
                onChange={(e) => setForm((f) => ({ ...f, durationMin: Number(e.target.value) }))}
                required
                min={15}
                step={15}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">基本料金（円）</label>
              <input
                type="number"
                value={form.basePrice}
                onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                min={0}
                step={100}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            {isEdit && (
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="px-4 py-2 text-red-600 border border-red-200 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                削除
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {save.isPending ? '保存中...' : isEdit ? '更新' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ServicesSettingsPage() {
  const [modal, setModal] = useState<{ open: boolean; service?: Service }>({ open: false })

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data } = await apiClient.get('/services')
      return data.data as Service[]
    },
  })

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">整備メニュー管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">予約時に選択できる整備メニューを管理します</p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />メニュー追加
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : services.length === 0 ? (
          <div className="text-center py-12 text-gray-400">メニューがありません</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['メニュー名', '所要時間', '基本料金', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{s.name}</div>
                    {s.description && (
                      <div className="text-xs text-gray-400 mt-0.5">{s.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.durationMin}分</td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.basePrice ? formatCurrency(s.basePrice) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setModal({ open: true, service: s })}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      編集
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal.open && (
        <ServiceModal
          service={modal.service}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
