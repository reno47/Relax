import { useState } from 'react'
import type { LinkItem } from '../../data/links'
import { ItemEditForm } from './ItemEditForm'
import './sections.css'

export function Hero({
  icon,
  title,
  accent,
}: {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle?: string
  accent: string
}) {
  return (
    <div className="hero" style={{ ['--section-accent' as string]: accent }}>
      <span className="hero-icon">{icon}</span>
      <div className="hero-text">
        <h1>{title}</h1>
      </div>
    </div>
  )
}

function isPlaceholder(url: string) {
  return !url || url === '#'
}

export function LinkCard({ item }: { item: LinkItem }) {
  return (
    <a
      className="link-card"
      href={item.url}
      target={isPlaceholder(item.url) ? undefined : '_blank'}
      rel="noreferrer"
    >
      <div className="card-title">
        {item.title}
        {isPlaceholder(item.url) && <span className="placeholder-tag">set link</span>}
      </div>
      {item.description && <div className="card-desc">{item.description}</div>}
    </a>
  )
}

export function LinkRow({ item }: { item: LinkItem }) {
  return (
    <a
      className="link-row"
      href={item.url}
      target={isPlaceholder(item.url) ? undefined : '_blank'}
      rel="noreferrer"
    >
      <span className="row-bullet" />
      <span className="row-title">{item.title}</span>
      {isPlaceholder(item.url) && <span className="placeholder-tag">set link</span>}
      {item.description && <span className="row-desc">{item.description}</span>}
    </a>
  )
}

// A card with edit (✎) and delete (×) buttons — used for user-managed items.
export function RemovableCard({
  item,
  onRemove,
  onEdit,
}: {
  item: LinkItem
  onRemove: () => void
  onEdit?: (item: LinkItem) => void
}) {
  const [editing, setEditing] = useState(false)

  if (editing && onEdit) {
    return (
      <ItemEditForm
        item={item}
        onSave={(updated) => {
          onEdit(updated)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="card-wrap">
      <div className="card-actions">
        {onEdit && (
          <button
            type="button"
            className="card-edit"
            onClick={() => setEditing(true)}
            title="Edit"
            aria-label="Edit item"
          >
            ✎
          </button>
        )}
        <button
          type="button"
          className="card-remove"
          onClick={onRemove}
          title="Remove"
          aria-label="Remove item"
        >
          ×
        </button>
      </div>
      <a
        className="link-card"
        href={item.url}
        target={isPlaceholder(item.url) ? undefined : '_blank'}
        rel="noreferrer"
      >
        <div className="card-title">{item.title}</div>
        {item.description && <div className="card-desc">{item.description}</div>}
      </a>
    </div>
  )
}
