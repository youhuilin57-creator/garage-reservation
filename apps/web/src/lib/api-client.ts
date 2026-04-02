import axios from 'axios'
import { useAuthStore } from '@/stores/auth.store'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  withCredentials: true,
})

// Bearer Token 付与
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 → トークン更新 → リトライ
let refreshPromise: Promise<void> | null = null

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      throw error
    }
    original._retry = true

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${BASE_URL}/api/v1/auth/refresh`, {}, { withCredentials: true })
        .then(({ data }) => {
          useAuthStore.getState().setAuth(
            data.data.accessToken,
            useAuthStore.getState().user!,
          )
        })
        .catch(() => {
          useAuthStore.getState().clearAuth()
          window.location.href = '/login'
        })
        .finally(() => {
          refreshPromise = null
        })
    }

    await refreshPromise
    return apiClient(original)
  },
)
