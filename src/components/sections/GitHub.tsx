import { githubColumns } from '../../data/links'
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
        <div className="github-columns">
          {githubColumns.map((column, i) => (
            <div className="github-column" key={i}>
              {column.map((item) => (
                <LinkCard key={item.title} item={item} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
