import { useEffect, useState } from 'react'
import Navbar, { type SectionId } from './components/Navbar'
import Login, { clearAuth, isAuthed } from './components/Login'
import TFS from './components/sections/TFS'
import GitHub from './components/sections/GitHub'
import Infra from './components/sections/Infra'
import Portals from './components/sections/Portals'
import CalendarView from './components/sections/Calendar'

const SECTION_KEY = 'dashboard.activeSection'

export default function App() {
  const [authed, setAuthed] = useState(isAuthed)
  const [active, setActive] = useState<SectionId>(() => {
    const saved = localStorage.getItem(SECTION_KEY) as SectionId | null
    return saved ?? 'tfs'
  })

  // Lock the dashboard once the 6-hour session expires, even if the tab stays
  // open. Re-checks periodically and when the tab regains focus.
  useEffect(() => {
    if (!authed) return
    const check = () => {
      if (!isAuthed()) setAuthed(false)
    }
    const id = window.setInterval(check, 60_000)
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [authed])

  function changeSection(id: SectionId) {
    setActive(id)
    localStorage.setItem(SECTION_KEY, id)
  }

  function logout() {
    clearAuth()
    setAuthed(false)
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  return (
    <div className="app">
      <Navbar active={active} onChange={changeSection} onLogout={logout} />
      <main>
        {active === 'tfs' && <TFS />}
        {active === 'github' && <GitHub />}
        {active === 'infra' && <Infra />}
        {active === 'portals' && <Portals />}
        {active === 'calendar' && <CalendarView />}
      </main>
    </div>
  )
}
