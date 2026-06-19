import './Navbar.css'
import tfsIcon from '../assets/icons/tfs.svg'
import githubIcon from '../assets/icons/github.svg'
import infraIcon from '../assets/icons/infra.svg'
import portalsIcon from '../assets/icons/portals.svg'
import calendarIcon from '../assets/icons/calendar.svg'

export type SectionId = 'tfs' | 'github' | 'infra' | 'portals' | 'calendar'

interface NavItem {
  id: SectionId
  label: string
  icon: string
  accent: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'tfs', label: 'TFS', icon: tfsIcon, accent: 'var(--accent-tfs)' },
  { id: 'github', label: 'GitHub', icon: githubIcon, accent: 'var(--accent-github)' },
  { id: 'infra', label: 'Infra', icon: infraIcon, accent: 'var(--accent-infra)' },
  { id: 'portals', label: 'Important Portals', icon: portalsIcon, accent: 'var(--accent-portals)' },
  { id: 'calendar', label: 'Calendar', icon: calendarIcon, accent: 'var(--accent-calendar)' },
]

interface NavbarProps {
  active: SectionId
  onChange: (id: SectionId) => void
  onLogout: () => void
}

export default function Navbar({ active, onChange, onLogout }: NavbarProps) {
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
              <span className="nav-icon">
                <img src={item.icon} alt="" className="nav-icon-img" aria-hidden="true" />
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="logout-btn" onClick={onLogout}>
        Logout
      </button>
    </nav>
  )
}

export { NAV_ITEMS }
