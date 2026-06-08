import { Link } from 'react-router-dom'
import { Image as ImageIcon, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { AppHeader } from '@/components/AppHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/store/auth'

type Tool = {
  to: string
  title: string
  desc: string
  icon: LucideIcon
  show: boolean
  beta?: boolean
}

export function ToolPickerPage() {
  const { user } = useAuth()
  const isEditor = user?.role === 'editor'

  const tools: Tool[] = [
    {
      to: '/templates',
      title: 'Image Editor',
      desc: 'Current canvas',
      icon: ImageIcon,
      show: true,
    },
    {
      to: '/video',
      title: 'Video AI',
      desc: isEditor ? 'Video workspace' : 'Review queue',
      icon: Video,
      show: true,
      beta: true,
    },
  ].filter((t) => t.show)

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
        <Card className="w-full max-w-2xl rounded-3xl border-border/70 px-6 py-8 shadow-xl sm:px-9">
          <CardContent className="px-0">
            <img
              src="/hv-logo.png"
              alt="Hivoco Studios"
              className="mb-6 h-11 w-auto"
            />

            <h1 className="text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">
              Choose your tool
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pick how you want to create today. You can switch anytime.
            </p>

            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tools.map((t) => (
                <Link key={t.to} to={t.to} className="group">
                  <Card className="relative h-full gap-0 rounded-2xl border-border/70 py-0 transition hover:border-primary hover:shadow-md">
                    <CardContent className="flex h-full flex-col p-5">
                      {t.beta && (
                        <Badge
                          variant="outline"
                          className="absolute right-4 top-4 rounded-full text-muted-foreground"
                        >
                          Beta
                        </Badge>
                      )}
                      <div className="mb-9 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <t.icon className="size-5" strokeWidth={1.75} />
                      </div>
                      <h2 className="text-base font-bold tracking-tight">
                        {t.title}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {t.desc}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
