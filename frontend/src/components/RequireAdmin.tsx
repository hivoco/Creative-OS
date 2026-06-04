import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/store/auth'
import { getToken } from '@/lib/api'

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { admin, ready, loadMe } = useAuth()

  useEffect(() => {
    if (!ready && getToken()) {
      void loadMe()
    }
  }, [ready, loadMe])

  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!admin) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
