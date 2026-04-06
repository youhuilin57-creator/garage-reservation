'use client'
import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Service } from '@/types'

const publicApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL + '/api/v1' })

// 今日から N 日後の日付を YYYY-MM-DD で返す
function addDays(base: Date, n: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// YYYY-MM-DD → Date
function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00`)
}

// YYYY-MM-DD を日本語表示
function formatDateJa(s: string): string {
  const d = parseDate(s)
  return d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
}

// 今後 N 週分のカレンダー日付を生成（今日+1日〜+28日）
function generateCalendarDates(): string[] {
  const dates: string[] = []
  const today = new Date()
  for (let i = 1; i <= 28; i++) {
    dates.push(addDays(today, i))
  }
  return dates
}

// 週ごとに分割（先頭を日曜始まりに揃えて空白パディング）
function groupByWeek(dates: string[]): string[][] {
  const firstDay = parseDate(dates[0]).getDay() // 0=日 〜 6=土
  const allDays = [...Array(firstDay).fill(''), ...dates]
  const weeks: string[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }
  return weeks
}

type Step = 'service' | 'datetime' | 'info' | 'confirm'

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
  const [step, setStep] = useState<Step>('service')

  // 選択状態
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [totalMin, setTotalMin] = useState(0)

  // フォーム
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    plateNumber: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    notes: '',
  })

  useEffect(() => {
    publicApi.get(`/public/book/${token}`)
      .then(({ data }) => setShopInfo(data.data))
      .catch(() => setPageError('予約ページが見つかりません。URLをご確認ください。'))
  }, [token])

  // 日付選択時に空き枠取得
  const fetchSlots = useCallback(async (date: string, ids: string[]) => {
    if (!date || ids.length === 0) return
    setSlotsLoading(true)
    setSelectedSlot('')
    try {
      const { data } = await publicApi.get(`/public/book/${token}/availability`, {
        params: { date, serviceIds: ids.join(',') },
      })
      setSlots(data.data.slots)
      setTotalMin(data.data.totalMin)
    } catch {
      setSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }, [token])

  function toggleService(id: string, checked: boolean) {
    const next = checked ? [...serviceIds, id] : serviceIds.filter((s) => s !== id)
    setServiceIds(next)
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date)
    setSelectedSlot('')
    fetchSlots(date, serviceIds)
  }

  async function handleSubmit(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault()
    setSubmitError('')
    setLoading(true)
    try {
      const startAt = new Date(`${selectedDate}T${selectedSlot}:00`)
      const endAt = new Date(startAt.getTime() + totalMin * 60 * 1000)
      await publicApi.post(`/public/book/${token}`, {
        ...form,
        year: Number(form.year),
        serviceIds,
        startAt,
        endAt,
      })
      setSubmitted(true)
    } catch (err: any) {
      setSubmitError(err.response?.data?.error?.message ?? '送信に失敗しました。お電話でお問い合わせください。')
    } finally {
      setLoading(false)
    }
  }

  // ─── エラー / 完了 / 読み込み ───────────────────────────
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

  const selectedServices = shopInfo.services.filter((s) => serviceIds.includes(s.id))
  const calendarDates = generateCalendarDates()
  const weeks = groupByWeek(calendarDates)
  const weekDays = ['日', '月', '火', '水', '木', '金', '土']

  // ─── ステッパー ──────────────────────────────────────────
  const steps: { key: Step; label: string }[] = [
    { key: 'service', label: 'メニュー' },
    { key: 'datetime', label: '日時' },
    { key: 'info', label: 'お客様情報' },
    { key: 'confirm', label: '確認' },
  ]
  const stepIndex = steps.findIndex((s) => s.key === step)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <p className="text-xs text-gray-500 text-center">{shopInfo.shopName}</p>
          <h1 className="text-base font-bold text-gray-900 text-center">整備予約</h1>
          {/* ステップインジケーター */}
          <div className="flex items-center justify-center gap-0 mt-3">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div className={`flex items-center gap-1 ${i <= stepIndex ? 'text-blue-600' : 'text-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold border-2 ${
                    i < stepIndex ? 'bg-blue-600 border-blue-600 text-white' :
                    i === stepIndex ? 'border-blue-600 text-blue-600' :
                    'border-gray-300 text-gray-300'
                  }`}>
                    {i < stepIndex ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (i + 1)}
                  </div>
                  <span className="text-xs hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-6 h-px mx-1 ${i < stepIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 pb-24">

        {/* ── Step 1: メニュー選択 ───────────────────────── */}
        {step === 'service' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">整備メニューを選択</h2>
              <p className="text-xs text-gray-400 mt-0.5">複数選択できます</p>
            </div>
            <div className="space-y-2">
              {shopInfo.services.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${
                    serviceIds.includes(s.id)
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={(e) => toggleService(s.id, e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">約{s.durationMin}分</p>
                    {s.basePrice != null && (
                      <p className="text-xs font-medium text-gray-700">¥{s.basePrice.toLocaleString()}〜</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {selectedServices.length > 0 && (
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700">
                選択中: {selectedServices.map((s) => s.name).join('・')}
                　合計 約{selectedServices.reduce((sum, s) => sum + s.durationMin, 0)}分
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: 日時選択 ──────────────────────────── */}
        {step === 'datetime' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">ご希望の日時を選択</h2>

            {/* カレンダー */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <table className="w-full">
                <thead>
                  <tr>
                    {weekDays.map((d, i) => (
                      <th key={d} className={`text-center text-xs font-medium py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((date, di) => {
                        if (!date) return <td key={di} />
                        const isSelected = date === selectedDate
                        const dayOfWeek = parseDate(date).getDay()
                        return (
                          <td key={di} className="p-0.5">
                            <button
                              type="button"
                              onClick={() => handleDateSelect(date)}
                              className={`w-full aspect-square rounded-lg text-sm font-medium transition ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : dayOfWeek === 0
                                    ? 'text-red-500 hover:bg-red-50'
                                    : dayOfWeek === 6
                                      ? 'text-blue-500 hover:bg-blue-50'
                                      : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {parseDate(date).getDate()}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 時間スロット */}
            {selectedDate && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  {formatDateJa(selectedDate)}の空き時間
                </p>
                {slotsLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">この日は空きがありません</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 rounded-lg text-sm font-medium border transition ${
                          selectedSlot === slot
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedDate && selectedSlot && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                {formatDateJa(selectedDate)}　{selectedSlot} 〜 {
                  (() => {
                    const [h, m] = selectedSlot.split(':').map(Number)
                    const end = new Date(0, 0, 0, h, m + totalMin)
                    return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
                  })()
                }　（約{totalMin}分）
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: お客様情報 ────────────────────────── */}
        {step === 'info' && (
          <form id="info-form" onSubmit={(e) => { e.preventDefault(); setStep('confirm') }} className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">お客様情報</h2>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">お客様</h3>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">お名前 <span className="text-red-500">*</span></label>
                <input type="text" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">電話番号 <span className="text-red-500">*</span></label>
                <input type="tel" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} required
                  placeholder="090-0000-0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">メールアドレス <span className="text-gray-400">（確認メール送付用）</span></label>
                <input type="email" value={form.customerEmail} onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">車両情報</h3>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ナンバープレート <span className="text-red-500">*</span></label>
                <input type="text" value={form.plateNumber} onChange={(e) => setForm((f) => ({ ...f, plateNumber: e.target.value }))} required
                  placeholder="品川 500 あ 1234"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">メーカー <span className="text-red-500">*</span></label>
                  <input type="text" value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} required
                    placeholder="トヨタ"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">車種 <span className="text-red-500">*</span></label>
                  <input type="text" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} required
                    placeholder="プリウス"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">年式</label>
                <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                  min={1990} max={new Date().getFullYear() + 1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">備考・ご要望</h3>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="症状、気になる点など（任意）"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
            </div>
          </form>
        )}

        {/* ── Step 4: 確認 ─────────────────────────────── */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">予約内容の確認</h2>

            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              <Row label="整備内容" value={selectedServices.map((s) => s.name).join('、')} />
              <Row label="日時" value={`${formatDateJa(selectedDate)}　${selectedSlot}〜（約${totalMin}分）`} />
              <Row label="お名前" value={form.customerName} />
              <Row label="電話番号" value={form.customerPhone} />
              {form.customerEmail && <Row label="メール" value={form.customerEmail} />}
              <Row label="車両" value={`${form.make} ${form.model}　${form.plateNumber}`} />
              {form.notes && <Row label="備考" value={form.notes} />}
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              上記の内容で予約を申し込みます。スタッフが確認後にご連絡いたします。
            </p>
          </div>
        )}
      </div>

      {/* ── 固定フッターボタン ───────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 safe-area-bottom">
        <div className="max-w-lg mx-auto flex gap-3">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={() => setStep(steps[stepIndex - 1].key)}
              className="flex items-center gap-1 px-4 py-3 border border-gray-300 text-gray-700 text-sm rounded-xl hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />戻る
            </button>
          )}

          {step === 'service' && (
            <button
              type="button"
              disabled={serviceIds.length === 0}
              onClick={() => setStep('datetime')}
              className="flex-1 flex items-center justify-center gap-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition"
            >
              日時を選ぶ<ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 'datetime' && (
            <button
              type="button"
              disabled={!selectedDate || !selectedSlot}
              onClick={() => setStep('info')}
              className="flex-1 flex items-center justify-center gap-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-40 transition"
            >
              お客様情報を入力<ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 'info' && (
            <button
              type="submit"
              form="info-form"
              className="flex-1 flex items-center justify-center gap-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition"
            >
              確認画面へ<ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 'confirm' && (
            <button
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="flex-1 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? '送信中...' : '予約を申し込む'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-5 py-3">
      <span className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  )
}
