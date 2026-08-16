import { useMemo, useState } from 'react'
import { tfsLinks, type LinkItem } from '../../data/links'
import tfsIcon from '../../assets/icons/tfs.svg'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { AddItemForm } from './AddItemForm'
import { Hero, RemovableCard } from './Shared'
import { TfsLookup } from './TfsLookup'
import { TfsSettings } from './TfsSettings'
import { TfsFilters } from './TfsFilters'
import { useAssignedWorkItems } from './useAssignedWorkItems'
import {
  leafIteration,
  stateClass,
  typeBucket,
  typeClass,
  type TypeBucket,
  type WorkItem,
} from './tfsUtils'

type MergedItem = WorkItem & { source: 'manual' | 'assigned' }

const ALL_TYPES: TypeBucket[] = ['feature', 'story', 'bug']

export default function TFS() {
  const [boards, setBoards] = useLocalStorage<LinkItem[]>('dashboard.tfs.boards', [
    tfsLinks.boards,
    tfsLinks.backlog,
  ])
  const [workitems, setWorkitems] = useLocalStorage<WorkItem[]>('dashboard.tfs.workitems', [])
  const [connected, setConnected] = useState(false)
  const [activeTypes, setActiveTypes] = useState<Set<TypeBucket>>(() => new Set(ALL_TYPES))
  const [iterationFilter, setIterationFilter] = useState('all')

  const { items: assigned, iterations, loading, error, refresh } = useAssignedWorkItems(connected)

  const existingIds = new Set([...workitems.map((w) => w.id), ...assigned.map((a) => a.id)])

  function addWorkItem(item: WorkItem) {
    setWorkitems((prev) => (prev.some((w) => w.id === item.id) ? prev : [...prev, item]))
  }

  function removeWorkItem(itemId: number) {
    setWorkitems((prev) => prev.filter((w) => w.id !== itemId))
  }

  function toggleType(t: TypeBucket) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const merged = useMemo(() => {
    const orderByPath = new Map(iterations.map((it) => [it.path, it.order]))
    const byId = new Map<number, MergedItem>()
    for (const w of workitems) {
      byId.set(w.id, { ...w, source: 'manual', order: orderByPath.get(w.iteration) ?? -1 })
    }
    for (const a of assigned) byId.set(a.id, { ...a, source: 'assigned' })
    return [...byId.values()]
  }, [workitems, assigned, iterations])

  const groups = useMemo(() => {
    const map = new Map<string, { order: number; items: MergedItem[] }>()
    for (const m of merged) {
      if (!activeTypes.has(typeBucket(m.type))) continue
      if (iterationFilter !== 'all' && m.iteration !== iterationFilter) continue
      const key = leafIteration(m.iteration)
      const g = map.get(key) ?? { order: m.order ?? -1, items: [] }
      g.items.push(m)
      g.order = Math.max(g.order, m.order ?? -1)
      map.set(key, g)
    }
    return [...map.entries()].sort((a, b) => b[1].order - a[1].order)
  }, [merged, activeTypes, iterationFilter])

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

      <div className="group">
        <h2 className="group-title">Azure DevOps connection</h2>
        <TfsSettings onConfiguredChange={setConnected} />
      </div>

      <TfsLookup onAdd={addWorkItem} existingIds={existingIds} enabled={connected} />

      {connected && (
        <TfsFilters
          activeTypes={activeTypes}
          onToggleType={toggleType}
          iterations={iterations}
          selectedIteration={iterationFilter}
          onSelectIteration={setIterationFilter}
          onRefresh={refresh}
          loading={loading}
        />
      )}

      {error && <div className="tfs-error">{error}</div>}

      {groups.length === 0 ? (
        <p className="tfs-empty">
          {connected
            ? 'No work items match. Assigned items appear automatically; add more by ID above.'
            : 'Search a work item ID above and add it — cards are grouped by iteration.'}
        </p>
      ) : (
        groups.map(([iteration, group]) => (
          <div className="group" key={iteration}>
            <h2 className="group-title">{iteration}</h2>
            <div className="card-grid">
              {group.items.map((w) => (
                <div className="wi-card" key={w.id}>
                  {w.source === 'manual' && (
                    <button
                      type="button"
                      className="wi-remove"
                      title="Remove"
                      aria-label={`Remove work item ${w.id}`}
                      onClick={() => removeWorkItem(w.id)}
                    >
                      ×
                    </button>
                  )}
                  <div className="wi-card-head">
                    <span className={`wi-type ${typeClass(w.type)}`}>{w.type || 'Item'}</span>
                    <span className="wi-id">#{w.id}</span>
                    {w.state && <span className={`wi-state ${stateClass(w.state)}`}>{w.state}</span>}
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
