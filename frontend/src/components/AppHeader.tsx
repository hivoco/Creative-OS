import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/store/auth'

export function AppHeader() {
  const navigate = useNavigate()
  const { user, brand, logout } = useAuth()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">
            Creative OS
          </span>
          {brand && (
            <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
              / {brand.name}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden text-right text-xs leading-tight sm:block">
              <span className="block font-semibold">{user.name}</span>
              <span className="block uppercase tracking-wide text-muted-foreground">
                {user.role}
              </span>
            </span>
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
