import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Customer } from '@/types'

export function useCustomers(q?: string) {
  return useQuery({
    queryKey: ['customers', q],
    queryFn: async () => {
      const { data } = await apiClient.get('/customers', { params: { q, limit: 50 } })
      return data.data as Customer[]
    },
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/customers/${id}`)
      return data.data as Customer
    },
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Omit<Customer, 'id' | 'vehicles'>) => {
      const { data } = await apiClient.post('/customers', body)
      return data.data as Customer
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<Customer> & { id: string }) => {
      const { data } = await apiClient.put(`/customers/${id}`, body)
      return data.data as Customer
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['customer', id] })
    },
  })
}
