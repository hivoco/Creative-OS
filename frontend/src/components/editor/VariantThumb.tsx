import { useEffect, useState } from 'react'

import { API_BASE_URL, getToken } from '@/lib/api'

/** Fetches the server-rendered preview of a version at a given ratio. */
export function VariantThumb({
  versionId,
  ratio,
  language,
  refreshKey,
}: {
  versionId: string
  ratio?: string
  language: string
  refreshKey?: string | number
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let revoked = false
    let obj: string | null = null
    const ratioParam = ratio ? `&ratio=${encodeURIComponent(ratio)}` : ''
    fetch(
      `${API_BASE_URL}/versions/${versionId}/render?language=${language}&fmt=png${ratioParam}`,
      { headers: { Authorization: `Bearer ${getToken()}` } },
    )
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('render failed'))))
      .then((b) => {
        if (revoked) return
        obj = URL.createObjectURL(b)
        setUrl(obj)
        setFailed(false)
      })
      .catch(() => {
        if (!revoked) setFailed(true)
      })
    return () => {
      revoked = true
      if (obj) URL.revokeObjectURL(obj)
    }
  }, [versionId, ratio, language, refreshKey])

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
        no preview
      </div>
    )
  }
  if (!url) {
    return <div className="h-full w-full animate-pulse bg-muted" />
  }
  return <img src={url} alt={ratio ?? 'original'} className="h-full w-full object-contain" />
}
