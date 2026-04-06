'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'

interface ReservationToken {
  id: string
  token: string
  label: string | null
  isActive: boolean
  expiresAt: string | null
  createdAt: string
}

function useTokens() {
  return useQuery({
    queryKey: ['reservation-tokens'],
    queryFn: async (): Promise<ReservationToken[]> => {
      const { data } = await apiClient.get('/reservation-tokens')
      return data.data
    },
  })
}

function useCreateToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { label?: string; expiresAt?: Date }) => {
      const { data } = await apiClient.post('/reservation-tokens', body)
      return data.data as ReservationToken
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservation-tokens'] }),
  })
}

function useUpdateToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; isActive?: boolean; label?: string }) => {
      const { data } = await apiClient.patch(`/reservation-tokens/${id}`, body)
      return data.data as ReservationToken
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservation-tokens'] }),
  })
}

function useDeleteToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reservation-tokens/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservation-tokens'] }),
  })
}

function bookingUrl(token: string) {
  return `${window.location.origin}/book/${token}`
}

export default function BookingPageSettings() {
  const { data: tokens = [], isLoading } = useTokens()
  const { mutate: createToken, isPending: creating } = useCreateToken()
  const { mutate: updateToken } = useUpdateToken()
  const { mutate: deleteToken } = useDeleteToken()

  const [newLabel, setNewLabel] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function handleCreate() {
    createToken(
      { label: newLabel || undefined },
      { onSuccess: () => setNewLabel('') },
    )
  }

  function handleCopy(token: ReservationToken) {
    navigator.clipboard.writeText(bookingUrl(token.token))
    setCopiedId(token.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleDelete(id: string) {
    if (!confirm('このURLを削除しますか？既存のリンクは無効になります。')) return
    deleteToken(id)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">セルフ予約ページ</h1>
        <p className="text-sm text-gray-500 mt-1">
          顧客向けの予約URLを発行・管理します。URLを顧客に共有するとオンライン予約が可能になります。
        </p>
      </div>

      {/* 新規発行 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">新しいURLを発行</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="ラベル（例: 公式サイト用、LINE用）"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {creating ? '発行中...' : 'URL発行'}
          </button>
        </div>
      </div>

      {/* トークン一覧 */}
      <div className="space-y-3">
        {isLoading && (
          <div className="text-center py-8 text-gray-400 text-sm">読み込み中...</div>
        )}
        {!isLoading && tokens.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            予約URLがまだ発行されていません
          </div>
        )}
        {tokens.map((t) => (
          <div
            key={t.id}
            className={`bg-white border rounded-xl p-5 transition ${
              t.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 text-sm">
                    {t.label ?? '（ラベルなし）'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      t.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {t.isActive ? '有効' : '無効'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 font-mono truncate">
                  {typeof window !== 'undefined' ? bookingUrl(t.token) : `/book/${t.token}`}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  発行: {formatDate(t.createdAt, 'yyyy/MM/dd')}
                  {t.expiresAt && ` / 有効期限: ${formatDate(t.expiresAt, 'yyyy/MM/dd')}`}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleCopy(t)}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {copiedId === t.id ? 'コピー済' : 'URLコピー'}
                </button>
                <button
                  onClick={() => updateToken({ id: t.id, isActive: !t.isActive })}
                  className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  {t.isActive ? '無効化' : '有効化'}
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 使い方 */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-800">
        <p className="font-semibold mb-2">使い方</p>
        <ul className="space-y-1 list-disc list-inside text-blue-700 text-xs">
          <li>URLを顧客に共有すると、顧客は24時間いつでも予約を申し込めます</li>
          <li>申し込みは「承認待ち」として管理画面に表示されます</li>
          <li>承認が必要なメニューの場合はスタッフが確認後に予約確定します</li>
          <li>不要になったURLは「無効化」または「削除」で停止できます</li>
        </ul>
      </div>
    </div>
  )
}
