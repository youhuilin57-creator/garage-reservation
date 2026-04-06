'use client'
import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import type { Service } from '@/types'

const publicApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL + '/api/v1' })

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function roundToSlot(date: Date, slotMin = 30): Date {
  const ms = slotMin * 60 * 1000
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

export default function PublicBookingPage({ params }: { params: { token: string } }) {
  const { token } = params

  const [shopInfo, setShopInfo] = useState<{
    shopName: string
    shopPhone?: string
    businessHours: { start: string; end: string }
    services: Service[]
  } | null>(null)
  const [pageError, setPageError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)

  const defaultStart = roundToSlot((() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    return d
  })())

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
    endAt: '',
    notes: '',
  })

  useEffect(() => {
    publicApi.get(`/public/book/${token}`)
      .then(({ data }) => setShopInfo(data.data))
      .catch(() => setPageError('予約ページが見つかりません。URLをご確認ください。'))
  }, [token])

  // 選択サービスの合計時間から終了時刻を自動計算
  const recalcEndAt = useCallback((serviceIds: string[], startAt: string, services: Service[]) => {
    if (!startAt || serviceIds.length === 0) return
    const totalMin = services
      .filter((s) => serviceIds.includes(s.id))
      .reduce((sum, s) => sum + s.durationMin, 0)
    if (totalMin === 0) return
    const start = new Date(startAt)
    const end = new Date(start.getTime() + totalMin * 60 * 1000)
    setForm((f) => ({ ...f, endAt: toDatetimeLocal(end) }))
  }, [])

  function toggleService(id: string, checked: boolean) {
    const next = checked
      ? [...form.serviceIds, id]
      : form.serviceIds.filter((s) => s !== id)
    setForm((f) => ({ ...f, serviceIds: next }))
    if (shopInfo) recalcEndAt(next, form.startAt, shopInfo.services)
  }

  function handleStartChange(value: string) {
    setForm((f) => ({ ...f, startAt: value }))
    if (shopInfo) recalcEndAt(form.serviceIds, value, shopInfo.services)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    setLoading(true)
    try {
      await publicApi.post(`/public/book/${token}`, {
        ...form,
        year: Number(form.year),
        startAt: new Date(form.startAt),
        endAt: form.endAt ? new Date(form.endAt) : new Date(new Date(form.startAt).getTime() + 60 * 60 * 1000),
      })
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err.response?.data?.error?.message ?? '送信に失敗しました。お電話でお問い合わせください。')
    } finally {
      setLoading(false)
    }
  }

  if (pageError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-700">{pageError}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">ご予約を承りました</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            {shopInfo?.shopName}より確認のご連絡をいたします。<br />
            変更・キャンセルはお電話にてご連絡ください。
          </p>
          {shopInfo?.shopPhone && (
            <a
              href={`tel:${shopInfo.shopPhone}`}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
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
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const selectedServices = shopInfo.services.filter((s) => form.serviceIds.includes(s.id))
  const totalMin = selectedServices.reduce((sum, s) => sum + s.durationMin, 0)

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-lg mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">{shopInfo.shopName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">整備予約</p>
          <p className="text-xs text-gray-400 mt-1">
            営業時間 {shopInfo.businessHours.start} 〜 {shopInfo.businessHours.end}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* お客様情報 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">お客様情報</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  電話番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.customerPhone}
                  onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  required
                  placeholder="090-0000-0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  メールアドレス <span className="text-gray-400">（確認メール送付用）</span>
                </label>
                <input
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 車両情報 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">車両情報</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  ナンバープレート <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.plateNumber}
                  onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))}
                  required
                  placeholder="品川 500 あ 1234"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    メーカー <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.make}
                    onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))}
                    required
                    placeholder="トヨタ"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    車種 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    required
                    placeholder="プリウス"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">年式</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                  min={1990}
                  max={new Date().getFullYear() + 1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 整備内容 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">整備内容 <span className="text-red-500">*</span></h2>
            <p className="text-xs text-gray-400 mb-4">複数選択できます</p>
            <div className="space-y-2">
              {shopInfo.services.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    form.serviceIds.includes(s.id)
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.serviceIds.includes(s.id)}
                    onChange={(e) => toggleService(s.id, e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span className="flex-1 text-sm text-gray-800">{s.name}</span>
                  <span className="text-xs text-gray-400">約{s.durationMin}分</span>
                  {s.basePrice != null && (
                    <span className="text-xs font-medium text-gray-600">
                      ¥{s.basePrice.toLocaleString()}〜
                    </span>
                  )}
                </label>
              ))}
            </div>
            {totalMin > 0 && (
              <p className="mt-3 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                合計作業時間の目安: 約{totalMin}分
              </p>
            )}
          </div>

          {/* 希望日時 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">希望日時</h2>
            <p className="text-xs text-gray-400 mb-4">整備内容を選択すると終了予定時刻が自動入力されます</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  開始希望日時 <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => handleStartChange(e.target.value)}
                  required
                  step={1800}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">終了予定時刻</label>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                  step={1800}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* 備考 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">備考・ご要望</h2>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="症状、気になる点など（任意）"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || form.serviceIds.length === 0}
            className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition text-sm"
          >
            {loading ? '送信中...' : '予約を申し込む'}
          </button>

          <p className="text-xs text-gray-400 text-center pb-4">
            スタッフが確認後にご連絡いたします
          </p>
        </form>
      </div>
    </div>
  )
}
