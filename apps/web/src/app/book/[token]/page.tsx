'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import type { Service } from '@/types'

const publicApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL + '/api/v1' })

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function PublicBookingPage({ params }: { params: { token: string } }) {
  const { token } = params

  const [shopInfo, setShopInfo] = useState<{
    shopName: string
    shopPhone?: string
    businessHours: { start: string; end: string }
    services: Service[]
  } | null>(null)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const defaultStart = new Date()
  defaultStart.setDate(defaultStart.getDate() + 1)
  defaultStart.setHours(10, 0, 0, 0)
  const defaultEnd = new Date(defaultStart)
  defaultEnd.setHours(12, 0, 0, 0)

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    plateNumber: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    serviceIds: [] as string[],
    startAt: toDatetimeLocal(defaultStart),
    endAt: toDatetimeLocal(defaultEnd),
    notes: '',
  })

  useEffect(() => {
    publicApi.get(`/public/book/${token}`)
      .then(({ data }) => setShopInfo(data.data))
      .catch(() => setError('予約ページが見つかりません'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await publicApi.post(`/public/book/${token}`, {
        ...form,
        year: Number(form.year),
        startAt: new Date(form.startAt),
        endAt: new Date(form.endAt),
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? '送信に失敗しました。お電話でお問い合わせください。')
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-700">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">ご予約を承りました</h1>
          <p className="text-sm text-gray-500">
            確認メールをお送りしました。<br />
            変更・キャンセルはお電話にてご連絡ください。
          </p>
          {shopInfo?.shopPhone && (
            <a href={`tel:${shopInfo.shopPhone}`} className="mt-4 inline-block text-blue-600 font-medium">
              {shopInfo.shopPhone}
            </a>
          )}
        </div>
      </div>
    )
  }

  if (!shopInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">{shopInfo.shopName}</h1>
          <p className="text-sm text-gray-500">オンライン整備予約</p>
          <p className="text-xs text-gray-400 mt-1">
            営業時間: {shopInfo.businessHours.start} 〜 {shopInfo.businessHours.end}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">お客様情報</h2>
            <div className="space-y-3">
              {[
                { name: 'customerName', label: 'お名前', required: true },
                { name: 'customerPhone', label: '電話番号', type: 'tel', required: true },
                { name: 'customerEmail', label: 'メールアドレス', type: 'email' },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={f.type ?? 'text'}
                    value={(form as any)[f.name]}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    required={f.required}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">車両情報</h2>
            <div className="space-y-3">
              {[
                { name: 'plateNumber', label: 'ナンバープレート', required: true, placeholder: '品川 500 あ 1234' },
                { name: 'make', label: 'メーカー', required: true, placeholder: 'トヨタ' },
                { name: 'model', label: '車種', required: true, placeholder: 'プリウス' },
              ].map((f) => (
                <div key={f.name}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type="text"
                    value={(form as any)[f.name]}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    required={f.required}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">年式 *</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm((s) => ({ ...s, year: Number(e.target.value) }))}
                  required
                  min={1990}
                  max={new Date().getFullYear() + 1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">整備内容（複数選択可）</h2>
            <div className="space-y-2">
              {shopInfo.services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.serviceIds.includes(s.id)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        serviceIds: e.target.checked
                          ? [...f.serviceIds, s.id]
                          : f.serviceIds.filter((id) => id !== s.id),
                      }))
                    }
                    className="rounded"
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-gray-400 text-xs">約{s.durationMin}分</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">希望日時</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">開始 *</label>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm((s) => ({ ...s, startAt: e.target.value }))}
                  required
                  step={1800}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">終了 *</label>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm((s) => ({ ...s, endAt: e.target.value }))}
                  required
                  step={1800}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </section>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">備考・ご要望</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || form.serviceIds.length === 0}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? '送信中...' : '予約を申し込む'}
          </button>

          <p className="text-xs text-gray-400 text-center">
            ※ご予約の確定はスタッフが確認後にご連絡します
          </p>
        </form>
      </div>
    </div>
  )
}
