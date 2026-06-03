export type Role = 'editor' | 'manager'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  brand_id: string
}

export interface Brand {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
  brand: Brand
}

export interface Dimensions {
  w: number
  h: number
  unit?: string
  dpi?: number
}

export interface TemplateVersion {
  id: string
  template_id: string
  created_by: string
  version_number: number
  status: 'draft' | 'in_review' | 'approved' | 'rejected'
  created_at: string
}

export interface Template {
  id: string
  brand_id: string
  name: string
  category: string
  blank_image_url: string
  dimensions_json: Dimensions
  status: string
  created_at: string
  versions?: TemplateVersion[]
}

/** Quill Delta document. */
export interface Delta {
  ops: Array<{ insert?: string; attributes?: Record<string, unknown> }>
}

export interface LayerTranslation {
  id: string
  layer_id: string
  language_code: string
  content_delta: Delta
  plain_text: string
  // Per-language style overrides; null inherits the layer default.
  font_family_override: string | null
  font_weight_override: number | null
  italic_override: boolean | null
  font_size_override: number | null
  line_height_override: number | null
  letter_spacing_override: number | null
  color_override: string | null
  status: string
  last_saved_at: string
}

export interface TextLayer {
  id: string
  template_version_id: string
  layer_key: string
  x_percent: number
  y_percent: number
  width_percent: number
  height_percent: number
  font_family: string
  font_weight: number
  italic: boolean
  base_font_size: number
  line_height: number
  letter_spacing_pct: number
  text_align: 'left' | 'center' | 'right'
  default_color: string
  default_bg_color: string | null
  translations: LayerTranslation[]
}

export interface RatioVariant {
  id: string
  template_version_id: string
  ratio: string
  dimensions_json: Dimensions
  layers_json: Record<string, { x: number; y: number; w: number; h: number; font: number }>
  blank_image_url: string | null
  text_baked: boolean
  source: 'original' | 'llm_suggested' | 'manually_adjusted' | 'extended'
  status: 'draft' | 'published'
  created_at: string
}

export interface FeedbackComment {
  id: string
  review_request_id: string
  layer_id: string
  language_code: string
  comment: string
  resolved: 'open' | 'resolved'
  created_at: string
}

export interface ReviewRequest {
  id: string
  template_version_id: string
  requested_by: string
  reviewer_id: string | null
  status: 'pending' | 'reviewed' | 'approved' | 'rejected'
  note: string | null
  sent_at: string
  comments: FeedbackComment[]
}

export interface BrandVoice {
  id: string
  voice_id: string
  name: string
  description: string | null
  created_at: string
}

export type VideoStageStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface VideoJob {
  id: string
  title: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  current_stage: string
  voice_id: string
  voice_name: string | null
  script_text: string
  resolution: '480p' | '720p'
  photo_url: string
  image_status: VideoStageStatus
  audio_status: VideoStageStatus
  lipsync_status: VideoStageStatus
  image_url: string | null
  audio_url: string | null
  video_url: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'bn', label: 'Bengali' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fr', label: 'French' },
]
