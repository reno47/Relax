import './Navbar.css'

export type SectionId = 'tfs' | 'github' | 'infra' | 'portals' | 'calendar'

interface NavItem {
  id: SectionId
  label: string
  icon: string
  accent: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'tfs', label: 'TFS', icon: '📋', accent: 'var(--accent-tfs)' },
  { id: 'github', label: 'GitHub', icon: '🐙', accent: 'var(--accent-github)' },
  { id: 'infra', label: 'Infra', icon: '☁️', accent: 'var(--accent-infra)' },
  { id: 'portals', label: 'Important Portals', icon: '🔗', accent: 'var(--accent-portals)' },
  { id: 'calendar', label: 'Calendar', icon: '🗓️', accent: 'var(--accent-calendar)' },
]

interface NavbarProps {
  active: SectionId
  onChange: (id: SectionId) => void
}

export default function Navbar({ active, onChange }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-dot" />
        My<span className="brand-accent">Dashboard</span>
      </div>
      <ul className="navbar-items">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-link ${active === item.id ? 'active' : ''}`}
              style={{ ['--item-accent' as string]: item.accent }}
              onClick={() => onChange(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { NAV_ITEMS }
