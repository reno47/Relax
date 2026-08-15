import { useState } from 'react'
import { leafIteration, typeClass, type WorkItem } from './tfsUtils'

interface TfsLookupProps {
  onAdd: (item: WorkItem) => void
  existingIds: ReadonlySet<number>
}

// Searches an Azure DevOps work item by ID (via /api/tfs), previews its
// type/id/title/iteration, and lets you add it as a card.
export function TfsLookup({ onAdd, existingIds }: Readonly<TfsLookupProps>) {
  const [id, setId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<WorkItem | null>(null)

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = id.trim()
    if (!/^\d+$/.test(trimmed)) {
      setError('Enter a numeric work item ID.')
      return
    }
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const r = await fetch(`/api/tfs?id=${trimmed}`)
      const data = await r.json()
      if (!r.ok) {
        setError(data.error ?? 'Lookup failed.')
        return
      }
      setPreview(data as WorkItem)
    } catch {
      setError('Could not reach the lookup service.')
    } finally {
      setLoading(false)
    }
  }

  const alreadyAdded = preview ? existingIds.has(preview.id) : false

  return (
    <div className="group">
      <h2 className="group-title">Add a work item</h2>
      <form className="tfs-lookup" onSubmit={lookup}>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Work item ID — story, bug or feature (e.g. 1753586)"
          inputMode="numeric"
        />
        <button type="submit" className="btn-primary" disabled={loading || !id.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <div className="tfs-error">{error}</div>}

      {preview && (
        <div className="tfs-result">
          <div className="wi-card-head">
            <span className={`wi-type ${typeClass(preview.type)}`}>{preview.type || 'Item'}</span>
            <span className="wi-id">#{preview.id}</span>
          </div>
          <div className="tfs-row">
            <span className="tfs-label">Title</span>
            <span className="tfs-value">{preview.title || '—'}</span>
          </div>
          <div className="tfs-row">
            <span className="tfs-label">Iteration</span>
            <span className="tfs-value">{leafIteration(preview.iteration)}</span>
          </div>
          <div className="tfs-preview-actions">
            {preview.url && (
              <a className="tfs-open" href={preview.url} target="_blank" rel="noreferrer">
                Open in Azure DevOps ↗
              </a>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={alreadyAdded}
              onClick={() => {
                onAdd(preview)
                setPreview(null)
                setId('')
              }}
            >
              {alreadyAdded ? 'Already added' : '+ Add card'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
