import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { deltaToPlainText, deltaToRuns } from '@/lib/delta'
import type { TextLayer } from '@/types'

export interface LayerBox {
  x_percent?: number
  y_percent?: number
  width_percent?: number
  height_percent?: number
}

interface Props {
  blankImageUrl: string
  width: number
  height: number
  layers: TextLayer[]
  language: string
  selectedLayerId: string | null
  /** Pass null to deselect (e.g. clicking empty canvas). */
  onSelect: (id: string | null) => void
  onMove: (id: string, xPercent: number, yPercent: number) => void
  /** When provided, the selected layer shows resize handles. */
  onResize?: (id: string, box: LayerBox) => void
  /** Fired once after a move/resize gesture with the geometry BEFORE it (undo). */
  onCommit?: (id: string, before: LayerBox) => void
  /** Language to fall back to when `language` has no translation yet. */
  sourceLanguage?: string
  /** Scale the canvas to fully fit its parent (no page scroll). */
  fit?: boolean
  /**
   * View-only mode (managers): the canvas looks like the finished image —
   * unselected layers show no outline — and clicking a layer only selects it
   * (showing a border) without ever dragging it.
   */
  readOnly?: boolean
}

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

// Only width is user-controllable: height is driven by the text content (the
// box grows to wrap), matching exactly how the layer is rendered to the final
// bitmap. So we expose the left/right handles only — dragging them changes the
// wrap width; the height follows the text.
const HANDLES: { dir: Dir; pos: string; cursor: string }[] = [
  { dir: 'e', pos: 'right-0 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  { dir: 'w', pos: 'left-0 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
]

const MIN_PCT = 3

export function TemplateCanvas({
  blankImageUrl,
  width,
  height,
  layers,
  language,
  selectedLayerId,
  onSelect,
  onMove,
  onResize,
  onCommit,
  sourceLanguage,
  fit,
  readOnly,
}: Props) {
  const moved = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState({ w: 0, h: 0 })

  // In fit mode, measure the available area and contain the canvas within it.
  useEffect(() => {
    if (!fit) return
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setAvail({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  const scale = fit && avail.w && avail.h ? Math.min(avail.w / width, avail.h / height) : 0
  const fitStyle = fit
    ? { width: Math.floor(width * scale), height: Math.floor(height * scale) }
    : { aspectRatio: `${width} / ${height}` }

  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    id: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)
  const resize = useRef<{
    id: string
    dir: Dir
    startX: number
    startY: number
    box: Required<LayerBox>
  } | null>(null)

  // The canvas just shows the layer's text — it isn't tied to a user-picked
  // language. Prefer the render language, then any translation that actually
  // has content, so a layer never shows an empty placeholder when text exists.
  function translationFor(layer: TextLayer) {
    return (
      layer.translations.find((tr) => tr.language_code === language) ??
      (sourceLanguage
        ? layer.translations.find((tr) => tr.language_code === sourceLanguage)
        : undefined) ??
      layer.translations.find((tr) => deltaToPlainText(tr.content_delta).trim()) ??
      layer.translations[0]
    )
  }

  function deltaFor(layer: TextLayer) {
    return translationFor(layer)?.content_delta
  }

  function styleFor(layer: TextLayer) {
    const t = translationFor(layer)
    const fontPx = t?.font_size_override ?? layer.base_font_size
    return {
      color: t?.color_override ?? layer.default_color,
      fontFamily: t?.font_family_override ?? layer.font_family,
      fontWeight: t?.font_weight_override ?? layer.font_weight,
      italic: t?.italic_override ?? layer.italic,
      lineHeight: t?.line_height_override ?? layer.line_height,
      letterSpacingPct: t?.letter_spacing_override ?? layer.letter_spacing_pct,
      fontSizeCqh: (fontPx / height) * 100,
    }
  }

  // Effective position/size for the shown language: the translation's override
  // if set, else the layer's base. Drag/resize edits these per language.
  function geomFor(layer: TextLayer) {
    const t = translationFor(layer)
    return {
      x: t?.x_percent_override ?? layer.x_percent,
      y: t?.y_percent_override ?? layer.y_percent,
      width: t?.width_percent_override ?? layer.width_percent,
      height: t?.height_percent_override ?? layer.height_percent,
    }
  }

  function startMove(e: React.PointerEvent, layer: TextLayer) {
    e.preventDefault()
    e.stopPropagation() // don't let the frame's deselect handler fire
    onSelect(layer.id)
    if (readOnly) return // view-only: select to show a border, but never drag
    moved.current = false
    const g = geomFor(layer)
    drag.current = {
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: g.x,
      origY: g.y,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function startResize(e: React.PointerEvent, layer: TextLayer, dir: Dir) {
    e.preventDefault()
    e.stopPropagation()
    onSelect(layer.id)
    moved.current = false
    const g = geomFor(layer)
    resize.current = {
      id: layer.id,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      box: {
        x_percent: g.x,
        y_percent: g.y,
        width_percent: g.width,
        height_percent: g.height,
      },
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const dxPct = ((e.clientX - (resize.current ?? drag.current)!.startX) / rect.width) * 100
    const dyPct = ((e.clientY - (resize.current ?? drag.current)!.startY) / rect.height) * 100

    if (resize.current && onResize) {
      moved.current = true
      const { dir, box } = resize.current
      let { x_percent: x, y_percent: y, width_percent: w, height_percent: h } = box
      if (dir.includes('e')) w = box.width_percent + dxPct
      if (dir.includes('s')) h = box.height_percent + dyPct
      if (dir.includes('w')) {
        w = box.width_percent - dxPct
        x = box.x_percent + dxPct
      }
      if (dir.includes('n')) {
        h = box.height_percent - dyPct
        y = box.y_percent + dyPct
      }
      // Clamp without letting the moved edge cross the opposite one.
      if (w < MIN_PCT) {
        if (dir.includes('w')) x -= MIN_PCT - w
        w = MIN_PCT
      }
      if (h < MIN_PCT) {
        if (dir.includes('n')) y -= MIN_PCT - h
        h = MIN_PCT
      }
      onResize(resize.current.id, {
        x_percent: Math.max(0, Math.min(100, x)),
        y_percent: Math.max(0, Math.min(100, y)),
        width_percent: Math.max(MIN_PCT, Math.min(100, w)),
        height_percent: Math.max(MIN_PCT, Math.min(100, h)),
      })
      return
    }

    if (drag.current) {
      moved.current = true
      const x = Math.min(100, Math.max(0, drag.current.origX + dxPct))
      const y = Math.min(100, Math.max(0, drag.current.origY + dyPct))
      onMove(drag.current.id, x, y)
    }
  }

  function onPointerUp() {
    if (moved.current && onCommit) {
      if (resize.current) {
        onCommit(resize.current.id, { ...resize.current.box })
      } else if (drag.current) {
        onCommit(drag.current.id, {
          x_percent: drag.current.origX,
          y_percent: drag.current.origY,
        })
      }
    }
    moved.current = false
    drag.current = null
    resize.current = null
  }

  const frame = (
    <div
      ref={frameRef}
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-muted shadow-sm',
        !fit && 'mx-auto w-full max-w-2xl',
      )}
      style={{ ...fitStyle, containerType: 'size' }}
      onPointerDown={() => onSelect(null)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <img
        src={blankImageUrl}
        alt="template"
        className="absolute inset-0 h-full w-full object-cover select-none"
        draggable={false}
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
      />
      {layers.map((layer) => {
        const selected = layer.id === selectedLayerId
        const s = styleFor(layer)
        const g = geomFor(layer)
        const showHandles = selected && !!onResize
        return (
          <div
            key={layer.id}
            onPointerDown={(e) => startMove(e, layer)}
            className={cn(
              'absolute box-border touch-none select-none whitespace-pre-wrap wrap-break-word px-1',
              readOnly ? 'cursor-pointer' : 'cursor-move',
              selected
                ? 'outline-2 outline-dashed outline-offset-2 outline-sky-400/80'
                : // Managers see a clean image — only the clicked layer gets a box.
                  readOnly
                  ? ''
                  : 'outline-1 outline-dotted outline-offset-1 outline-foreground/20',
            )}
            style={{
              left: `${g.x}%`,
              top: `${g.y}%`,
              width: `${g.width}%`,
              // No fixed height — the box hugs the text (it grows as the copy
              // wraps), so the editor outline matches the rendered output.
              height: undefined,
              color: s.color,
              fontSize: `${s.fontSizeCqh}cqh`,
              fontFamily: `"${s.fontFamily}", system-ui, sans-serif`,
              fontWeight: s.fontWeight,
              fontStyle: s.italic ? 'italic' : 'normal',
              lineHeight: s.lineHeight,
              letterSpacing: `${s.letterSpacingPct * 100}cqw`,
              textAlign: layer.text_align,
              backgroundColor: layer.default_bg_color ?? undefined,
              overflow: 'visible',
            }}
          >
            {deltaToPlainText(deltaFor(layer)) ? (
              deltaToRuns(deltaFor(layer)).map((run, i) => (
                <span
                  key={i}
                  style={{
                    fontWeight: run.bold ? 700 : undefined,
                    fontStyle: run.italic ? 'italic' : undefined,
                    color: run.color,
                  }}
                >
                  {run.text}
                </span>
              ))
            ) : (
              <span className="opacity-40">[{layer.layer_key}]</span>
            )}

            {showHandles &&
              HANDLES.map((hnd) => (
                <span
                  key={hnd.dir}
                  onPointerDown={(e) => startResize(e, layer, hnd.dir)}
                  className={cn(
                    'absolute z-10 size-2.5 rounded-full border border-sky-400 bg-background shadow-sm',
                    hnd.pos,
                  )}
                  style={{ cursor: hnd.cursor }}
                />
              ))}
          </div>
        )
      })}
    </div>
  )

  if (!fit) return frame
  return (
    <div ref={wrapRef} className="flex h-full w-full items-center justify-center">
      {scale > 0 && frame}
    </div>
  )
}
