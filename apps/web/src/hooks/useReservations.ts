import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Reservation, ReservationStatus } from '@/types'

export function useReservations(dateRange?: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ['reservations', dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<Reservation[]> => {
      const { data } = await apiClient.get('/reservations', {
        params: dateRange
          ? { startAt: dateRange.start.toISOString(), endAt: dateRange.end.toISOString(), limit: 200 }
          : { limit: 200 },
      })
      return data.data
    },
    enabled: true,
  })
}

export function useReservation(id: string | undefined) {
  return useQuery({
    queryKey: ['reservation', id],
    queryFn: async (): Promise<Reservation> => {
      const { data } = await apiClient.get(`/reservations/${id}`)
      return data.data
    },
    enabled: !!id,
  })
}

export function useCreateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      customerId: string
      vehicleId: string
      mechanicId?: string
      startAt: Date
      endAt: Date
      serviceIds: string[]
      notes?: string
      internalNotes?: string
    }) => {
      const { data } = await apiClient.post('/reservations', body)
      return data.data as Reservation
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

export function useUpdateReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: {
      id: string
      customerId?: string
      vehicleId?: string
      mechanicId?: string | null
      startAt?: Date
      endAt?: Date
      serviceIds?: string[]
      notes?: string
      internalNotes?: string
    }) => {
      const { data } = await apiClient.put(`/reservations/${id}`, body)
      return data.data as Reservation
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      qc.invalidateQueries({ queryKey: ['reservation', id] })
    },
  })
}

export function useUpdateReservationStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      mileageAtService,
      notes,
    }: {
      id: string
      status: ReservationStatus
      mileageAtService?: number
      notes?: string
    }) => {
      const { data } = await apiClient.patch(`/reservations/${id}/status`, {
        status,
        mileageAtService,
        notes,
      })
      return data.data as Reservation
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      qc.invalidateQueries({ queryKey: ['reservation', id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useWalkIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      customerId: string
      vehicleId: string
      mechanicId?: string
      serviceIds: string[]
      notes?: string
      internalNotes?: string
      mileageAtService?: number
    }) => {
      const { data } = await apiClient.post('/reservations/walk-in', body)
      return data.data as Reservation
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useApproveReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/reservations/${id}/approve`)
      return data.data as Reservation
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['reservations'] })
      qc.invalidateQueries({ queryKey: ['reservation', id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useConflictCheck(params: {
  mechanicId?: string
  startAt?: Date
  endAt?: Date
  excludeId?: string
} | null) {
  return useQuery({
    queryKey: ['conflict-check', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/reservations/conflict-check', {
        params: {
          mechanicId: params!.mechanicId,
          startAt: params!.startAt!.toISOString(),
          endAt: params!.endAt!.toISOString(),
          excludeId: params!.excludeId,
        },
      })
      return data.data as { hasConflict: boolean; conflictingReservations: Reservation[] }
    },
    enabled: !!params?.mechanicId && !!params.startAt && !!params.endAt,
  })
}
