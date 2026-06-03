import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAuth } from '@/store/auth'

const TOOL_ROUTES = ['/templates', '/video'] as const

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, brand, logout } = useAuth()

  const activeTool = TOOL_ROUTES.includes(location.pathname as (typeof TOOL_ROUTES)[number])
    ? location.pathname
    : undefined

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-6">
        <Link to="/" className="flex items-center gap-3 justify-self-start">
          <Badge className="rounded-lg px-3 py-1.5 text-sm font-bold">Creative OS</Badge>
          {brand && (
            <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
              / {brand.name}
            </span>
          )}
        </Link>

        {activeTool ? (
          <ToggleGroup
            type="single"
            value={activeTool}
            onValueChange={(value) => {
              if (value) navigate(value)
            }}
            className="justify-self-center"
            aria-label="Switch tool"
          >
            <ToggleGroupItem value="/templates">Image Editor</ToggleGroupItem>
            <ToggleGroupItem value="/video">Video AI</ToggleGroupItem>
          </ToggleGroup>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3 justify-self-end">
          {user && (
            <>
              <span className="hidden text-right text-xs leading-tight sm:block">
                <span className="block font-semibold">{user.name}</span>
              </span>
              <Badge variant="secondary" className="hidden uppercase tracking-wide sm:inline-flex">
                {user.role}
              </Badge>
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
