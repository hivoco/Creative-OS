import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/store/auth'

export function AdminHeader() {
  const navigate = useNavigate()
  const { admin, logout } = useAuth()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/admin" className="flex items-center gap-3">
          <Badge className="rounded-lg px-3 py-1.5 text-sm font-bold">Creative OS</Badge>
          <span className="text-sm font-medium text-muted-foreground">
            / Super Admin
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {admin && (
            <>
              <span className="hidden text-right text-xs leading-tight sm:block">
                <span className="block font-semibold">{admin.name}</span>
                <span className="block text-muted-foreground">{admin.email}</span>
              </span>
              <Separator orientation="vertical" className="hidden h-6 sm:block" />
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}

export function adminError(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail
  return typeof detail === 'string' ? detail : fallback
}
