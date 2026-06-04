import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  FileImage,
  Loader2,
  Plus,
  Trash2,
  Video,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  createBrand,
  deleteBrand,
  listBrands,
  updateBrand,
  type BrandUserInput,
} from '@/lib/services'
import type { BrandWithStats } from '@/types'

import { AdminHeader, adminError } from './AdminHeader'

export function BrandsAdminPage() {
  const qc = useQueryClient()
  const brands = useQuery({ queryKey: ['admin', 'brands'], queryFn: listBrands })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 8

  const toggleStatus = useMutation({
    mutationFn: (b: BrandWithStats) =>
      updateBrand(b.id, { status: b.status === 'active' ? 'inactive' : 'active' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'brands'] }),
    onError: (e) => toast.error(adminError(e, 'Could not update brand')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteBrand(id),
    onSuccess: () => {
      toast.success('Brand deleted')
      qc.invalidateQueries({ queryKey: ['admin', 'brands'] })
    },
    onError: (e) => toast.error(adminError(e, 'Could not delete brand')),
  })

  const all = brands.data ?? []
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = all.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="min-h-screen bg-muted/20">
      <AdminHeader />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Brands</h1>
            <p className="text-sm text-muted-foreground">
              {brands.data?.length ?? 0} brand(s) · manage credentials and status
            </p>
          </div>
          <NewBrandDialog />
        </div>

        {brands.isLoading ? (
          <div className="flex justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-background">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Templates</th>
                  <th className="px-4 py-3 text-center font-medium">Videos</th>
                  <th className="px-4 py-3 text-center font-medium">Users</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/brands/${b.id}`}
                        className="font-medium hover:underline"
                      >
                        {b.name}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">/{b.slug}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={b.status === 'active' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {b.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <FileImage className="h-3.5 w-3.5" /> {b.template_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Video className="h-3.5 w-3.5" /> {b.video_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {b.user_count}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleStatus.isPending}
                          onClick={() => toggleStatus.mutate(b)}
                        >
                          {b.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Link to={`/admin/brands/${b.id}`}>
                          <Button size="sm" variant="secondary">
                            Manage
                          </Button>
                        </Link>
                        <ConfirmDialog
                          title={`Delete ${b.name}?`}
                          description="Only empty brands can be deleted. This cannot be undone."
                          confirmLabel="Delete"
                          onConfirm={() => remove.mutate(b.id)}
                          trigger={
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {!all.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      No brands yet. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {all.length > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {safePage} of {totalPages} · {all.length} brands
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const emptyUser = (): BrandUserInput => ({
  name: '',
  email: '',
  password: '',
  role: 'editor',
})

function NewBrandDialog() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#C1FF72')
  const [users, setUsers] = useState<BrandUserInput[]>([emptyUser()])

  function reset() {
    setName('')
    setSlug('')
    setPrimaryColor('#C1FF72')
    setUsers([emptyUser()])
  }

  const create = useMutation({
    mutationFn: () =>
      createBrand({
        name,
        slug,
        primary_color: primaryColor,
        users: users.filter((u) => u.email && u.password),
      }),
    onSuccess: () => {
      toast.success('Brand created')
      qc.invalidateQueries({ queryKey: ['admin', 'brands'] })
      reset()
      setOpen(false)
    },
    onError: (e) => toast.error(adminError(e, 'Could not create brand')),
  })

  function setUser(i: number, patch: Partial<BrandUserInput>) {
    setUsers((prev) => prev.map((u, idx) => (idx === i ? { ...u, ...patch } : u)))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> New brand
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create brand</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Name</Label>
              <Input
                id="b-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!slug)
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, ''),
                    )
                }}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-slug">Slug</Label>
              <Input
                id="b-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-color">Primary color</Label>
            <Input
              id="b-color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-20 p-1"
            />
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Initial credentials</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setUsers((p) => [...p, emptyUser()])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {users.map((u, i) => (
              <div
                key={i}
                className="space-y-2.5 rounded-md border border-border bg-background p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Credential {i + 1}
                  </p>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label="Remove credential"
                    onClick={() => setUsers((p) => p.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input
                    value={u.name}
                    onChange={(e) => setUser(i, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={u.email}
                    onChange={(e) => setUser(i, { email: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input
                    value={u.password}
                    onChange={(e) => setUser(i, { password: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <NativeSelect
                    value={u.role}
                    onChange={(e) =>
                      setUser(i, { role: e.target.value as BrandUserInput['role'] })
                    }
                    className="h-9"
                  >
                    <option value="editor">Editor</option>
                    <option value="manager">Manager</option>
                  </NativeSelect>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Leave empty to create a brand with no users yet.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
