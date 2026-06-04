import { create } from 'zustand'

import { api, setToken } from '@/lib/api'
import type { AccountType, Admin, Brand, LoginResponse, User } from '@/types'

interface AuthState {
  user: User | null
  brand: Brand | null
  admin: Admin | null
  accountType: AccountType | null
  ready: boolean
  login: (email: string, password: string) => Promise<AccountType>
  loadMe: () => Promise<void>
  logout: () => void
}

type SetFn = (partial: Partial<AuthState>) => void

function applySession(set: SetFn, data: LoginResponse) {
  setToken(data.access_token)
  set({
    user: data.user,
    brand: data.brand,
    admin: data.admin,
    accountType: data.account_type,
    ready: true,
  })
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  brand: null,
  admin: null,
  accountType: null,
  ready: false,

  login: async (email, password) => {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    })
    applySession(set, data)
    return data.account_type
  },

  loadMe: async () => {
    try {
      const { data } = await api.get<LoginResponse>('/auth/me')
      applySession(set, data)
    } catch {
      set({ user: null, brand: null, admin: null, accountType: null, ready: true })
    }
  },

  logout: () => {
    setToken(null)
    set({ user: null, brand: null, admin: null, accountType: null })
  },
}))
