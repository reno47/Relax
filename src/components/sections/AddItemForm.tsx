import { useState, type ReactNode } from 'react'

export interface NewItem {
  title: string
  url: string
  description?: string
}

interface AddItemFormProps {
  label?: string
  onAdd: (item: NewItem) => void
  
  extra?: ReactNode
}

export function AddItemForm({ label = '+ Add', onAdd, extra }: AddItemFormProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [desc, setDesc] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    const u = url.trim()
    if (!t || !u) return
    onAdd({ title: t, url: u, description: desc.trim() || undefined })
    setTitle('')
    setUrl('')
    setDesc('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button type="button" className="add-toggle" onClick={() => setOpen(true)}>
        {label}
      </button>
    )
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <div className="add-form-row">
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <input
        className="add-desc"
        placeholder="Description (optional)"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      {extra}
      <div className="add-form-actions">
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!title.trim() || !url.trim()}>
          Add
        </button>
      </div>
    </form>
  )
}
