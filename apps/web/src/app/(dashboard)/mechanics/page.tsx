'use client'
import { useState } from 'react'
import { useMechanics, useUpdateMechanicStatus, useUpdateMechanic, useDeleteMechanic, useCreateMechanic } from '@/hooks/useMechanics'
import { useAuthStore } from '@/stores/auth.store'
import {
  MECHANIC_STATUS_LABEL,
  MECHANIC_STATUS_COLOR,
  type Mechanic,
  type MechanicStatus,
} from '@/types'

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
  const [editing, setEditing]   = useState<Mechanic | null>(null)
  const [deleting, setDeleting] = useState<Mechanic | null>(null)
  const [adding, setAdding]     = useState(false)

  const isAdmin = user?.role === 'ADMIN'
  const canEditAll = user?.role === 'ADMIN' || user?.role === 'RECEPTIONIST'

  const grouped = STATUS_ORDER.reduce<Record<MechanicStatus, Mechanic[]>>(
    (acc, s) => { acc[s] = mechanics.filter((m) => m.currentStatus === s); return acc },
    { ON_DUTY: [], ON_BREAK: [], ABSENT: [], OFF: [] },
  )

  if (isLoading) {
    return <div className="flex items-center justify-center py-24 text-sm text-gray-400">読み込み中...</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">整備士</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            勤務中 {grouped.ON_DUTY.length}名 / 全{mechanics.length}名
          </span>
          {isAdmin && (
            <button
              onClick={() => setAdding(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              + 整備士を追加
            </button>
          )}
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
                  isAdmin={isAdmin}
                  onEdit={() => setEditing(m)}
                  onDelete={() => setDeleting(m)}
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

      {adding && <AddModal onClose={() => setAdding(false)} />}
      {editing && <EditModal mechanic={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteConfirm mechanic={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}

// ──────────────────────────────────────────
// カード
// ──────────────────────────────────────────
function MechanicCard({
  mechanic, canEdit, isAdmin, onEdit, onDelete,
}: {
  mechanic: Mechanic
  canEdit: boolean
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { mutate: updateStatus, isPending } = useUpdateMechanicStatus()

  const loadPct = mechanic.maxConcurrentJobs > 0
    ? Math.min((mechanic.todayActiveCount / mechanic.maxConcurrentJobs) * 100, 100)
    : 0
  const loadColor =
    loadPct >= 100 ? 'bg-red-400' : loadPct >= 50 ? 'bg-yellow-400' : 'bg-blue-400'

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="h-1.5 w-full" style={{ backgroundColor: mechanic.color ?? '#94a3b8' }} />

      <div className="p-4 space-y-3">
        {/* ヘッダー */}
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

          <select
            value={mechanic.currentStatus}
            disabled={!canEdit || isPending}
            onChange={(e) => updateStatus({ id: mechanic.id, status: e.target.value as MechanicStatus })}
            className={`rounded-full px-2.5 py-1 text-xs font-medium border-0 flex-shrink-0
              cursor-pointer disabled:cursor-default transition-opacity
              ${MECHANIC_STATUS_COLOR[mechanic.currentStatus]} ${isPending ? 'opacity-50' : ''}`}
          >
            {(Object.keys(MECHANIC_STATUS_LABEL) as MechanicStatus[]).map((s) => (
              <option key={s} value={s}>{MECHANIC_STATUS_LABEL[s]}</option>
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
            <div className={`h-1.5 rounded-full transition-all ${loadColor}`} style={{ width: `${loadPct}%` }} />
          </div>
        </div>

        {/* サービスタグ */}
        {mechanic.mechanicServices.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {mechanic.mechanicServices.map((ms) => (
              <span key={ms.serviceId} className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                {ms.service.name}
              </span>
            ))}
          </div>
        )}

        {/* 今日の勤務時間 */}
        <TodayWorkHour mechanic={mechanic} />

        {/* 編集・削除（ADMIN のみ） */}
        {isAdmin && (
          <div className="flex gap-3 border-t border-gray-100 pt-3">
            <button
              onClick={onEdit}
              className="text-xs text-blue-600 hover:underline"
            >
              編集
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-red-500 hover:underline"
            >
              削除
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function TodayWorkHour({ mechanic }: { mechanic: Mechanic }) {
  const dow = new Date().getDay()
  const h = mechanic.workHours.find((w) => w.dayOfWeek === dow)
  if (!h) return null
  return (
    <p className="text-xs text-gray-400">
      {h.isWorkDay && h.startTime && h.endTime
        ? `勤務: ${h.startTime} - ${h.endTime}`
        : '本日休み'}
    </p>
  )
}

// ──────────────────────────────────────────
// 追加モーダル
// ──────────────────────────────────────────
function AddModal({ onClose }: { onClose: () => void }) {
  const { mutate: create, isPending } = useCreateMechanic()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim())  { setError('名前を入力してください'); return }
    if (!email.trim()) { setError('メールアドレスを入力してください'); return }
    if (password.length < 8) { setError('パスワードは8文字以上で入力してください'); return }
    setError('')
    create(
      { name: name.trim(), email: email.trim(), password },
      {
        onSuccess: onClose,
        onError: (err: any) => {
          const msg = err?.response?.data?.error?.message
          setError(msg ?? '追加に失敗しました。メールアドレスが重複している可能性があります。')
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">整備士を追加</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yamada@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">初期パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">本人に伝えてログイン後に変更するよう案内してください</p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? '追加中...' : '追加する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// 編集モーダル
// ──────────────────────────────────────────
function EditModal({ mechanic, onClose }: { mechanic: Mechanic; onClose: () => void }) {
  const { mutate: update, isPending } = useUpdateMechanic()
  const [name, setName]                     = useState(mechanic.name)
  const [color, setColor]                   = useState(mechanic.color ?? '#94a3b8')
  const [maxJobs, setMaxJobs]               = useState(mechanic.maxConcurrentJobs)
  const [error, setError]                   = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('名前を入力してください'); return }
    update(
      { id: mechanic.id, name: name.trim(), color, maxConcurrentJobs: maxJobs },
      { onSuccess: onClose, onError: () => setError('保存に失敗しました') },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">整備士を編集</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* 名前 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* カラー */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">カレンダー表示色</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-16 rounded border border-gray-300 cursor-pointer"
              />
              <span className="text-xs text-gray-400">{color}</span>
            </div>
          </div>

          {/* 同時受け持ち台数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              同時受け持ち可能台数
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMaxJobs((v) => Math.max(1, v - 1))}
                className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-semibold">{maxJobs}</span>
              <button
                type="button"
                onClick={() => setMaxJobs((v) => Math.min(10, v + 1))}
                className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
              <span className="text-xs text-gray-400">台</span>
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// 削除確認
// ──────────────────────────────────────────
function DeleteConfirm({ mechanic, onClose }: { mechanic: Mechanic; onClose: () => void }) {
  const { mutate: deleteMechanic, isPending, isError } = useDeleteMechanic()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: mechanic.color ?? '#94a3b8' }}
          >
            {mechanic.name[0]}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{mechanic.name}</p>
            <p className="text-xs text-gray-400">を削除しますか？</p>
          </div>
        </div>

        <p className="text-sm text-gray-600">
          進行中の予約がある場合は削除できません。削除後は一覧に表示されなくなります。
        </p>

        {isError && (
          <p className="text-xs text-red-500">
            削除できません。進行中の予約を確認してください。
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            disabled={isPending}
            onClick={() => deleteMechanic(mechanic.id, { onSuccess: onClose })}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? '削除中...' : '削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}
