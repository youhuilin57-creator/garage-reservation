import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Mechanic } from '@/types'

export function useMechanics() {
  return useQuery({
    queryKey: ['mechanics'],
    queryFn: async () => {
      const { data } = await apiClient.get('/mechanics')
      return data.data as Mechanic[]
    },
    staleTime: 60_000,
  })
}

export function useMechanicAvailability(mechanicId: string | undefined, date: Date | undefined) {
  return useQuery({
    queryKey: ['mechanic-availability', mechanicId, date?.toDateString()],
    queryFn: async () => {
      const { data } = await apiClient.get(`/mechanics/${mechanicId}/availability`, {
        params: { date: date!.toISOString() },
      })
      return data.data as { available: boolean; slots: { start: string; end: string; available: boolean }[] }
    },
    enabled: !!mechanicId && !!date,
  })
}
