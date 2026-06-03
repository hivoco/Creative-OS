import { api } from '@/lib/api'
import type {
  Delta,
  FeedbackComment,
  LayerTranslation,
  RatioVariant,
  ReviewRequest,
  Template,
  TemplateVersion,
  TextLayer,
  User,
} from '@/types'

export async function listTemplates(): Promise<Template[]> {
  const { data } = await api.get<Template[]>('/templates')
  return data
}

export async function getTemplate(id: string): Promise<Template> {
  const { data } = await api.get<Template>(`/templates/${id}`)
  return data
}

export async function createTemplate(input: {
  name: string
  category: string
  width: number
  height: number
  file: File
}): Promise<Template> {
  const form = new FormData()
  form.append('name', input.name)
  form.append('category', input.category)
  form.append(
    'dimensions_json',
    JSON.stringify({ w: input.width, h: input.height, unit: 'px', dpi: 72 }),
  )
  form.append('blank_image', input.file)
  const { data } = await api.post<Template>('/templates', form)
  return data
}

export async function createVersion(templateId: string): Promise<TemplateVersion> {
  const { data } = await api.post<TemplateVersion>(`/templates/${templateId}/versions`)
  return data
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await api.delete(`/templates/${templateId}`)
}

export async function deleteVersion(versionId: string): Promise<void> {
  await api.delete(`/versions/${versionId}`)
}

export interface VersionContext {
  version: TemplateVersion
  template: Template
}

export async function getVersionContext(versionId: string): Promise<VersionContext> {
  const { data } = await api.get<VersionContext>(`/versions/${versionId}`)
  return data
}

export async function listLayers(versionId: string): Promise<TextLayer[]> {
  const { data } = await api.get<TextLayer[]>(`/versions/${versionId}/layers`)
  return data
}

export async function createLayer(
  versionId: string,
  input: Partial<TextLayer> & { layer_key: string },
): Promise<TextLayer> {
  const { data } = await api.post<TextLayer>(`/versions/${versionId}/layers`, input)
  return data
}

export async function updateLayer(
  layerId: string,
  patch: Partial<TextLayer>,
): Promise<TextLayer> {
  const { data } = await api.patch<TextLayer>(`/layers/${layerId}`, patch)
  return data
}

export async function deleteLayer(layerId: string): Promise<void> {
  await api.delete(`/layers/${layerId}`)
}

export async function saveTranslation(
  layerId: string,
  languageCode: string,
  body: {
    content_delta: Delta
    plain_text: string
    font_family_override?: string | null
    font_weight_override?: number | null
    italic_override?: boolean | null
    font_size_override?: number | null
    line_height_override?: number | null
    letter_spacing_override?: number | null
    color_override?: string | null
    status?: string
  },
): Promise<LayerTranslation> {
  const { data } = await api.put<LayerTranslation>(
    `/layers/${layerId}/translations/${languageCode}`,
    body,
  )
  return data
}

/** Stateless translation — returns translated strings without saving them. */
export async function translateTexts(
  texts: string[],
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string[]> {
  const { data } = await api.post<{ translations: string[] }>('/translate', {
    texts,
    source_language: sourceLanguage,
    target_language: targetLanguage,
  })
  return data.translations
}

export async function translateVersion(
  versionId: string,
  targetLanguage: string,
  sourceLanguage = 'en',
): Promise<LayerTranslation[]> {
  const { data } = await api.post<LayerTranslation[]>(
    `/versions/${versionId}/translate`,
    { target_language: targetLanguage, source_language: sourceLanguage },
  )
  return data
}

// ---- Review workflow ----

export async function getReview(versionId: string): Promise<ReviewRequest | null> {
  const { data } = await api.get<ReviewRequest | null>(`/versions/${versionId}/review`)
  return data
}

export async function submitForReview(
  versionId: string,
  reviewerId?: string,
): Promise<ReviewRequest> {
  const { data } = await api.post<ReviewRequest>(`/versions/${versionId}/submit`, {
    reviewer_id: reviewerId ?? null,
  })
  return data
}

export async function approveVersion(versionId: string): Promise<ReviewRequest> {
  const { data } = await api.post<ReviewRequest>(`/versions/${versionId}/approve`)
  return data
}

export async function rejectVersion(
  versionId: string,
  comment?: string,
): Promise<ReviewRequest> {
  const { data } = await api.post<ReviewRequest>(`/versions/${versionId}/reject`, {
    comment: comment ?? null,
  })
  return data
}

export async function listComments(versionId: string): Promise<FeedbackComment[]> {
  const { data } = await api.get<FeedbackComment[]>(`/versions/${versionId}/comments`)
  return data
}

export async function addComment(
  versionId: string,
  body: { layer_id: string; language_code: string; comment: string },
): Promise<FeedbackComment> {
  const { data } = await api.post<FeedbackComment>(
    `/versions/${versionId}/comments`,
    body,
  )
  return data
}

export async function resolveComment(
  commentId: string,
  resolved: 'open' | 'resolved',
): Promise<FeedbackComment> {
  const { data } = await api.patch<FeedbackComment>(`/comments/${commentId}`, {
    resolved,
  })
  return data
}

export async function listMembers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/auth/brand/members')
  return data
}

// ---- Ratio variants ----

export async function listRatioVariants(versionId: string): Promise<RatioVariant[]> {
  const { data } = await api.get<RatioVariant[]>(`/versions/${versionId}/ratio-variants`)
  return data
}

export async function createRatioVariant(
  versionId: string,
  ratio: string,
  targetDims: { w: number; h: number },
  language: string,
): Promise<RatioVariant> {
  const { data } = await api.post<RatioVariant>(
    `/versions/${versionId}/ratio-variants`,
    { ratio, target_dims: targetDims, language },
  )
  return data
}

export async function updateRatioVariant(
  variantId: string,
  body: { layers_json?: RatioVariant['layers_json']; status?: 'draft' | 'published' },
): Promise<RatioVariant> {
  const { data } = await api.patch<RatioVariant>(`/ratio-variants/${variantId}`, body)
  return data
}

export async function deleteRatioVariant(variantId: string): Promise<void> {
  await api.delete(`/ratio-variants/${variantId}`)
}
