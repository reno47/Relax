import { useMemo, useState } from 'react'
import notesIcon from '../../assets/icons/notes.svg'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { Hero } from './Shared'
import { NoteEditor } from './NoteEditor'
import './notes.css'

interface NotePage {
  id: string
  title: string
  html: string
  date?: string
}

interface NoteSection {
  id: string
  name: string
  collapsed?: boolean
  pages: NotePage[]
}

let idCounter = 0
function newId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`
}

const DEFAULT_SECTIONS: NoteSection[] = [
  {
    id: 'general',
    name: 'Getting started',
    pages: [
      {
        id: 'welcome',
        title: 'Welcome',
        html:
          '<p>This is a <b>sample note</b>. You can make text <b>bold</b>, <i>italic</i>, ' +
          '<u>underlined</u>, change <span style="color:#4f9cff">colors</span> and sizes, add lists, ' +
          'and paste images.</p><ul><li>Add sections and pages on the left</li>' +
          '<li>Set an optional date top-right</li></ul><p>Delete this and start your own.</p>',
      },
    ],
  },
]

export default function Notes() {
  const [sections, setSections] = useLocalStorage<NoteSection[]>(
    'dashboard.notes.sections',
    DEFAULT_SECTIONS,
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    () => DEFAULT_SECTIONS[0]?.pages[0]?.id ?? null,
  )
  const [renamingSec, setRenamingSec] = useState<string | null>(null)

  const allPages = useMemo(() => sections.flatMap((s) => s.pages), [sections])
  const selectedPage = allPages.find((p) => p.id === selectedId) ?? allPages[0] ?? null

  function updateSections(fn: (prev: NoteSection[]) => NoteSection[]) {
    setSections(fn)
  }

  function addSection() {
    const id = newId('sec')
    updateSections((prev) => [...prev, { id, name: 'New section', pages: [] }])
    setRenamingSec(id)
  }

  function renameSection(id: string, name: string) {
    updateSections((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  function removeSection(id: string) {
    updateSections((prev) => prev.filter((s) => s.id !== id))
  }

  function toggleSection(id: string) {
    updateSections((prev) => prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s)))
  }

  function addPage(sectionId: string) {
    const page: NotePage = { id: newId('pg'), title: 'Untitled', html: '' }
    updateSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, collapsed: false, pages: [...s.pages, page] } : s,
      ),
    )
    setSelectedId(page.id)
  }

  function removePage(sectionId: string, pageId: string) {
    updateSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, pages: s.pages.filter((p) => p.id !== pageId) } : s,
      ),
    )
    if (selectedId === pageId) setSelectedId(null)
  }

  function patchPage(pageId: string, patch: Partial<NotePage>) {
    updateSections((prev) =>
      prev.map((s) => ({
        ...s,
        pages: s.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
      })),
    )
  }

  return (
    <section className="section notes-section" style={{ ['--section-accent' as string]: 'var(--accent-notes)' }}>
      <Hero
        icon={<img src={notesIcon} alt="" className="hero-icon-img" aria-hidden="true" />}
        accent="var(--accent-notes)"
        title={<>Notes</>}
        subtitle="Sections and pages for your notes — text, images and formatting."
      />

      <div className="notes-layout">
        <aside className="notes-sidebar">
          {sections.map((sec) => (
            <div className="notes-sec" key={sec.id}>
              <div className="notes-sec-head">
                <button
                  type="button"
                  className="notes-caret"
                  onClick={() => toggleSection(sec.id)}
                  aria-label={sec.collapsed ? 'Expand' : 'Collapse'}
                >
                  {sec.collapsed ? '▶' : '▼'}
                </button>
                {renamingSec === sec.id ? (
                  <input
                    className="notes-sec-input"
                    value={sec.name}
                    autoFocus
                    onChange={(e) => renameSection(sec.id, e.target.value)}
                    onBlur={() => setRenamingSec(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') setRenamingSec(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="notes-sec-name"
                    onDoubleClick={() => setRenamingSec(sec.id)}
                    onClick={() => toggleSection(sec.id)}
                    title="Double-click to rename"
                  >
                    {sec.name}
                  </button>
                )}
                <div className="notes-sec-actions">
                  <button
                    type="button"
                    className="notes-mini"
                    title="Add page"
                    onClick={() => addPage(sec.id)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="notes-mini"
                    title="Rename section"
                    onClick={() => setRenamingSec(sec.id)}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="notes-mini danger"
                    title="Delete section"
                    onClick={() => removeSection(sec.id)}
                  >
                    ×
                  </button>
                </div>
              </div>

              {!sec.collapsed && (
                <div className="notes-pages">
                  {sec.pages.map((p) => (
                    <div
                      key={p.id}
                      className={`notes-page-item ${selectedId === p.id ? 'active' : ''}`}
                    >
                      <button
                        type="button"
                        className="notes-page-btn"
                        onClick={() => setSelectedId(p.id)}
                      >
                        {p.title || 'Untitled'}
                      </button>
                      <button
                        type="button"
                        className="notes-mini danger"
                        title="Delete page"
                        onClick={() => removePage(sec.id, p.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {sec.pages.length === 0 && <div className="notes-empty-hint">No pages yet</div>}
                </div>
              )}
            </div>
          ))}

          <button type="button" className="notes-add-section" onClick={addSection}>
            + Add section
          </button>
        </aside>

        <div className="notes-main">
          {selectedPage ? (
            <PageView
              key={selectedPage.id}
              page={selectedPage}
              onTitle={(title) => patchPage(selectedPage.id, { title })}
              onDate={(date) => patchPage(selectedPage.id, { date })}
              onHtml={(html) => patchPage(selectedPage.id, { html })}
            />
          ) : (
            <div className="notes-placeholder">
              Select a page, or add one with the <strong>+</strong> next to a section.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

interface PageViewProps {
  page: NotePage
  onTitle: (title: string) => void
  onDate: (date: string | undefined) => void
  onHtml: (html: string) => void
}

function PageView({ page, onTitle, onDate, onHtml }: Readonly<PageViewProps>) {
  return (
    <div className="notes-page">
      <div className="notes-page-top">
        <input
          className="notes-title"
          value={page.title}
          placeholder="Page title"
          onChange={(e) => onTitle(e.target.value)}
        />
        <div className="notes-date">
          {page.date !== undefined ? (
            <>
              <input
                type="date"
                value={page.date}
                onChange={(e) => onDate(e.target.value)}
              />
              <button
                type="button"
                className="notes-mini danger"
                title="Remove date"
                onClick={() => onDate(undefined)}
              >
                ×
              </button>
            </>
          ) : (
            <button type="button" className="notes-add-date" onClick={() => onDate('')}>
              📅 Add date
            </button>
          )}
        </div>
      </div>

      <NoteEditor html={page.html} onChange={onHtml} />
    </div>
  )
}
