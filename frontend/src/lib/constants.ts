export type FontOption = {
  family: string
  label: string
}

/**
 * Fonts offered in the layer controls. Every family here MUST also be loaded in
 * index.html (Google Fonts link or local @font-face) — otherwise the browser
 * silently falls back and the picker appears to do nothing.
 */
export const FONT_OPTIONS: readonly FontOption[] = [
  { family: 'Gilroy', label: 'Gilroy (Brand)' },
  { family: 'Roboto', label: 'Roboto (English)' },
  { family: 'Poppins', label: 'Poppins' },
  { family: 'Montserrat', label: 'Montserrat' },
  { family: 'Oswald', label: 'Oswald (Display)' },
  { family: 'Playfair Display', label: 'Playfair Display (Serif)' },
  { family: 'Yantramanav', label: 'Yantramanav (हिन्दी)' },
  { family: 'Noto Sans Bengali', label: 'Noto Sans Bengali (বাংলা)' },
  { family: 'Noto Sans Tamil', label: 'Noto Sans Tamil (தமிழ்)' },
  { family: 'Noto Sans Telugu', label: 'Noto Sans Telugu (తెలుగు)' },
  { family: 'Noto Sans Kannada', label: 'Noto Sans Kannada (ಕನ್ನಡ)' },
  { family: 'Noto Sans Malayalam', label: 'Noto Sans Malayalam (മലയാളം)' },
  { family: 'Noto Sans Gujarati', label: 'Noto Sans Gujarati (ગુજરાતી)' },
  { family: 'Noto Sans Gurmukhi', label: 'Noto Sans Gurmukhi (ਪੰਜਾਬੀ)' },
  { family: 'Noto Sans Oriya', label: 'Noto Sans Oriya (ଓଡ଼ିଆ)' },
  { family: 'Noto Sans Arabic', label: 'Noto Sans Arabic (العربية)' },
] as const

export const FONT_WEIGHTS: readonly { value: number; label: string }[] = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 700, label: 'Bold' },
  { value: 900, label: 'Black' },
] as const

export const FONT_SIZE_PX_OPTIONS = [
  8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 112,
  128, 144, 160, 192, 240, 280, 320, 400,
] as const

export const COLOR_PRESETS: readonly string[] = [
  '#FFFFFF',
  '#000000',
  '#C1FF72',
  '#F56E28',
  '#1E1C57',
  '#FAAA38',
  '#7574B5',
  '#CDA93D',
] as const

/**
 * Script-appropriate font per language, so translated text renders correctly
 * (e.g. Tamil text in a Latin font would show as boxes). Used when applying a
 * translation. Every value must be loaded in index.html.
 */
export const LANGUAGE_FONT: Record<string, string> = {
  en: 'Roboto',
  fr: 'Roboto',
  es: 'Roboto',
  hi: 'Yantramanav',
  mr: 'Yantramanav',
  bn: 'Noto Sans Bengali',
  ta: 'Noto Sans Tamil',
  te: 'Noto Sans Telugu',
  kn: 'Noto Sans Kannada',
  ml: 'Noto Sans Malayalam',
  gu: 'Noto Sans Gujarati',
  pa: 'Noto Sans Gurmukhi',
  or: 'Noto Sans Oriya',
  ar: 'Noto Sans Arabic',
}

import { LANGUAGES } from '@/types'

export const langLabel = (code: string) =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code

/** Turn an enum status like `in_review` into Title Case ("In Review"). */
export const statusLabel = (status?: string) =>
  (status ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const PRESET_LAYER_KEYS = [
  'headline',
  'subheading',
  'body',
  'cta_button',
  'date_line',
  'price',
  'disclaimer',
  'tagline',
] as const

export const TEMPLATE_CATEGORIES = [
  'campaign',
  'festival',
  'launch',
  'promo',
] as const
