import { useEffect, useRef, useState } from 'react'
import { githubColumns, type LinkItem } from '../../data/links'
import githubIcon from '../../assets/icons/github.svg'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { hydrate, schedulePush, subscribe } from '../../lib/syncStore'
import { AddItemForm, type NewItem } from './AddItemForm'
import { Hero } from './Shared'

const ORDER_KEY = 'dashboard.github.order'
const CUSTOM_KEY = 'dashboard.github.custom'
const REMOVED_KEY = 'dashboard.github.removed'

type Pos = { col: number; idx: number }
type CustomItem = LinkItem & { col: number }

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function buildInitial(): LinkItem[][] {
  const custom = readJSON<CustomItem[]>(CUSTOM_KEY, [])
  const removed = new Set(readJSON<string[]>(REMOVED_KEY, []))
  const registry = new Map<string, LinkItem>()
  githubColumns.flat().forEach((i) => registry.set(i.url, i))
  custom.forEach((c) => registry.set(c.url, { title: c.title, url: c.url, description: c.description }))

  const saved = readJSON<string[][] | null>(ORDER_KEY, null)
  const used = new Set<string>()
  let cols: LinkItem[][]

  if (saved && Array.isArray(saved)) {
    cols = saved.map((col) =>
      (Array.isArray(col) ? col : [])
        .map((url) => registry.get(url))
        .filter((i): i is LinkItem => Boolean(i))
        .filter((i) => !removed.has(i.url))
        .map((i) => {
          used.add(i.url)
          return i
        }),
    )
    while (cols.length < githubColumns.length) cols.push([])
  } else {
    cols = githubColumns.map((c) => c.filter((i) => !removed.has(i.url)))
    cols.flat().forEach((i) => used.add(i.url))
  }

  githubColumns.forEach((col, ci) => {
    col.forEach((item) => {
      if (!used.has(item.url) && !removed.has(item.url)) {
        cols[ci].push(item)
        used.add(item.url)
      }
    })
  })
  custom.forEach((c) => {
    if (!used.has(c.url) && !removed.has(c.url)) {
      const ci = Math.min(Math.max(c.col, 0), cols.length - 1)
      cols[ci].push({ title: c.title, url: c.url, description: c.description })
      used.add(c.url)
    }
  })
  return cols
}

export default function GitHub() {
  const [columns, setColumns] = useState<LinkItem[][]>(buildInitial)
  const [, setCustomItems] = useLocalStorage<CustomItem[]>(CUSTOM_KEY, [])
  const [, setRemovedUrls] = useLocalStorage<string[]>(REMOVED_KEY, [])
  const [dragging, setDragging] = useState<Pos | null>(null)
  const [hint, setHint] = useState<Pos | null>(null)
  const [addCol, setAddCol] = useState(0)
  const dragRef = useRef<Pos | null>(null)

  useEffect(() => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(columns.map((c) => c.map((i) => i.url))))
    schedulePush()
  }, [columns])

  // Rebuild the layout when the server hydrates order / custom / removed keys.
  useEffect(() => {
    const apply = () => setColumns(buildInitial())
    const unsubs = [
      subscribe(ORDER_KEY, apply),
      subscribe(CUSTOM_KEY, apply),
      subscribe(REMOVED_KEY, apply),
    ]
    hydrate()
    return () => unsubs.forEach((u) => u())
  }, [])

  function move(src: Pos, destCol: number, destIdx: number) {
    setColumns((prev) => {
      const next = prev.map((c) => [...c])
      const [item] = next[src.col].splice(src.idx, 1)
      if (!item) return prev
      let insertIdx = destIdx
      if (src.col === destCol && src.idx < destIdx) insertIdx -= 1
      next[destCol].splice(insertIdx, 0, item)
      return next
    })
  }

  function onDrop(destCol: number, destIdx: number) {
    const src = dragRef.current
    if (src) move(src, destCol, destIdx)
    dragRef.current = null
    setDragging(null)
    setHint(null)
  }

  function addItem(item: NewItem, col: number) {
    const ci = Math.min(Math.max(col, 0), columns.length - 1)
    setCustomItems((prev) => [...prev, { ...item, col: ci }])
    setColumns((prev) => {
      const next = prev.map((c) => [...c])
      next[ci] = [...next[ci], { title: item.title, url: item.url, description: item.description }]
      return next
    })
  }

  function removeItem(url: string) {
    setRemovedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))
    setCustomItems((prev) => prev.filter((c) => c.url !== url))
    setColumns((prev) => prev.map((c) => c.filter((i) => i.url !== url)))
  }

  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-github)' }}>
      <Hero
        icon={<img src={githubIcon} alt="" className="hero-icon-img" aria-hidden="true" />}
        accent="var(--accent-github)"
        title={<>GitHub</>}
        subtitle="Quick access to your repositories. Drag cards to reorder or move them between columns."
      />

      <div className="group">
        <h2 className="group-title">Repositories &amp; Links</h2>
        <div className="github-columns">
          {columns.map((column, ci) => (
            <div
              key={ci}
              className={`github-column ${hint?.col === ci && hint.idx === column.length ? 'drop-end' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setHint({ col: ci, idx: column.length })
              }}
              onDrop={(e) => {
                e.preventDefault()
                onDrop(ci, column.length)
              }}
            >
              {column.map((item, ii) => {
                const isDragging = dragging?.col === ci && dragging.idx === ii
                const showHint = hint?.col === ci && hint.idx === ii
                return (
                  <div
                    key={item.url}
                    className={`dnd-card ${isDragging ? 'dragging' : ''} ${showHint ? 'drop-before' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', `${ci}:${ii}`)
                      dragRef.current = { col: ci, idx: ii }
                      setDragging({ col: ci, idx: ii })
                    }}
                    onDragEnd={() => {
                      dragRef.current = null
                      setDragging(null)
                      setHint(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.dataTransfer.dropEffect = 'move'
                      setHint({ col: ci, idx: ii })
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onDrop(ci, ii)
                    }}
                  >
                    <span className="drag-handle" aria-hidden="true">⋮⋮</span>
                    <button
                      type="button"
                      className="dnd-remove"
                      title="Remove"
                      aria-label={`Remove ${item.title}`}
                      onClick={() => removeItem(item.url)}
                    >
                      ×
                    </button>
                    <a
                      className="link-card dnd-link"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      draggable={false}
                    >
                      <div className="card-title">{item.title}</div>
                      {item.description && <div className="card-desc">{item.description}</div>}
                    </a>
                  </div>
                )
              })}

              {/* Trailing drop zone — lets you drop at the end of any column. */}
              <div
                className={`column-dropzone ${hint?.col === ci && hint.idx === column.length ? 'active' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setHint({ col: ci, idx: column.length })
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  onDrop(ci, column.length)
                }}
              />
            </div>
          ))}
        </div>
        <AddItemForm
          label="+ Add repo / link"
          onAdd={(item) => addItem(item, addCol)}
          extra={
            <label className="add-col-select">
              Column
              <select value={addCol} onChange={(e) => setAddCol(Number(e.target.value))}>
                {columns.map((_, ci) => (
                  <option key={ci} value={ci}>
                    {ci + 1}
                  </option>
                ))}
              </select>
            </label>
          }
        />
      </div>
    </section>
  )
}
