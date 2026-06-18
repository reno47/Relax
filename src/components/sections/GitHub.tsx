import { githubLinks } from '../../data/links'
import { Hero, LinkCard } from './Shared'

export default function GitHub() {
  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-github)' }}>
      <Hero
        icon="🐙"
        accent="var(--accent-github)"
        title={<>GitHub</>}
        subtitle="Quick access to your repositories and GitHub resources."
      />

      <div className="group">
        <h2 className="group-title">Repositories &amp; Links</h2>
        <div className="card-grid">
          {githubLinks.map((item, i) => (
            <LinkCard key={i} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
