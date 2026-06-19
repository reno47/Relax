import { tfsLinks, type LinkItem } from '../../data/links'
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

export default function TFS() {
  const [boards, setBoards] = useLocalStorage<LinkItem[]>('dashboard.tfs.boards', [
    tfsLinks.boards,
    tfsLinks.backlog,
  ])
  const [stories, setStories] = useLocalStorage<LinkItem[]>('dashboard.tfs.stories', [
    ...tfsLinks.stories,
    ...readOld('dashboard.tfs.custom'),
  ])

  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-tfs)' }}>
      <Hero
        icon="📋"
        accent="var(--accent-tfs)"
        title={<>TFS</>}
        subtitle="Boards, backlog and the stories you are working on."
      />

      <div className="group">
        <h2 className="group-title">Boards &amp; Backlog</h2>
        <div className="card-grid">
          {boards.map((s, i) => (
            <RemovableCard
              key={`${s.url}-${i}`}
              item={s}
              onRemove={() => setBoards(boards.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
        <AddItemForm label="+ Add link" onAdd={(item) => setBoards([...boards, item])} />
      </div>

      <div className="group">
        <h2 className="group-title">Stories I&apos;ve worked on</h2>
        <div className="card-grid">
          {stories.map((s, i) => (
            <RemovableCard
              key={`${s.url}-${i}`}
              item={s}
              onRemove={() => setStories(stories.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
        <AddItemForm label="+ Add story" onAdd={(item) => setStories([...stories, item])} />
      </div>
    </section>
  )
}
