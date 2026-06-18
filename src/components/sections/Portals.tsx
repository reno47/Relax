import { portalLinks } from '../../data/links'
import { Hero, LinkCard } from './Shared'

export default function Portals() {
  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-portals)' }}>
      <Hero
        icon="🔗"
        accent="var(--accent-portals)"
        title={<>Important Portals</>}
        subtitle="Frequently used company portals, all in one place."
      />

      <div className="group">
        <h2 className="group-title">Portals</h2>
        <div className="card-grid">
          {portalLinks.map((item, i) => (
            <LinkCard key={i} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
