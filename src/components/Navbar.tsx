import './Navbar.css'
import tfsIcon from '../assets/icons/tfs.svg'
import githubIcon from '../assets/icons/github.svg'
import infraIcon from '../assets/icons/infra.svg'
import portalsIcon from '../assets/icons/portals.svg'
import calendarIcon from '../assets/icons/calendar.svg'
import notesIcon from '../assets/icons/notes.svg'

export type SectionId = 'tfs' | 'github' | 'infra' | 'portals' | 'calendar' | 'notes'

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
  { id: 'notes', label: 'Notes', icon: notesIcon, accent: 'var(--accent-notes)' },
]

interface NavbarProps {
  active: SectionId
  onChange: (id: SectionId) => void
  onLogout: () => void
}

// Repo that receives feedback issues; overridable per deployment.
const FEEDBACK_REPO = import.meta.env.VITE_FEEDBACK_REPO || 'reno47/Personal-Dashboard'
const FEEDBACK_URL = `https://github.com/${FEEDBACK_REPO}/issues/new/choose`

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
      <div className="navbar-right">
        <a
          className="feedback-link"
          href={FEEDBACK_URL}
          target="_blank"
          rel="noreferrer"
          title="Report a bug or request a feature on GitHub"
        >
          Feedback
        </a>
        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  )
}

export { NAV_ITEMS }
