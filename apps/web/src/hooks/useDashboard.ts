import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { DashboardToday } from '@/types'

export function useDashboardToday() {
  return useQuery({
    queryKey: ['dashboard', 'today'],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/today')
      return data.data as DashboardToday
    },
    refetchInterval: 60_000, // 1分ごとに自動更新
  })
}
