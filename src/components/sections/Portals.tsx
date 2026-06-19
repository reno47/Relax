import { portalLinks, type LinkItem } from '../../data/links'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { AddItemForm } from './AddItemForm'
import { Hero, RemovableCard } from './Shared'

function readOld(key: string): LinkItem[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as LinkItem[]) : []
  } catch {
    return []
  }
}

export default function Portals() {
  const [items, setItems] = useLocalStorage<LinkItem[]>('dashboard.portals.items', [
    ...portalLinks,
    ...readOld('dashboard.portals.custom'),
  ])

  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-portals)' }}>
      <Hero
        icon="🔗"
        accent="var(--accent-portals)"
        title={<>Important Portals</>}
        subtitle="Frequently used company portals, all in one place."
      />

      <div className="group">
        <h2 className="group-title">Portals</h2>
        <div className="card-grid">
          {items.map((item, i) => (
            <RemovableCard
              key={`${item.url}-${i}`}
              item={item}
              onRemove={() => setItems(items.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
        <AddItemForm label="+ Add portal" onAdd={(item) => setItems([...items, item])} />
      </div>
    </section>
  )
}
