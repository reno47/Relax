import { useMemo } from 'react'
import { tfsLinks, type LinkItem } from '../../data/links'
import tfsIcon from '../../assets/icons/tfs.svg'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { AddItemForm } from './AddItemForm'
import { Hero, RemovableCard } from './Shared'
import { TfsLookup } from './TfsLookup'
import { leafIteration, typeClass, type WorkItem } from './tfsUtils'

export default function TFS() {
  const [boards, setBoards] = useLocalStorage<LinkItem[]>('dashboard.tfs.boards', [
    tfsLinks.boards,
    tfsLinks.backlog,
  ])
  const [workitems, setWorkitems] = useLocalStorage<WorkItem[]>('dashboard.tfs.workitems', [])

  const existingIds = new Set(workitems.map((w) => w.id))

  function addWorkItem(item: WorkItem) {
    setWorkitems((prev) => (prev.some((w) => w.id === item.id) ? prev : [...prev, item]))
  }

  function removeWorkItem(itemId: number) {
    setWorkitems((prev) => prev.filter((w) => w.id !== itemId))
  }

  // Group the cards by their iteration leaf (e.g. "26-PI4 S2").
  const groups = useMemo(() => {
    const map = new Map<string, WorkItem[]>()
    for (const w of workitems) {
      const key = leafIteration(w.iteration)
      const arr = map.get(key) ?? []
      arr.push(w)
      map.set(key, arr)
    }
    return [...map.entries()]
  }, [workitems])

  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-tfs)' }}>
      <Hero
        icon={<img src={tfsIcon} alt="" className="hero-icon-img" aria-hidden="true" />}
        accent="var(--accent-tfs)"
        title={<>TFS</>}
        subtitle="Boards, backlog and the work items you are working on."
      />

      <div className="group">
        <h2 className="group-title">Boards &amp; Backlog</h2>
        <div className="card-grid">
          {boards.map((s, i) => (
            <RemovableCard
              key={`${s.url}-${i}`}
              item={s}
              onRemove={() => setBoards(boards.filter((_, idx) => idx !== i))}
              onEdit={(updated) => setBoards(boards.map((b, idx) => (idx === i ? updated : b)))}
            />
          ))}
        </div>
        <AddItemForm label="+ Add link" onAdd={(item) => setBoards([...boards, item])} />
      </div>

      <TfsLookup onAdd={addWorkItem} existingIds={existingIds} />

      {groups.length === 0 ? (
        <p className="tfs-empty">
          Search a work item ID above and add it — cards are grouped by iteration.
        </p>
      ) : (
        groups.map(([iteration, items]) => (
          <div className="group" key={iteration}>
            <h2 className="group-title">{iteration}</h2>
            <div className="card-grid">
              {items.map((w) => (
                <div className="wi-card" key={w.id}>
                  <button
                    type="button"
                    className="wi-remove"
                    title="Remove"
                    aria-label={`Remove work item ${w.id}`}
                    onClick={() => removeWorkItem(w.id)}
                  >
                    ×
                  </button>
                  <div className="wi-card-head">
                    <span className={`wi-type ${typeClass(w.type)}`}>{w.type || 'Item'}</span>
                    <span className="wi-id">#{w.id}</span>
                  </div>
                  <a
                    className="wi-title"
                    href={w.url}
                    target={w.url ? '_blank' : undefined}
                    rel="noreferrer"
                  >
                    {w.title || 'Untitled'}
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  )
}
