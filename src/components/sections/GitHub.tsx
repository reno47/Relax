import { useEffect, useRef, useState } from 'react'
import { githubColumns, type LinkItem } from '../../data/links'
import { Hero } from './Shared'

const ORDER_KEY = 'dashboard.github.order'

// Source of truth for item content (titles/descriptions) keyed by URL.
const itemByUrl = new Map(githubColumns.flat().map((i) => [i.url, i]))

type Pos = { col: number; idx: number }

// Build the initial layout: use the saved URL order if present, but always
// pull item content from config, append any new repos, and drop removed ones.
function buildInitial(): LinkItem[][] {
  let saved: string[][] | null = null
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (raw) saved = JSON.parse(raw)
  } catch {
    saved = null
  }
  if (!saved || !Array.isArray(saved)) return githubColumns.map((c) => [...c])

  const used = new Set<string>()
  const cols: LinkItem[][] = saved.map((col) =>
    (Array.isArray(col) ? col : [])
      .map((url) => itemByUrl.get(url))
      .filter((i): i is LinkItem => Boolean(i))
      .map((i) => {
        used.add(i.url)
        return i
      }),
  )
  while (cols.length < githubColumns.length) cols.push([])
  // Append any repos from config that weren't in the saved layout.
  githubColumns.forEach((col, ci) => {
    col.forEach((item) => {
      if (!used.has(item.url)) {
        cols[ci].push(item)
        used.add(item.url)
      }
    })
  })
  return cols
}

export default function GitHub() {
  const [columns, setColumns] = useState<LinkItem[][]>(buildInitial)
  const [dragging, setDragging] = useState<Pos | null>(null)
  const [hint, setHint] = useState<Pos | null>(null)
  const dragRef = useRef<Pos | null>(null)

  useEffect(() => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(columns.map((c) => c.map((i) => i.url))))
  }, [columns])

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

  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-github)' }}>
      <Hero
        icon="🐙"
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
                    onDragStart={() => {
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
                      setHint({ col: ci, idx: ii })
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onDrop(ci, ii)
                    }}
                  >
                    <span className="drag-handle" aria-hidden="true">⋮⋮</span>
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
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
