import { useState } from 'react'
import { infraLinks, type LinkItem } from '../../data/links'
import infraIcon from '../../assets/icons/infra.svg'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { AddItemForm } from './AddItemForm'
import { Hero, RemovableCard } from './Shared'

interface Section {
  id: string
  title: string
  items: LinkItem[]
}

// Initial sections seed from config. After this, the Infra layout is fully
// user-managed (add/remove sections and items) and persisted in localStorage.
const DEFAULT_SECTIONS: Section[] = [
  { id: 'aws', title: 'AWS', items: infraLinks.aws },
  { id: 'argocd', title: 'Argo CD', items: infraLinks.argocd },
  { id: 'deployments', title: 'Deployments', items: infraLinks.deployments },
]

export default function Infra() {
  const [sections, setSections] = useLocalStorage<Section[]>('dashboard.infra.sections', DEFAULT_SECTIONS)
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')

  function addItem(sectionId: string, item: LinkItem) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, items: [...s.items, item] } : s)),
    )
  }

  function removeItem(sectionId: string, index: number) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((_, i) => i !== index) } : s,
      ),
    )
  }

  function editItem(sectionId: string, index: number, updated: LinkItem) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, items: s.items.map((it, i) => (i === index ? updated : it)) }
          : s,
      ),
    )
  }

  function addSection(e: React.FormEvent) {
    e.preventDefault()
    const title = newSectionTitle.trim()
    if (!title) return
    const id = `sec-${Date.now().toString(36)}`
    setSections((prev) => [...prev, { id, title, items: [] }])
    setNewSectionTitle('')
    setAddingSection(false)
  }

  function removeSection(sectionId: string) {
    setSections((prev) => prev.filter((s) => s.id !== sectionId))
  }

  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-infra)' }}>
      <Hero
        icon={<img src={infraIcon} alt="" className="hero-icon-img" aria-hidden="true" />}
        accent="var(--accent-infra)"
        title={<>Infra</>}
        subtitle="AWS access, Argo CD and deployment environments. Add your own sections and links."
      />

      {sections.map((sec) => (
        <div className="group" key={sec.id}>
          <div className="section-head">
            <h2 className="group-title">{sec.title}</h2>
            <button
              type="button"
              className="section-delete"
              onClick={() => removeSection(sec.id)}
              title="Delete section"
              aria-label={`Delete ${sec.title} section`}
            >
              ×
            </button>
          </div>
          <div className="card-grid">
            {sec.items.map((item, i) => (
              <RemovableCard
                key={`${item.url}-${i}`}
                item={item}
                onRemove={() => removeItem(sec.id, i)}
                onEdit={(updated) => editItem(sec.id, i, updated)}
              />
            ))}
          </div>
          <AddItemForm label="+ Add item" onAdd={(item) => addItem(sec.id, item)} />
        </div>
      ))}

      {/* Add a new section */}
      {addingSection ? (
        <form className="add-form add-section-form" onSubmit={addSection}>
          <input
            placeholder="Section name (e.g. Monitoring)"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            autoFocus
          />
          <div className="add-form-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setAddingSection(false)
                setNewSectionTitle('')
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!newSectionTitle.trim()}>
              Add section
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="add-toggle add-section-toggle"
          onClick={() => setAddingSection(true)}
        >
          + Add section
        </button>
      )}
    </section>
  )
}
