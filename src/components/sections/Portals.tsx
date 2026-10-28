import { useState } from 'react'
import { portalLinks, type LinkItem } from '../../data/links'
import portalsIcon from '../../assets/icons/portals.svg'
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

interface Section {
  id: string
  title: string
  items: LinkItem[]
}

function initialSections(): Section[] {
  const storedItems = localStorage.getItem('dashboard.portals.items')
  const items = storedItems
    ? readOld('dashboard.portals.items')
    : [...portalLinks, ...readOld('dashboard.portals.custom')]
  return [{ id: 'portals', title: 'Portals', items }]
}

export default function Portals() {
  const [sections, setSections] = useLocalStorage<Section[]>(
    'dashboard.portals.sections',
    initialSections(),
  )
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')

  function addItem(sectionId: string, item: LinkItem) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId ? { ...section, items: [...section.items, item] } : section,
      ),
    )
  }

  function removeItem(sectionId: string, index: number) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, items: section.items.filter((_, itemIndex) => itemIndex !== index) }
          : section,
      ),
    )
  }

  function editItem(sectionId: string, index: number, updated: LinkItem) {
    setSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, items: section.items.map((item, itemIndex) => itemIndex === index ? updated : item) }
          : section,
      ),
    )
  }

  function addSection(e: React.FormEvent) {
    e.preventDefault()
    const title = newSectionTitle.trim()
    if (!title) return
    setSections((prev) => [...prev, { id: `sec-${Date.now().toString(36)}`, title, items: [] }])
    setNewSectionTitle('')
    setAddingSection(false)
  }

  function removeSection(sectionId: string) {
    setSections((prev) => prev.filter((section) => section.id !== sectionId))
  }

  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-portals)' }}>
      <Hero
        icon={<img src={portalsIcon} alt="" className="hero-icon-img" aria-hidden="true" />}
        accent="var(--accent-portals)"
        title={<>Important Portals</>}
        subtitle="Frequently used company portals, organized into your own sections."
      />

      {sections.map((section) => (
        <div className="group" key={section.id}>
          <div className="section-head">
            <h2 className="group-title">{section.title}</h2>
            <button
              type="button"
              className="section-delete"
              onClick={() => removeSection(section.id)}
              title="Delete section"
              aria-label={`Delete ${section.title} section`}
            >
              ×
            </button>
          </div>
          <div className="card-grid">
            {section.items.map((item, index) => (
              <RemovableCard
                key={`${item.url}-${index}`}
                item={item}
                onRemove={() => removeItem(section.id, index)}
                onEdit={(updated) => editItem(section.id, index, updated)}
              />
            ))}
          </div>
          <AddItemForm label="+ Add portal" onAdd={(item) => addItem(section.id, item)} />
        </div>
      ))}

      {addingSection ? (
        <form className="add-form add-section-form" onSubmit={addSection}>
          <input
            placeholder="Section name (e.g. HR, Tools)"
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
