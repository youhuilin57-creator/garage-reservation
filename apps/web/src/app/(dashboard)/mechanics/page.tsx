'use client'
import { useMechanics, useUpdateMechanicStatus } from '@/hooks/useMechanics'
import { useAuthStore } from '@/stores/auth.store'
import {
  MECHANIC_STATUS_LABEL,
  MECHANIC_STATUS_COLOR,
  type Mechanic,
  type MechanicStatus,
} from '@/types'

// ステータスの表示順
const STATUS_ORDER: MechanicStatus[] = ['ON_DUTY', 'ON_BREAK', 'ABSENT', 'OFF']

const SECTION_LABEL: Record<MechanicStatus, string> = {
  ON_DUTY:  '勤務中',
  ON_BREAK: '休憩中',
  ABSENT:   '欠勤',
  OFF:      '休日',
}

export default function MechanicsPage() {
  const { data: mechanics = [], isLoading } = useMechanics()
  const { user } = useAuthStore()

  const canEditAll = user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST'

  const grouped = STATUS_ORDER.reduce<Record<MechanicStatus, Mechanic[]>>(
    (acc, s) => {
      acc[s] = mechanics.filter((m) => m.currentStatus === s)
      return acc
    },
    { ON_DUTY: [], ON_BREAK: [], ABSENT: [], OFF: [] },
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-400">
        読み込み中...
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">整備士</h1>
        <div className="text-sm text-gray-500">
          勤務中 {grouped.ON_DUTY.length}名 / 全{mechanics.length}名
        </div>
      </div>

      {STATUS_ORDER.map((status) => {
        const group = grouped[status]
        if (group.length === 0) return null
        return (
          <section key={status}>
            <h2 className="mb-3 text-sm font-medium text-gray-500">
              {SECTION_LABEL[status]}（{group.length}名）
            </h2>
            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 ${
              status === 'ABSENT' || status === 'OFF' ? 'opacity-60' : ''
            }`}>
              {group.map((m) => (
                <MechanicCard
                  key={m.id}
                  mechanic={m}
                  canEdit={canEditAll || m.userId === user?.id}
                />
              ))}
            </div>
          </section>
        )
      })}

      {mechanics.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          整備士が登録されていません
        </div>
      )}
    </div>
  )
}

function MechanicCard({
  mechanic,
  canEdit,
}: {
  mechanic: Mechanic
  canEdit: boolean
}) {
  const { mutate: updateStatus, isPending } = useUpdateMechanicStatus()

  const loadPct = mechanic.maxConcurrentJobs > 0
    ? Math.min((mechanic.todayActiveCount / mechanic.maxConcurrentJobs) * 100, 100)
    : 0

  const loadColor =
    loadPct >= 100 ? 'bg-red-400' :
    loadPct >= 50  ? 'bg-yellow-400' :
                     'bg-blue-400'

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* カラーバー */}
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: mechanic.color ?? '#94a3b8' }}
      />

      <div className="p-4 space-y-3">
        {/* ヘッダー行 */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: mechanic.color ?? '#94a3b8' }}
            >
              {mechanic.name[0]}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{mechanic.name}</p>
              <p className="text-xs text-gray-400 truncate">{mechanic.user?.email}</p>
            </div>
          </div>

          {/* 稼働状況セレクタ */}
          <select
            value={mechanic.currentStatus}
            disabled={!canEdit || isPending}
            onChange={(e) =>
              updateStatus({ id: mechanic.id, status: e.target.value as MechanicStatus })
            }
            className={`rounded-full px-2.5 py-1 text-xs font-medium border-0 flex-shrink-0
              cursor-pointer disabled:cursor-default transition-opacity
              ${MECHANIC_STATUS_COLOR[mechanic.currentStatus]}
              ${isPending ? 'opacity-50' : ''}`}
          >
            {(Object.keys(MECHANIC_STATUS_LABEL) as MechanicStatus[]).map((s) => (
              <option key={s} value={s}>
                {MECHANIC_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>

        {/* 担当台数バー */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>本日の担当</span>
            <span>{mechanic.todayActiveCount} / {mechanic.maxConcurrentJobs} 台</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className={`h-1.5 rounded-full transition-all ${loadColor}`}
              style={{ width: `${loadPct}%` }}
            />
          </div>
        </div>

        {/* 対応メニュータグ */}
        {mechanic.mechanicServices.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mechanic.mechanicServices.map((ms) => (
              <span
                key={ms.serviceId}
                className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
              >
                {ms.service.name}
              </span>
            ))}
          </div>
        )}

        {/* 勤務時間（今日） */}
        <TodayWorkHour mechanic={mechanic} />
      </div>
    </div>
  )
}

function TodayWorkHour({ mechanic }: { mechanic: Mechanic }) {
  const dayOfWeek = new Date().getDay()
  const todayHour = mechanic.workHours.find((h) => h.dayOfWeek === dayOfWeek)

  if (!todayHour) return null

  return (
    <p className="text-xs text-gray-400">
      {todayHour.isWorkDay && todayHour.startTime && todayHour.endTime
        ? `勤務時間: ${todayHour.startTime} - ${todayHour.endTime}`
        : '本日休み'}
    </p>
  )
}
