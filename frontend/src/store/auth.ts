import { create } from 'zustand'

import { api, setToken } from '@/lib/api'
import type { Brand, LoginResponse, User } from '@/types'

interface AuthState {
  user: User | null
  brand: Brand | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  loadMe: () => Promise<void>
  logout: () => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  brand: null,
  ready: false,

  login: async (email, password) => {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    })
    setToken(data.access_token)
    set({ user: data.user, brand: data.brand, ready: true })
  },

  loadMe: async () => {
    try {
      const { data } = await api.get<LoginResponse>('/auth/me')
      setToken(data.access_token)
      set({ user: data.user, brand: data.brand, ready: true })
    } catch {
      set({ user: null, brand: null, ready: true })
    }
  },

  logout: () => {
    setToken(null)
    set({ user: null, brand: null })
  },
}))
