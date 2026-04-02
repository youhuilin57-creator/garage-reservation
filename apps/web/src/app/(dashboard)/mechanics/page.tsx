'use client'
import { useMechanics } from '@/hooks/useMechanics'

export default function MechanicsPage() {
  const { data: mechanics = [], isLoading } = useMechanics()

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">整備士管理</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-12 text-gray-400">読み込み中...</div>
        ) : (
          mechanics.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: m.color ?? '#6B7280' }}
                >
                  {m.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-400">{m.isActive ? '稼働中' : '休止中'}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
