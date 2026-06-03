import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Languages, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RatioDialog } from '@/components/editor/RatioDialog'
import { LANGUAGES, type TemplateVersion, type TextLayer } from '@/types'

interface Props {
  versionId: string
  templateName?: string
  versionNumber?: number
  versionStatus?: string
  versions: TemplateVersion[]
  blankImageUrl?: string
  layers: TextLayer[]
  language: string
  editable: boolean
  isEditor: boolean
  onSwitchVersion: (versionId: string) => void
  onDeleteVersion: () => void
  onSwitchLanguage: (code: string) => void
  onTranslate: () => void
  onExport: () => void
}

export function EditorHeader({
  versionId,
  templateName,
  versionNumber,
  versionStatus,
  versions,
  blankImageUrl,
  layers,
  language,
  editable,
  isEditor,
  onSwitchVersion,
  onDeleteVersion,
  onSwitchLanguage,
  onTranslate,
  onExport,
}: Props) {
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
                    v{v.version_number} · {v.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">
              v{versionNumber} · {versionStatus}
              {!editable && ' · read-only'}
            </p>
          )}
        </div>
        {isEditor && (
          <ConfirmDialog
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
      </div>

      <div className="flex items-center gap-2">
        <Select value={language} onValueChange={onSwitchLanguage}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {editable && (
          <Button variant="outline" size="sm" onClick={onTranslate}>
            <Languages className="mr-1 h-4 w-4" /> Translate
          </Button>
        )}
        {blankImageUrl && (
          <RatioDialog
            versionId={versionId}
            blankImageUrl={blankImageUrl}
            baseLayers={layers}
            language={language}
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
