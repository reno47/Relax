import { useState } from 'react'
import Navbar, { type SectionId } from './components/Navbar'
import TFS from './components/sections/TFS'
import GitHub from './components/sections/GitHub'
import Infra from './components/sections/Infra'
import Portals from './components/sections/Portals'
import CalendarView from './components/sections/Calendar'

const SECTION_KEY = 'dashboard.activeSection'

export default function App() {
  const [active, setActive] = useState<SectionId>(() => {
    const saved = localStorage.getItem(SECTION_KEY) as SectionId | null
    return saved ?? 'tfs'
  })

  function changeSection(id: SectionId) {
    setActive(id)
    localStorage.setItem(SECTION_KEY, id)
  }

  return (
    <div className="app">
      <Navbar active={active} onChange={changeSection} />
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
