import { useState } from 'react'
import type { LinkItem } from '../../data/links'

interface ItemEditFormProps {
  item: LinkItem
  onSave: (item: LinkItem) => void
  onCancel: () => void
}

export function ItemEditForm({ item, onSave, onCancel }: ItemEditFormProps) {
  const [title, setTitle] = useState(item.title)
  const [url, setUrl] = useState(item.url)
  const [desc, setDesc] = useState(item.description ?? '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    const u = url.trim()
    if (!t || !u) return
    onSave({ title: t, url: u, description: desc.trim() || undefined })
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="add-form-row">
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <input
        className="add-desc"
        placeholder="Description (optional)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <div className="add-form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!title.trim() || !url.trim()}>
          Save
        </button>
      </div>
    </form>
  )
}
