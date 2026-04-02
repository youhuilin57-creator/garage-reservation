'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/types'

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: '管理者',
  RECEPTIONIST: '受付',
  MECHANIC: '整備士',
}

const ROLE_BADGE: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  RECEPTIONIST: 'bg-blue-100 text-blue-700',
  MECHANIC: 'bg-green-100 text-green-700',
}

interface StaffUser {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
}

function UserModal({
  user,
  onClose,
}: {
  user?: StaffUser
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!user

  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? ('RECEPTIONIST' as UserRole),
  })

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const body: any = { name: form.name, role: form.role }
        const { data } = await apiClient.put(`/users/${user.id}`, body)
        return data.data
      } else {
        const body = { name: form.name, email: form.email, password: form.password, role: form.role }
        const { data } = await apiClient.post('/users', body)
        return data.data
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'ユーザー編集' : 'ユーザー追加'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate() }}
          className="p-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">氏名 *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">パスワード *（8文字以上）</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ロール *</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            {form.role === 'MECHANIC' && !isEdit && (
              <p className="mt-1 text-xs text-gray-400">整備士ロールで作成すると整備士レコードも自動作成されます</p>
            )}
          </div>

          {save.error && (
            <p className="text-xs text-red-600">{(save.error as any).response?.data?.error?.message ?? 'エラーが発生しました'}</p>
          )}

          <div className="flex gap-3 pt-2">
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

export default function UsersSettingsPage() {
  const [modal, setModal] = useState<{ open: boolean; user?: StaffUser }>({ open: false })
  const currentUser = useAuthStore((s) => s.user)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get('/users')
      return data.data as StaffUser[]
    },
  })

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">スタッフアカウントの追加・ロール管理</p>
        </div>
        <button
          onClick={() => setModal({ open: true })}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          + ユーザー追加
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['氏名', 'メールアドレス', 'ロール', 'ステータス', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {u.name}
                    {u.id === currentUser?.id && (
                      <span className="ml-2 text-xs text-gray-400">（自分）</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                      {u.isActive ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setModal({ open: true, user: u })}
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
        <UserModal
          user={modal.user}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
