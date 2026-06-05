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
import { ConfirmPopover } from '@/components/ui/confirm-popover'
import { createVersion, deleteTemplate, listTemplates } from '@/lib/services'
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

  // Deleting the last version leaves the template with none. Clicking such a
  // template recreates a fresh version so editors can get back in.
  const recreate = useMutation({
    mutationFn: (templateId: string) => createVersion(templateId),
    onSuccess: (v) => navigate(`/editor/${v.id}`),
    onError: () => toast.error('Could not create version'),
  })

  function openTemplate(
    templateId: string,
    versions?: { id: string; version_number: number }[],
  ) {
    if (versions?.length) {
      const latest = versions.reduce(
        (a, b) => (b.version_number > a.version_number ? b : a),
        versions[0],
      )
      navigate(`/editor/${latest.id}`)
      return
    }
    // No versions left — recreate one (editors only; managers have nothing to open).
    if (!isEditor) {
      toast.info('This template has no versions yet')
      return
    }
    if (!recreate.isPending) recreate.mutate(templateId)
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
                className="group relative gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-sm transition hover:shadow-xl"
              >
                {isEditor && (
                  <div className="absolute right-3 top-3 z-20">
                    <ConfirmPopover
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
                      description="Permanently deletes this template and all its versions, layers, translations and ratio variants. This cannot be undone."
                      onConfirm={() => del.mutate(t.id)}
                    />
                  </div>
                )}

                <button
                  onClick={() => openTemplate(t.id, t.versions)}
                  className="relative block aspect-square w-full overflow-hidden bg-muted text-left"
                >
                  <img
                    src={t.blank_image_url}
                    alt={t.name}
                    className="absolute inset-0 h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                    }}
                  />

                  <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-neutral-950/95 px-5 py-4 text-white shadow-lg backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-lime-400">
                        <span className="h-2 w-2 rounded-full bg-lime-400" />
                        {t.category}
                      </span>
                      <span className="truncate text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                        {t.name}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-2xl font-extrabold leading-tight">
                      {t.name}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-white/40">
                      <Layers className="h-3 w-3" />
                      {(t.versions?.length ?? 0) === 0
                        ? isEditor
                          ? 'No versions · click to start one'
                          : 'No versions yet'
                        : `${t.versions!.length} version${t.versions!.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
