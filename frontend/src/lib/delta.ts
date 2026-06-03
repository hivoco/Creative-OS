import type { Delta } from '@/types'

export function deltaToPlainText(delta: Delta | undefined | null): string {
  if (!delta?.ops) return ''
  return delta.ops
    .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
    .join('')
    .replace(/\n$/, '')
}

export function plainTextToDelta(text: string): Delta {
  return { ops: [{ insert: text.endsWith('\n') ? text : text + '\n' }] }
}

export interface DeltaRun {
  text: string
  bold: boolean
  italic: boolean
  color?: string
}

/** Flatten a Delta into styled runs (newlines kept in text for pre-wrap). */
export function deltaToRuns(delta: Delta | undefined | null): DeltaRun[] {
  if (!delta?.ops) return []
  return delta.ops
    .filter((op) => typeof op.insert === 'string')
    .map((op) => {
      const a = (op.attributes ?? {}) as Record<string, unknown>
      return {
        text: op.insert as string,
        bold: a.bold === true,
        italic: a.italic === true,
        color: typeof a.color === 'string' ? a.color : undefined,
      }
    })
}
