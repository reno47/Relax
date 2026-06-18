import type { LinkItem } from '../../data/links'
import './sections.css'

export function Hero({
  icon,
  title,
  subtitle,
  accent,
}: {
  icon: string
  title: React.ReactNode
  subtitle: string
  accent: string
}) {
  return (
    <div className="hero" style={{ ['--section-accent' as string]: accent }}>
      <span className="hero-icon">{icon}</span>
      <div className="hero-text">
        <h1>{title}</h1>
        <p>{subtitle}</p>
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
