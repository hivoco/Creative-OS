import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useState } from 'react'
import { FileImage, Layers, Search, Trash2 } from 'lucide-react'

import { AppHeader } from '@/components/AppHeader'
import { UploadTemplateDialog } from '@/components/UploadTemplateDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { deleteTemplate, listTemplates } from '@/lib/services'
import { useAuth } from '@/store/auth'

export function DashboardPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isEditor = user?.role === 'editor'
  const [search, setSearch] = useState('')

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: listTemplates,
  })

  const filtered = templates?.filter((t) =>
    t.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const del = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted')
      qc.invalidateQueries({ queryKey: ['templates'] })
    },
    onError: () => toast.error('Could not delete template'),
  })

  function openLatest(versions?: { id: string; version_number: number }[]) {
    if (!versions?.length) return
    const latest = versions.reduce(
      (a, b) => (b.version_number > a.version_number ? b : a),
      versions[0],
    )
    navigate(`/editor/${latest.id}`)
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold uppercase tracking-tight sm:text-5xl">
              Templates
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEditor
                ? 'Upload blanks, place text, translate, and export.'
                : 'Review templates and leave feedback.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Template"
                className="h-11 rounded-full bg-white pl-11 shadow-sm"
              />
            </div>
            {isEditor && <UploadTemplateDialog />}
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading templates…</p>
        ) : !templates?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <FileImage className="h-10 w-10 opacity-40" />
              <p className="font-medium">No templates yet</p>
              {isEditor && <p className="text-sm">Upload your first blank template to begin.</p>}
            </CardContent>
          </Card>
        ) : !filtered?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <Search className="h-10 w-10 opacity-40" />
              <p className="font-medium">No templates match “{search}”</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <Card
                key={t.id}
                className="group relative overflow-hidden transition hover:shadow-lg"
              >
                {isEditor && (
                  <div className="absolute right-2 top-2 z-10">
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="secondary"
                          size="icon-sm"
                          className="opacity-0 shadow-sm transition group-hover:opacity-100"
                          aria-label="Delete template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      title={`Delete “${t.name}”?`}
                      description="This permanently deletes the template and all its versions, layers, translations and ratio variants. This cannot be undone."
                      onConfirm={() => del.mutate(t.id)}
                    />
                  </div>
                )}

                <button
                  onClick={() => openLatest(t.versions)}
                  className="block w-full text-left"
                >
                  <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
                    <img
                      src={t.blank_image_url}
                      alt={t.name}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <p className="truncate font-semibold">{t.name}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground">
                        {t.category}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Layers className="h-3 w-3" />
                      {t.dimensions_json.w} × {t.dimensions_json.h} ·{' '}
                      {t.versions?.length ?? 0} version
                      {(t.versions?.length ?? 0) === 1 ? '' : 's'}
                    </p>
                  </CardContent>
                </button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
