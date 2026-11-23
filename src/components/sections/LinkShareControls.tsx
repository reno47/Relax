import { useEffect, useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import {
  MAX_FILE_BYTES,
  countLinks,
  downloadShareFile,
  parseShareFile,
  type ShareKind,
  type ShareSection,
} from './linkShare'
import './confirmDialog.css'
import './linkShare.css'

type ExportPickerProps = {
  sections: ShareSection[]
  onExport: (picked: ShareSection[]) => void
  onCancel: () => void
}

function ExportPicker({ sections, onExport, onCancel }: Readonly<ExportPickerProps>) {
  const [picked, setPicked] = useState<boolean[]>(() => sections.map(() => true))
  const chosen = sections.filter((_, i) => picked[i])
  const allOn = picked.every(Boolean)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-card" role="dialog" aria-modal="true" aria-label="Export links" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-title">Export links</h3>
        <div className="confirm-message">
          <button type="button" className="ls-toggle-all" onClick={() => setPicked(sections.map(() => !allOn))}>
            {allOn ? 'Select none' : 'Select all'}
          </button>
          <ul className="ls-list">
            {sections.map((s, i) => (
              <li key={`${s.title}-${i}`}>
                <label>
                  <input
                    type="checkbox"
                    checked={picked[i]}
                    onChange={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))}
                  />
                  <span>{s.title}</span>
                  <span className="ls-count">{s.items.length} links</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="confirm-actions">
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!chosen.length} onClick={() => onExport(chosen)}>
            Download ({chosen.length})
          </button>
        </div>
      </div>
    </div>
  )
}

type LinkShareControlsProps = {
  kind: ShareKind
  label: string
  sections: ShareSection[]
  onImport: (sections: ShareSection[]) => void
}

export function LinkShareControls({ kind, label, sections, onImport }: Readonly<LinkShareControlsProps>) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [exporting, setExporting] = useState(false)
  const [pending, setPending] = useState<ShareSection[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_FILE_BYTES) return setError('The file is too large (max 1 MB).')
    const result = parseShareFile(await file.text(), kind)
    if ('error' in result) return setError(result.error)
    setError(null)
    setPending(result.sections)
  }

  return (
    <>
      <button type="button" className="ls-btn" onClick={() => setExporting(true)} disabled={!sections.length}>
        Export
      </button>
      <button type="button" className="ls-btn" onClick={() => fileRef.current?.click()}>
        Import
      </button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      {error && <span className="ls-error" role="alert">{error}</span>}

      {exporting && (
        <ExportPicker
          sections={sections}
          onCancel={() => setExporting(false)}
          onExport={(picked) => {
            downloadShareFile(kind, picked)
            setExporting(false)
          }}
        />
      )}

      {pending && (
        <ConfirmDialog
          title={`Replace all ${label}?`}
          message={
            <>
              This replaces your {sections.length} sections / {countLinks(sections)} links with{' '}
              {pending.length} sections / {countLinks(pending)} links from the file. This can't be undone.
            </>
          }
          confirmLabel="Replace"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            onImport(pending)
            setPending(null)
          }}
        />
      )}
    </>
  )
}
