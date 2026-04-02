'use client'
import dynamic from 'next/dynamic'

// FullCalendar は SSR 非対応のため動的インポート
const ReservationCalendar = dynamic(
  () => import('@/components/calendar/ReservationCalendar').then((m) => m.ReservationCalendar),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96 text-gray-400">カレンダーを読み込み中...</div> },
)

export default function ReservationsPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">予約カレンダー</h1>
        <p className="text-sm text-gray-500">空き枠をクリックして予約を作成できます</p>
      </div>
      <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4 overflow-hidden">
        <ReservationCalendar />
      </div>
    </div>
  )
}
