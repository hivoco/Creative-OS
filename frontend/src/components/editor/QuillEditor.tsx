import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

import type { Delta } from '@/types'

interface Props {
  value: Delta
  onChange: (delta: Delta, plainText: string) => void
  placeholder?: string
  fontFamily?: string
  /** Focus the editor (cursor at end) once mounted. */
  autoFocus?: boolean
  /** View-only: disable typing and hide the formatting toolbar. */
  readOnly?: boolean
}

const TOOLBAR = [
  ['bold', 'italic', 'underline'],
  [{ color: [] as string[] }],
  [{ size: ['small', false, 'large', 'huge'] }],
  ['clean'],
]

/** Thin React wrapper around Quill 2 that emits Delta JSON + plain text. */
export function QuillEditor({
  value,
  onChange,
  placeholder,
  fontFamily,
  autoFocus,
  readOnly,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (!containerRef.current || quillRef.current) return

    const quill = new Quill(containerRef.current, {
      theme: 'snow',
      placeholder,
      readOnly,
      modules: { toolbar: readOnly ? false : TOOLBAR },
    })
    quillRef.current = quill

    if (value?.ops?.length) {
      quill.setContents(value as never, 'silent')
    }

    quill.on('text-change', () => {
      const delta = quill.getContents() as unknown as Delta
      onChangeRef.current(delta, quill.getText().replace(/\n$/, ''))
    })

    if (autoFocus) {
      // Defer so the editor is laid out before we place the cursor at the end.
      requestAnimationFrame(() => quill.setSelection(quill.getLength(), 0))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When the selected layer/language changes, swap the document content.
  useEffect(() => {
    const quill = quillRef.current
    if (!quill) return
    const current = JSON.stringify(quill.getContents())
    const incoming = JSON.stringify(value ?? { ops: [] })
    if (current !== incoming) {
      quill.setContents((value ?? { ops: [] }) as never, 'silent')
    }
  }, [value])

  // Toggle editability if read-only flips after mount (e.g. version is approved).
  useEffect(() => {
    quillRef.current?.enable(!readOnly)
  }, [readOnly])

  return (
    <div className="rounded-md border border-border bg-background">
      <div
        ref={containerRef}
        className="min-h-30"
        style={fontFamily ? { fontFamily: `"${fontFamily}", system-ui, sans-serif` } : undefined}
      />
    </div>
  )
}
