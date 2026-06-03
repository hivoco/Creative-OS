import { Link } from 'react-router-dom'
import { ArrowRight, Image as ImageIcon, Video } from 'lucide-react'

import { AppHeader } from '@/components/AppHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/store/auth'

export function ToolPickerPage() {
  const { user, brand } = useAuth()
  const isEditor = user?.role === 'editor'

  const tools = [
    {
      to: '/templates',
      title: 'Image Templates',
      desc: 'Design multilingual branded posters, translate, adapt ratios and export.',
      icon: ImageIcon,
      show: true,
    },
    {
      to: '/video',
      title: 'Video AI',
      desc: 'Turn a photo + script + voice into a lip-synced talking-head video.',
      icon: Video,
      show: isEditor,
      beta: true,
    },
  ].filter((t) => t.show)

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Choose a tool</h1>
          <p className="text-sm text-muted-foreground">
            {brand ? `${brand.name} workspace` : 'Workspace'} · pick what you want to
            create.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {tools.map((t) => (
            <Link key={t.to} to={t.to} className="group">
              <Card className="h-full transition hover:border-foreground/30 hover:shadow-lg">
                <CardContent className="flex h-full flex-col gap-4 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <t.icon className="size-6" />
                    </div>
                    {t.beta && <Badge variant="secondary">Beta</Badge>}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{t.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-medium text-foreground">
                    Open
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
