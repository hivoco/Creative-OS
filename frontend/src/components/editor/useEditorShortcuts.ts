import { useEffect, useRef } from 'react'

export interface ShortcutHandlers {
  onDelete: () => void
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  onUndo: () => void
  onDeselect: () => void
}

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null
  return (
    !!el &&
    (el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable)
  )
}

/**
 * Editor keyboard shortcuts. The text editor stays focused on select, so the
 * layer actions that would collide with text editing use modifier combos and
 * run in the capture phase (intercepting Quill) so they work *while typing*:
 *
 *   ⌘/Ctrl+⌫ / ⌘/Ctrl+Delete → delete layer   ⌘/Ctrl+D → duplicate
 *   Esc → stop editing (keep selection), or deselect
 *
 * The plain keys only act when you're NOT in a text field (so native text
 * copy/paste/undo/delete keep working there):
 *   ⌘/Ctrl+C / V / Z → layer copy / paste / undo   ⌫ / Delete → delete layer
 */
export function useEditorShortcuts(enabled: boolean, handlers: ShortcutHandlers) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      const typing = isTyping()

      if (e.key === 'Escape') {
        if (typing) (document.activeElement as HTMLElement | null)?.blur()
        else ref.current.onDeselect()
        return
      }

      // Layer actions that must work even while editing text.
      if (meta && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault()
        e.stopPropagation()
        ref.current.onDelete()
        return
      }
      if (meta && !e.shiftKey && k === 'd') {
        e.preventDefault()
        e.stopPropagation()
        ref.current.onDuplicate()
        return
      }

      // Everything below yields to the focused text editor.
      if (typing) return
      if (meta && k === 'z') {
        e.preventDefault()
        ref.current.onUndo()
      } else if (meta && k === 'c') {
        e.preventDefault()
        ref.current.onCopy()
      } else if (meta && k === 'v') {
        e.preventDefault()
        ref.current.onPaste()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        ref.current.onDelete()
      }
    }
    // Capture phase so our combos beat Quill's own key handling.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled])
}
