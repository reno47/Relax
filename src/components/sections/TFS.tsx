import { tfsLinks } from '../../data/links'
import { Hero, LinkCard } from './Shared'

export default function TFS() {
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
          <LinkCard item={tfsLinks.boards} />
          <LinkCard item={tfsLinks.backlog} />
        </div>
      </div>

      <div className="group">
        <h2 className="group-title">Stories I&apos;ve worked on</h2>
        <div className="card-grid">
          {tfsLinks.stories.map((s) => (
            <LinkCard key={s.title} item={s} />
          ))}
        </div>
      </div>
    </section>
  )
}
