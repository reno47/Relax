import { infraLinks } from '../../data/links'
import { Hero, LinkCard, LinkRow } from './Shared'

export default function Infra() {
  return (
    <section className="section" style={{ ['--section-accent' as string]: 'var(--accent-infra)' }}>
      <Hero
        icon="☁️"
        accent="var(--accent-infra)"
        title={<>Infra</>}
        subtitle="AWS access, Argo CD and deployment environments."
      />

      <div className="group">
        <h2 className="group-title">AWS</h2>
        <div className="card-grid">
          {infraLinks.aws.map((item) => (
            <LinkCard key={item.title} item={item} />
          ))}
        </div>
      </div>

      <div className="group">
        <h2 className="group-title">Argo CD</h2>
        <div className="card-grid">
          {infraLinks.argocd.map((item) => (
            <LinkCard key={item.title} item={item} />
          ))}
        </div>
      </div>

      <div className="group">
        <h2 className="group-title">Deployments</h2>
        <div className="link-list">
          {infraLinks.deployments.map((item) => (
            <LinkRow key={item.title} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
