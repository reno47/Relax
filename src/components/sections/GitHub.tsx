import { useEffect, useRef, useState } from 'react'
import { githubColumns, githubSectionColumns, type LinkItem } from '../../data/links'
import githubIcon from '../../assets/icons/github.svg'
import { hydrate, schedulePush, subscribe } from '../../lib/syncStore'
import { ConfirmDialog } from './ConfirmDialog'
import { ItemEditForm } from './ItemEditForm'
import { Hero } from './Shared'

const SECTIONS_KEY = 'dashboard.github.sections'

const LAYOUT_KEY = 'dashboard.github.layout'
const ORDER_KEY = 'dashboard.github.order'
const CUSTOM_KEY = 'dashboard.github.custom'
const REMOVED_KEY = 'dashboard.github.removed'

const DEFAULT_TITLES = ['Core', 'AWS', 'Platform', 'Build', 'Services', 'Misc']

interface Section {
  id: string
  title: string
  collapsed?: boolean
  items: LinkItem[]
}
type Columns = Section[][]
type Pos = { col: number; sec: number; idx: number }

let idCounter = 0
function newId(): string {
  idCounter += 1
  return `s-${Date.now().toString(36)}-${idCounter}`
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function buildLegacyFlat(): LinkItem[][] {
  type CustomItem = LinkItem & { col: number }
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

function wrapFlat(flat: LinkItem[][]): Columns {
  return flat.map((items, ci) =>
    items.length ? [{ id: newId(), title: DEFAULT_TITLES[ci] ?? `Section ${ci + 1}`, items }] : [],
  )
}

function normalize(cols: Columns): Columns {
  const out = cols.map((col) =>
    (Array.isArray(col) ? col : []).map((s) => ({
      id: s.id || newId(),
      title: s.title ?? 'Section',
      collapsed: Boolean(s.collapsed),
      items: Array.isArray(s.items) ? s.items : [],
    })),
  )
  while (out.length < githubSectionColumns.length) out.push([])
  return out
}

function buildInitial(): Columns {
  const saved = readJSON<Columns | null>(SECTIONS_KEY, null)
  if (saved && Array.isArray(saved)) return normalize(saved)

  const flatSaved = readJSON<LinkItem[][] | null>(LAYOUT_KEY, null)
  if (flatSaved && Array.isArray(flatSaved)) return normalize(wrapFlat(flatSaved))

  return normalize(wrapFlat(buildLegacyFlat()))
}

export default function GitHub() {
  const [columns, setColumns] = useState<Columns>(buildInitial)
  const [dragging, setDragging] = useState<Pos | null>(null)
  const [hint, setHint] = useState<Pos | null>(null)
  const [editing, setEditing] = useState<Pos | null>(null)
  const [adding, setAdding] = useState<{ col: number; sec: number } | null>(null)
  const [renaming, setRenaming] = useState<{ col: number; sec: number } | null>(null)
  const [renameText, setRenameText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ col: number; sec: number } | null>(null)
  const [addingSection, setAddingSection] = useState(false)
  const [newSecTitle, setNewSecTitle] = useState('')
  const [newSecCol, setNewSecCol] = useState(0)
  const [secDragging, setSecDragging] = useState<{ col: number; sec: number } | null>(null)
  const [secHint, setSecHint] = useState<{ col: number; sec: number } | null>(null)
  const dragRef = useRef<Pos | null>(null)
  const secDragRef = useRef<{ col: number; sec: number } | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    if (!readyRef.current) return
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(columns))
    schedulePush()
  }, [columns])

  useEffect(() => {
    const apply = () => setColumns(buildInitial())
    const unsubs = [
      subscribe(SECTIONS_KEY, apply),
      subscribe(LAYOUT_KEY, apply),
      subscribe(ORDER_KEY, apply),
      subscribe(CUSTOM_KEY, apply),
      subscribe(REMOVED_KEY, apply),
    ]
    hydrate().finally(() => {
      readyRef.current = true
      setColumns(buildInitial())
    })
    return () => unsubs.forEach((u) => u())
  }, [])

  function moveItem(src: Pos, dst: Pos) {
    setColumns((prev) => {
      const next = prev.map((col) => col.map((s) => ({ ...s, items: [...s.items] })))
      const from = next[src.col]?.[src.sec]
      const to = next[dst.col]?.[dst.sec]
      if (!from || !to) return prev
      const [item] = from.items.splice(src.idx, 1)
      if (!item) return prev
      let insert = dst.idx
      if (src.col === dst.col && src.sec === dst.sec && src.idx < dst.idx) insert -= 1
      to.items.splice(insert, 0, item)
      return next
    })
  }

  function onDrop(dst: Pos) {
    const src = dragRef.current
    if (src) moveItem(src, dst)
    dragRef.current = null
    setDragging(null)
    setHint(null)
  }

  function moveSection(src: { col: number; sec: number }, dstCol: number, dstSec: number) {
    setColumns((prev) => {
      const next = prev.map((col) => [...col])
      const [section] = next[src.col].splice(src.sec, 1)
      if (!section) return prev
      let insert = dstSec
      if (src.col === dstCol && src.sec < dstSec) insert -= 1
      next[dstCol].splice(insert, 0, section)
      return next
    })
  }

  function onSectionDrop(dstCol: number, dstSec: number) {
    const src = secDragRef.current
    if (src) moveSection(src, dstCol, dstSec)
    secDragRef.current = null
    setSecDragging(null)
    setSecHint(null)
  }

  function addItem(col: number, sec: number, item: LinkItem) {
    setColumns((prev) =>
      prev.map((c, ci) =>
        ci === col ? c.map((s, si) => (si === sec ? { ...s, items: [...s.items, item] } : s)) : c,
      ),
    )
  }

  function editItem(col: number, sec: number, idx: number, updated: LinkItem) {
    setColumns((prev) =>
      prev.map((c, ci) =>
        ci === col
          ? c.map((s, si) =>
              si === sec ? { ...s, items: s.items.map((it, i) => (i === idx ? updated : it)) } : s,
            )
          : c,
      ),
    )
  }

  function removeItem(col: number, sec: number, idx: number) {
    setColumns((prev) =>
      prev.map((c, ci) =>
        ci === col
          ? c.map((s, si) => (si === sec ? { ...s, items: s.items.filter((_, i) => i !== idx) } : s))
          : c,
      ),
    )
  }

  function toggleCollapse(col: number, sec: number) {
    setColumns((prev) =>
      prev.map((c, ci) =>
        ci === col ? c.map((s, si) => (si === sec ? { ...s, collapsed: !s.collapsed } : s)) : c,
      ),
    )
  }

  function removeSection(col: number, sec: number) {
    const section = columns[col]?.[sec]
    if (section && section.items.length > 0) {
      setConfirmDelete({ col, sec })
      return
    }
    deleteSection(col, sec)
  }

  function deleteSection(col: number, sec: number) {
    setColumns((prev) => prev.map((c, ci) => (ci === col ? c.filter((_, si) => si !== sec) : c)))
  }

  function addSection() {
    const t = newSecTitle.trim()
    if (!t) return
    const ci = Math.min(Math.max(newSecCol, 0), columns.length - 1)
    setColumns((prev) =>
      prev.map((c, i) => (i === ci ? [...c, { id: newId(), title: t, items: [] }] : c)),
    )
    setNewSecTitle('')
    setAddingSection(false)
  }

  function commitRename() {
    if (!renaming) return
    const t = renameText.trim()
    if (t) {
      const { col, sec } = renaming
      setColumns((prev) =>
        prev.map((c, ci) =>
          ci === col ? c.map((s, si) => (si === sec ? { ...s, title: t } : s)) : c,
        ),
      )
    }
    setRenaming(null)
    setRenameText('')
  }

  return (
    <section className="section github-section" style={{ ['--section-accent' as string]: 'var(--accent-github)' }}>
      <Hero
        icon={<img src={githubIcon} alt="" className="hero-icon-img" aria-hidden="true" />}
        accent="var(--accent-github)"
        title={<>GitHub</>}
        subtitle="Quick access to your repositories."
      />

      <div className="group">
        <div className="gh-group-head">
          <h2 className="group-title">Repository Links</h2>
          {addingSection ? (
            <form
              className="gh-add-section-bar"
              onSubmit={(e) => {
                e.preventDefault()
                addSection()
              }}
            >
              <input
                placeholder="Section name"
                value={newSecTitle}
                autoFocus
                onChange={(e) => setNewSecTitle(e.target.value)}
              />
              <label className="gh-add-col">
                Column
                <select value={newSecCol} onChange={(e) => setNewSecCol(Number(e.target.value))}>
                  {columns.map((_, ci) => (
                    <option key={ci} value={ci}>
                      {ci + 1}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setAddingSection(false)
                  setNewSecTitle('')
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!newSecTitle.trim()}>
                Add
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="gh-add-section-btn"
              onClick={() => setAddingSection(true)}
            >
              + Add section
            </button>
          )}
        </div>
        <div className="github-columns">
          {columns.map((col, ci) => (
            <div key={ci} className="github-column">
              {col.map((sec, si) => {
                const isRenaming = renaming?.col === ci && renaming.sec === si
                const isSecDragging = secDragging?.col === ci && secDragging.sec === si
                const showSecHint = secHint?.col === ci && secHint.sec === si
                return (
                  <div
                    className={`gh-parent ${isSecDragging ? 'sec-dragging' : ''} ${showSecHint ? 'sec-drop-before' : ''}`}
                    key={sec.id}
                  >
                    <div
                      className="gh-parent-head"
                      role="button"
                      tabIndex={0}
                      aria-expanded={!sec.collapsed}
                      draggable={!isRenaming}
                      onClick={() => !isRenaming && toggleCollapse(ci, si)}
                      onKeyDown={(e) => {
                        if (isRenaming) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          toggleCollapse(ci, si)
                        }
                      }}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', `sec:${ci}:${si}`)
                        secDragRef.current = { col: ci, sec: si }
                        setSecDragging({ col: ci, sec: si })
                      }}
                      onDragEnd={() => {
                        secDragRef.current = null
                        setSecDragging(null)
                        setSecHint(null)
                      }}
                      onDragOver={(e) => {
                        if (!secDragRef.current) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        setSecHint({ col: ci, sec: si })
                      }}
                      onDrop={(e) => {
                        if (!secDragRef.current) return
                        e.preventDefault()
                        onSectionDrop(ci, si)
                      }}
                    >
                      <span className="gh-caret" aria-hidden="true">
                        {sec.collapsed ? '▶' : '▼'}
                      </span>
                      {isRenaming ? (
                        <input
                          className="gh-rename-input"
                          value={renameText}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenameText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') {
                              setRenaming(null)
                              setRenameText('')
                            }
                          }}
                          onBlur={commitRename}
                        />
                      ) : (
                        <span className="gh-parent-title">{sec.title}</span>
                      )}
                      <div className="gh-parent-actions">
                        <button
                          type="button"
                          className="dnd-add"
                          title="Add item"
                          aria-label={`Add item to ${sec.title}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (sec.collapsed) toggleCollapse(ci, si)
                            setAdding({ col: ci, sec: si })
                          }}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="dnd-edit"
                          title="Rename section"
                          aria-label={`Rename ${sec.title}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setRenaming({ col: ci, sec: si })
                            setRenameText(sec.title)
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="dnd-remove"
                          title="Delete section"
                          aria-label={`Delete ${sec.title}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            removeSection(ci, si)
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {!sec.collapsed && (
                      <div className="gh-parent-body">
                        {adding?.col === ci && adding.sec === si && (
                          <ItemEditForm
                            item={{ title: '', url: '' }}
                            onSave={(item) => {
                              addItem(ci, si, item)
                              setAdding(null)
                            }}
                            onCancel={() => setAdding(null)}
                          />
                        )}
                        {sec.items.map((item, ii) => {
                          const isDragging =
                            dragging?.col === ci && dragging.sec === si && dragging.idx === ii
                          const showHint = hint?.col === ci && hint.sec === si && hint.idx === ii
                          const isEditing =
                            editing?.col === ci && editing.sec === si && editing.idx === ii
                          return (
                            <div
                              key={`${item.url}#${ii}`}
                              className={`dnd-card ${isDragging ? 'dragging' : ''} ${showHint ? 'drop-before' : ''}`}
                              draggable={!isEditing}
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', `${ci}:${si}:${ii}`)
                                dragRef.current = { col: ci, sec: si, idx: ii }
                                setDragging({ col: ci, sec: si, idx: ii })
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
                                setHint({ col: ci, sec: si, idx: ii })
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                onDrop({ col: ci, sec: si, idx: ii })
                              }}
                            >
                              {isEditing ? (
                                <ItemEditForm
                                  item={item}
                                  onSave={(updated) => {
                                    editItem(ci, si, ii, updated)
                                    setEditing(null)
                                  }}
                                  onCancel={() => setEditing(null)}
                                />
                              ) : (
                                <>
                                  <span className="drag-handle" aria-hidden="true">⋮⋮</span>
                                  <div className="dnd-actions">
                                    <button
                                      type="button"
                                      className="dnd-edit"
                                      title="Edit"
                                      aria-label={`Edit ${item.title}`}
                                      onClick={() => setEditing({ col: ci, sec: si, idx: ii })}
                                    >
                                      ✎
                                    </button>
                                    <button
                                      type="button"
                                      className="dnd-remove"
                                      title="Remove"
                                      aria-label={`Remove ${item.title}`}
                                      onClick={() => removeItem(ci, si, ii)}
                                    >
                                      ×
                                    </button>
                                  </div>
                                  <a
                                    className="link-card dnd-link"
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    draggable={false}
                                  >
                                    <div className="card-title">{item.title}</div>
                                    {item.description && (
                                      <div className="card-desc">{item.description}</div>
                                    )}
                                  </a>
                                </>
                              )}
                            </div>
                          )
                        })}

                        <div
                          className={`section-dropzone ${
                            hint?.col === ci && hint.sec === si && hint.idx === sec.items.length
                              ? 'active'
                              : ''
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                            setHint({ col: ci, sec: si, idx: sec.items.length })
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            onDrop({ col: ci, sec: si, idx: sec.items.length })
                          }}
                        />
                      </div>
                    )}

                    <div className="gh-parent-divider" />
                  </div>
                )
              })}

              <div
                className={`gh-section-dropzone ${
                  secDragging && secHint?.col === ci && secHint.sec === col.length ? 'active' : ''
                } ${secDragging ? 'visible' : ''}`}
                onDragOver={(e) => {
                  if (!secDragRef.current) return
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setSecHint({ col: ci, sec: col.length })
                }}
                onDrop={(e) => {
                  if (!secDragRef.current) return
                  e.preventDefault()
                  onSectionDrop(ci, col.length)
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {confirmDelete &&
        (() => {
          const section = columns[confirmDelete.col]?.[confirmDelete.sec]
          if (!section) return null
          return (
            <ConfirmDialog
              title="Delete section?"
              message={
                <>
                  This will delete <strong>{section.title}</strong> and its {section.items.length}{' '}
                  item(s). This cannot be undone.
                </>
              }
              onConfirm={() => {
                deleteSection(confirmDelete.col, confirmDelete.sec)
                setConfirmDelete(null)
              }}
              onCancel={() => setConfirmDelete(null)}
            />
          )
        })()}
    </section>
  )
}
