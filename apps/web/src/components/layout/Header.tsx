'use client'
import { useAuthStore } from '@/stores/auth.store'
import { apiClient } from '@/lib/api-client'
import { useRouter } from 'next/navigation'

export function Header() {
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const router = useRouter()

  async function handleLogout() {
    await apiClient.post('/auth/logout').catch(() => {})
    clearAuth()
    router.replace('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-end px-6 shrink-0">
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{user?.name}</p>
          <p className="text-xs text-gray-400">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          ログアウト
        </button>
      </div>
    </header>
  )
}
