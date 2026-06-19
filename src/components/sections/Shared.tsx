import type { LinkItem } from '../../data/links'
import './sections.css'

export function Hero({
  icon,
  title,
  accent,
}: {
  icon: string
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

// A card with a delete (×) button — used for user-added items.
export function RemovableCard({ item, onRemove }: { item: LinkItem; onRemove: () => void }) {
  return (
    <div className="card-wrap">
      <button className="card-remove" onClick={onRemove} title="Remove" aria-label="Remove item">
        ×
      </button>
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
