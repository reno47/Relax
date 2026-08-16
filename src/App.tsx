import { useState } from 'react'
import { SignedIn, SignedOut, SignIn, useAuth, useClerk } from '@clerk/clerk-react'
import Navbar, { type SectionId } from './components/Navbar'
import TFS from './components/sections/TFS'
import GitHub from './components/sections/GitHub'
import Infra from './components/sections/Infra'
import Portals from './components/sections/Portals'
import CalendarView from './components/sections/Calendar'
import Notes from './components/sections/Notes'
import { SampleBanner } from './components/SampleBanner'
import { setAuthTokenGetter } from './lib/syncStore'

const SECTION_KEY = 'dashboard.activeSection'

export default function App() {
  const { signOut } = useClerk()
  const { getToken } = useAuth()

  setAuthTokenGetter(() => getToken())

  const [active, setActive] = useState<SectionId>(() => {
    const saved = localStorage.getItem(SECTION_KEY) as SectionId | null
    return saved ?? 'tfs'
  })

  function changeSection(id: SectionId) {
    setActive(id)
    localStorage.setItem(SECTION_KEY, id)
  }

  return (
    <>
      <SignedOut>
        <div className="auth-screen">
          <SignIn />
        </div>
      </SignedOut>
      <SignedIn>
        <div className="app">
          <Navbar active={active} onChange={changeSection} onLogout={() => signOut()} />
          <SampleBanner />
          <main>
            {active === 'tfs' && <TFS />}
            {active === 'github' && <GitHub />}
            {active === 'infra' && <Infra />}
            {active === 'portals' && <Portals />}
            {active === 'calendar' && <CalendarView />}
            {active === 'notes' && <Notes />}
          </main>
        </div>
      </SignedIn>
    </>
  )
}
