import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Languages, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmPopover } from '@/components/ui/confirm-popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RatioDialog } from '@/components/editor/RatioDialog'
import { langLabel, statusLabel } from '@/lib/constants'
import { LANGUAGES, type TemplateVersion, type TextLayer } from '@/types'

// Prefix used so one Select can both switch to an existing language variant and
// trigger "add a new language" — distinguished by this marker in onValueChange.
const ADD_PREFIX = 'add:'

interface Props {
  versionId: string
  templateName?: string
  versionNumber?: number
  versionStatus?: string
  versions: TemplateVersion[]
  blankImageUrl?: string
  // Source design dimensions — used to render the resize composite client-side.
  sourceWidth?: number
  sourceHeight?: number
  layers: TextLayer[]
  // The language the canvas/inspector/export currently show & edit.
  activeLanguage: string
  // Languages that already have content in this version (the dropdown's variants).
  presentLanguages: string[]
  // The original language — translations are always made from it.
  sourceLanguage: string
  editable: boolean
  isEditor: boolean
  onSwitchVersion: (versionId: string) => void
  onDeleteVersion: () => void
  // Switch which existing language the canvas shows/edits.
  onSwitchVariant: (code: string) => void
  // Translate the version into a not-yet-present language (review then apply).
  onAddLanguage: (code: string) => void
  onExport: () => void
}

export function EditorHeader({
  versionId,
  templateName,
  versionNumber,
  versionStatus,
  versions,
  blankImageUrl,
  sourceWidth,
  sourceHeight,
  layers,
  activeLanguage,
  presentLanguages,
  sourceLanguage,
  editable,
  isEditor,
  onSwitchVersion,
  onDeleteVersion,
  onSwitchVariant,
  onAddLanguage,
  onExport,
}: Props) {
  // Supported languages not yet present — offered under "Add language".
  const addable = LANGUAGES.filter((l) => !presentLanguages.includes(l.code))
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Templates
          </Button>
        </Link>
        <div>
          <p className="text-sm font-semibold">{templateName ?? 'Editor'}</p>
          {versions.length > 1 ? (
            <Select value={versionId} onValueChange={onSwitchVersion}>
              <SelectTrigger className="h-6 w-auto gap-1 border-none px-1 text-xs text-muted-foreground shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    v{v.version_number} · {statusLabel(v.status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">
              v{versionNumber} · {statusLabel(versionStatus)}
              {!editable && ' · Read-only'}
            </p>
          )}
        </div>

        {isEditor && (
          <ConfirmPopover
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                aria-label="Delete this version"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            }
            title={`Delete version v${versionNumber}?`}
            description="This permanently deletes this version and all its layers, translations and ratio variants. This cannot be undone."
            onConfirm={onDeleteVersion}
          />
        )}

        {/* Language variant — switches the canvas between languages that exist,
            and offers "Add language" to translate into a new one. */}
        <Select
          value={activeLanguage}
          onValueChange={(v) =>
            v.startsWith(ADD_PREFIX)
              ? onAddLanguage(v.slice(ADD_PREFIX.length))
              : onSwitchVariant(v)
          }
        >
          <SelectTrigger className="h-8 w-auto gap-1.5 px-2.5 text-xs">
            <Languages className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Language variant</SelectLabel>
              {presentLanguages.map((code) => (
                <SelectItem key={code} value={code} className="text-xs">
                  {langLabel(code)}
                  {code === sourceLanguage && (
                    <span className="ml-1 text-muted-foreground">· original</span>
                  )}
                </SelectItem>
              ))}
            </SelectGroup>
            {editable && addable.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Add language</SelectLabel>
                  {addable.map((l) => (
                    <SelectItem
                      key={l.code}
                      value={`${ADD_PREFIX}${l.code}`}
                      className="text-xs"
                    >
                      + {l.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        {blankImageUrl && (
          <RatioDialog
            versionId={versionId}
            blankImageUrl={blankImageUrl}
            baseLayers={layers}
            language={activeLanguage}
            sourceLanguage={sourceLanguage}
            sourceWidth={sourceWidth}
            sourceHeight={sourceHeight}
            /* Variants are separate adaptations, so editors can manage them
               even while the version is in review / approved. */
            editable={isEditor}
          />
        )}
        <Button size="sm" onClick={onExport}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>
    </header>
  )
}
