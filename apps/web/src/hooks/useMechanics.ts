import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Mechanic, MechanicStatus, MechanicWorkHour } from '@/types'

export function useMechanics() {
  return useQuery({
    queryKey: ['mechanics'],
    queryFn: async () => {
      const { data } = await apiClient.get('/mechanics')
      return data.data as Mechanic[]
    },
    staleTime: 30_000,
  })
}

export function useMechanic(id: string | undefined) {
  return useQuery({
    queryKey: ['mechanics', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/mechanics/${id}`)
      return data.data as Mechanic
    },
    enabled: !!id,
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

export function useUpdateMechanicStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MechanicStatus }) => {
      const { data } = await apiClient.patch(`/mechanics/${id}/status`, { status })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mechanics'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateMechanic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string
      name?: string
      color?: string
      maxConcurrentJobs?: number
      serviceIds?: string[]
    }) => {
      const { data } = await apiClient.put(`/mechanics/${id}`, body)
      return data.data as Mechanic
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['mechanics'] })
      qc.invalidateQueries({ queryKey: ['mechanics', id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCreateMechanic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; email: string; password: string }) => {
      const { data } = await apiClient.post('/users', { ...body, role: 'MECHANIC' })
      return data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mechanics'] })
    },
  })
}

export function useDeleteMechanic() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/mechanics/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mechanics'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateMechanicWorkHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, workHours }: { id: string; workHours: Omit<MechanicWorkHour, 'id'>[] }) => {
      const { data } = await apiClient.put(`/mechanics/${id}/work-hours`, workHours)
      return data.data
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['mechanics', id] })
      qc.invalidateQueries({ queryKey: ['mechanic-availability'] })
    },
  })
}
