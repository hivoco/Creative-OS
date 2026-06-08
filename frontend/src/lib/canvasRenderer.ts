// Client-side compositing of blank template + text layers onto an HTML5
// <canvas>, mirroring how `TemplateCanvas` paints the DOM so exports and resizes
// look EXACTLY like the editor. The browser is the single source of truth: the
// same wrapping / fonts / styles the user sees are baked into the bitmap here,
// instead of being re-rendered server-side (which diverged — no text wrapping).

import { deltaToPlainText, deltaToRuns, type DeltaRun } from '@/lib/delta'
import type { LayerTranslation, TextLayer } from '@/types'

export interface RenderOptions {
  blankImageUrl: string
  width: number
  height: number
  layers: readonly TextLayer[]
  /** Active language variant shown on the canvas. */
  language: string
  /** Fallback language when a layer has no copy in `language` yet. */
  sourceLanguage?: string
  format?: 'png' | 'jpeg' | 'jpg'
}

/** Same resolution order as `TemplateCanvas.translationFor`. */
function translationFor(
  layer: TextLayer,
  language: string,
  sourceLanguage?: string,
): LayerTranslation | undefined {
  return (
    layer.translations.find((tr) => tr.language_code === language) ??
    (sourceLanguage
      ? layer.translations.find((tr) => tr.language_code === sourceLanguage)
      : undefined) ??
    layer.translations.find((tr) => deltaToPlainText(tr.content_delta).trim()) ??
    layer.translations[0]
  )
}

interface LayerStyle {
  color: string
  fontFamily: string
  fontWeight: number
  italic: boolean
  lineHeight: number
  letterSpacingPct: number
  fontPx: number
}

/** Effective per-language style: translation override ?? layer default. */
function styleFor(layer: TextLayer, t: LayerTranslation | undefined): LayerStyle {
  return {
    color: t?.color_override ?? layer.default_color,
    fontFamily: t?.font_family_override ?? layer.font_family,
    fontWeight: t?.font_weight_override ?? layer.font_weight,
    italic: t?.italic_override ?? layer.italic,
    lineHeight: t?.line_height_override ?? layer.line_height,
    letterSpacingPct: t?.letter_spacing_override ?? layer.letter_spacing_pct,
    // On the canvas, font size is `(fontPx / height) * 100` in cqh units, which
    // resolves to exactly `fontPx` px at full template resolution.
    fontPx: t?.font_size_override ?? layer.base_font_size,
  }
}

function fontString(run: DeltaRun, style: LayerStyle): string {
  const italic = run.italic || style.italic
  const weight = run.bold ? 700 : style.fontWeight
  return `${italic ? 'italic ' : ''}${weight} ${style.fontPx}px "${style.fontFamily}", system-ui, sans-serif`
}

/** Split runs into logical lines on hard newlines (Quill keeps `\n` in runs). */
function runsToLogicalLines(runs: DeltaRun[]): DeltaRun[][] {
  const lines: DeltaRun[][] = [[]]
  for (const run of runs) {
    const parts = run.text.split('\n')
    parts.forEach((part, i) => {
      if (part) lines[lines.length - 1].push({ ...run, text: part })
      if (i < parts.length - 1) lines.push([])
    })
  }
  // Drop ONLY Quill's single terminating newline — not user-authored trailing
  // blank lines, which `pre-wrap` keeps as visible vertical space in the DOM.
  if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop()
  return lines
}

/**
 * Greedy word-wrap one logical line of styled runs to `maxWidth` px, mirroring
 * the browser's `overflow-wrap: break-word` inside the layer's width box.
 * Returns visual lines, each a list of styled runs.
 */
function wrapLine(
  ctx: CanvasRenderingContext2D,
  line: DeltaRun[],
  fontFor: (run: DeltaRun) => string,
  maxWidth: number,
): DeltaRun[][] {
  const visual: DeltaRun[][] = []
  let cur: DeltaRun[] = []
  let curW = 0
  // Whether the current visual line was started by a soft-wrap (vs the genuine
  // start of the logical line). `pre-wrap` collapses the space at a wrap point
  // but preserves real leading indentation, so we only drop the former.
  let continuation = false

  const flush = () => {
    visual.push(cur)
    cur = []
    curW = 0
    continuation = true
  }
  const add = (run: DeltaRun, text: string, w: number) => {
    const last = cur[cur.length - 1]
    if (last && last.bold === run.bold && last.italic === run.italic && last.color === run.color) {
      last.text += text
    } else {
      cur.push({ bold: run.bold, italic: run.italic, color: run.color, text })
    }
    curW += w
  }
  const breakWord = (run: DeltaRun, word: string) => {
    ctx.font = fontFor(run)
    let chunk = ''
    let chunkW = 0
    for (const ch of word) {
      const cw = ctx.measureText(ch).width
      if (chunk && chunkW + cw > maxWidth) {
        add(run, chunk, chunkW)
        flush()
        chunk = ''
        chunkW = 0
      }
      chunk += ch
      chunkW += cw
    }
    if (chunk) add(run, chunk, chunkW)
  }

  for (const run of line) {
    ctx.font = fontFor(run)
    const tokens = run.text.match(/\S+|\s+/g) ?? []
    for (const token of tokens) {
      const isSpace = /^\s+$/.test(token)
      const w = ctx.measureText(token).width
      if (cur.length === 0) {
        // Collapse leading whitespace only on a wrapped continuation line;
        // preserve genuine leading indentation at a logical line's start.
        if (isSpace && continuation) continue
        if (w <= maxWidth) add(run, token, w)
        else breakWord(run, token)
      } else if (curW + w <= maxWidth) {
        add(run, token, w)
      } else if (isSpace) {
        flush() // overflowing space: wrap here, drop the space
      } else {
        flush()
        if (w <= maxWidth) add(run, token, w)
        else breakWord(run, token)
      }
    }
  }
  visual.push(cur)
  return visual
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  width: number,
  height: number,
  language: string,
  sourceLanguage?: string,
): void {
  const t = translationFor(layer, language, sourceLanguage)
  const delta = t?.content_delta
  // Skip empty layers — the `[layer_key]` placeholder is an editor-only hint.
  if (!deltaToPlainText(delta).trim()) return

  const style = styleFor(layer, t)
  if (style.fontPx <= 0) return
  const align = layer.text_align || 'left'

  ctx.save()
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  if ('letterSpacing' in ctx) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${style.letterSpacingPct * width}px`
  }

  // Position/size follow the shown language's per-translation override, falling
  // back to the layer — exactly as the editor canvas resolves them.
  const xPct = t?.x_percent_override ?? layer.x_percent
  const yPct = t?.y_percent_override ?? layer.y_percent
  const wPct = t?.width_percent_override ?? layer.width_percent
  const boxLeft = (xPct / 100) * width
  const boxTop = (yPct / 100) * height
  const boxW = Math.max((wPct / 100) * width, 1)
  // The layer div has Tailwind `px-1` + `box-border` — 4px inner horizontal
  // padding — so text wraps and is laid out inside the padded box, not the full
  // box. The background, however, fills the whole (padded) box.
  const padX = 4
  const innerLeft = boxLeft + padX
  const innerW = Math.max(boxW - 2 * padX, 1)
  const lineGap = style.fontPx * style.lineHeight
  // CSS centres each glyph in its line box, so the first line sits half a
  // leading below the box top.
  const firstOffset = ((style.lineHeight - 1) * style.fontPx) / 2

  const fontFor = (run: DeltaRun) => fontString(run, style)
  const visual = runsToLogicalLines(deltaToRuns(delta)).flatMap((line) =>
    line.length ? wrapLine(ctx, line, fontFor, innerW) : [[] as DeltaRun[]],
  )

  if (layer.default_bg_color) {
    ctx.fillStyle = layer.default_bg_color
    ctx.fillRect(boxLeft, boxTop, boxW, lineGap * visual.length)
  }

  visual.forEach((lineRuns, i) => {
    const y = boxTop + firstOffset + i * lineGap
    let lineWidth = 0
    for (const run of lineRuns) {
      ctx.font = fontFor(run)
      lineWidth += ctx.measureText(run.text).width
    }
    let x = innerLeft
    if (align === 'center') x = innerLeft + (innerW - lineWidth) / 2
    else if (align === 'right') x = innerLeft + (innerW - lineWidth)
    for (const run of lineRuns) {
      ctx.font = fontFor(run)
      ctx.fillStyle = run.color ?? style.color
      ctx.fillText(run.text, x, y)
      x += ctx.measureText(run.text).width
    }
  })

  ctx.restore()
}

function imgFromSrc(src: string, cross: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cross) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the template image'))
    img.src = src
  })
}

function isSameOrigin(src: string): boolean {
  try {
    return new URL(src, location.href).origin === location.origin
  } catch {
    return true
  }
}

/**
 * Load the blank so the canvas stays UNTAINTED (required for `toBlob`).
 *
 * A cross-origin blank (backend `/uploads` on :8000, or S3) can't be read back
 * if loaded as a plain <img>. Setting `crossOrigin` alone is flaky: the editor
 * already cached the image from a no-CORS <img> request (no ACAO header), and
 * the browser reuses that cached response for the CORS request → it fails. So
 * we fetch the bytes (CORS is allowed for the frontend origin) and load them
 * from a same-origin object URL instead. Falls back to `crossOrigin` if fetch
 * is blocked (e.g. S3 without CORS) — which then surfaces a clear error.
 */
async function loadBlank(
  src: string,
): Promise<{ el: HTMLImageElement; cleanup?: () => void }> {
  if (src.startsWith('data:') || src.startsWith('blob:') || isSameOrigin(src)) {
    return { el: await imgFromSrc(src, false) }
  }
  try {
    const resp = await fetch(src, { mode: 'cors', credentials: 'omit' })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const objUrl = URL.createObjectURL(await resp.blob())
    return { el: await imgFromSrc(objUrl, false), cleanup: () => URL.revokeObjectURL(objUrl) }
  } catch {
    return { el: await imgFromSrc(src, true) }
  }
}

/** Best-effort: wait for the fonts each layer needs before measuring/drawing. */
async function ensureFontsLoaded(
  layers: readonly TextLayer[],
  language: string,
  sourceLanguage: string | undefined,
): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts) return
  const specs = new Set<string>()
  for (const layer of layers) {
    const style = styleFor(layer, translationFor(layer, language, sourceLanguage))
    const fam = `"${style.fontFamily}"`
    specs.add(`${style.fontWeight} ${style.fontPx}px ${fam}`)
    specs.add(`700 ${style.fontPx}px ${fam}`)
    if (style.italic) specs.add(`italic ${style.fontWeight} ${style.fontPx}px ${fam}`)
  }
  await Promise.all(
    [...specs].map((s) => fonts.load(s).catch(() => undefined)),
  )
  await fonts.ready
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Could not export the canvas (image blocked by CORS?)')),
      mime,
      mime === 'image/jpeg' ? 0.92 : undefined,
    )
  })
}

/** Render the version's current design to a Blob, exactly as the canvas shows it. */
export async function renderVersionToBlob(opts: RenderOptions): Promise<Blob> {
  const { blankImageUrl, width, height, layers, language, sourceLanguage } = opts
  const mime =
    opts.format === 'jpeg' || opts.format === 'jpg' ? 'image/jpeg' : 'image/png'

  const { el, cleanup } = await loadBlank(blankImageUrl)
  await ensureFontsLoaded(layers, language, sourceLanguage)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.drawImage(el, 0, 0, width, height)
  for (const layer of layers) {
    drawLayer(ctx, layer, width, height, language, sourceLanguage)
  }
  try {
    return await canvasToBlob(canvas, mime)
  } finally {
    cleanup?.()
  }
}

/**
 * Render from a pre-fetched blank Blob (e.g. fetched through our API so it's
 * CORS-safe). The Blob becomes a same-origin object URL, so the canvas is never
 * tainted regardless of where the blank is actually stored (S3, etc.).
 */
export async function renderVersionWithBlank(
  blankBlob: Blob,
  opts: Omit<RenderOptions, 'blankImageUrl'>,
): Promise<Blob> {
  const objUrl = URL.createObjectURL(blankBlob)
  try {
    return await renderVersionToBlob({ ...opts, blankImageUrl: objUrl })
  } finally {
    URL.revokeObjectURL(objUrl)
  }
}
