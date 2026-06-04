import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'

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
  createBrandUser,
  deleteBrandUser,
  getBrand,
  updateBrand,
  updateBrandUser,
  type BrandUserInput,
} from '@/lib/services'
import type { User } from '@/types'

import { AdminHeader, adminError } from './AdminHeader'

export function BrandDetailPage() {
  const { brandId = '' } = useParams()
  const qc = useQueryClient()
  const key = ['admin', 'brand', brandId]
  const brand = useQuery({ queryKey: key, queryFn: () => getBrand(brandId) })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key })
    qc.invalidateQueries({ queryKey: ['admin', 'brands'] })
  }

  if (brand.isLoading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <AdminHeader />
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    )
  }

  if (!brand.data) {
    return (
      <div className="min-h-screen bg-muted/20">
        <AdminHeader />
        <div className="mx-auto max-w-3xl px-6 py-20 text-center text-muted-foreground">
          Brand not found.{' '}
          <Link to="/admin" className="underline">
            Back to brands
          </Link>
        </div>
      </div>
    )
  }

  const b = brand.data

  return (
    <div className="min-h-screen bg-muted/20">
      <AdminHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All brands
        </Link>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{b.name}</h1>
          <Badge
            variant={b.status === 'active' ? 'default' : 'secondary'}
            className="capitalize"
          >
            {b.status}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Templates" value={b.template_count} />
          <Stat label="Videos" value={b.video_count} />
          <Stat label="Users" value={b.user_count} />
        </div>

        <BrandInfoCard brand={b} onSaved={invalidate} />
        <UsersCard brandId={brandId} users={b.users} onChanged={invalidate} />
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}

function BrandInfoCard({
  brand,
  onSaved,
}: {
  brand: { id: string; name: string; slug: string; primary_color: string; status: string }
  onSaved: () => void
}) {
  const [name, setName] = useState(brand.name)
  const [slug, setSlug] = useState(brand.slug)
  const [primaryColor, setPrimaryColor] = useState(brand.primary_color)
  const [status, setStatus] = useState(brand.status)

  useEffect(() => {
    setName(brand.name)
    setSlug(brand.slug)
    setPrimaryColor(brand.primary_color)
    setStatus(brand.status)
  }, [brand.name, brand.slug, brand.primary_color, brand.status])

  const save = useMutation({
    mutationFn: () =>
      updateBrand(brand.id, {
        name,
        slug,
        primary_color: primaryColor,
        status: status as 'active' | 'inactive',
      }),
    onSuccess: () => {
      toast.success('Brand updated')
      onSaved()
    },
    onError: (e) => toast.error(adminError(e, 'Could not update brand')),
  })

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Brand details
      </h2>
      <form
        className="grid grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Primary color</Label>
          <Input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-9 w-20 p-1"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <NativeSelect
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </NativeSelect>
        </div>
        <div className="col-span-2 flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  )
}

function UsersCard({
  brandId,
  users,
  onChanged,
}: {
  brandId: string
  users: User[]
  onChanged: () => void
}) {
  const toggle = useMutation({
    mutationFn: (u: User) =>
      updateBrandUser(u.id, {
        status: u.status === 'inactive' ? 'active' : 'inactive',
      }),
    onSuccess: onChanged,
    onError: (e) => toast.error(adminError(e, 'Could not update user')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteBrandUser(id),
    onSuccess: () => {
      toast.success('User deleted')
      onChanged()
    },
    onError: (e) => toast.error(adminError(e, 'Could not delete user')),
  })

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Credentials
        </h2>
        <UserDialog brandId={brandId} onSaved={onChanged} />
      </div>

      <div className="divide-y divide-border">
        {users.map((u) => {
          const status = u.status ?? 'active'
          return (
            <div key={u.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {u.name}{' '}
                  <Badge variant="secondary" className="ml-1 uppercase">
                    {u.role}
                  </Badge>
                  {status === 'inactive' && (
                    <Badge variant="outline" className="ml-1">
                      inactive
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <UserDialog brandId={brandId} user={u} onSaved={onChanged} />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate(u)}
                >
                  {status === 'inactive' ? 'Activate' : 'Deactivate'}
                </Button>
                <ConfirmDialog
                  title={`Delete ${u.name}?`}
                  description="Users who have created content cannot be deleted — deactivate instead."
                  confirmLabel="Delete"
                  onConfirm={() => remove.mutate(u.id)}
                  trigger={
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>
          )
        })}
        {!users.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No credentials yet. Add an editor or manager.
          </p>
        )}
      </div>
    </div>
  )
}

function UserDialog({
  brandId,
  user,
  onSaved,
}: {
  brandId: string
  user?: User
  onSaved: () => void
}) {
  const editing = !!user
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<BrandUserInput['role']>(
    (user?.role as BrandUserInput['role']) ?? 'editor',
  )

  const save = useMutation({
    mutationFn: () => {
      if (editing && user) {
        return updateBrandUser(user.id, {
          name,
          email,
          role,
          ...(password ? { password } : {}),
        })
      }
      return createBrandUser(brandId, { name, email, password, role })
    },
    onSuccess: () => {
      toast.success(editing ? 'Credential updated' : 'Credential created')
      onSaved()
      setOpen(false)
      if (!editing) {
        setName('')
        setEmail('')
        setPassword('')
        setRole('editor')
      } else {
        setPassword('')
      }
    },
    onError: (e) => toast.error(adminError(e, 'Could not save credential')),
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button size="sm" variant="secondary">
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add credential
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit credential' : 'New credential'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{editing ? 'New password (leave blank to keep)' : 'Password'}</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <NativeSelect
              value={role}
              onChange={(e) => setRole(e.target.value as BrandUserInput['role'])}
              className="h-9"
            >
              <option value="editor">Editor</option>
              <option value="manager">Manager</option>
            </NativeSelect>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editing ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
