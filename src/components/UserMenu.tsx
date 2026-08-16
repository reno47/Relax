import { useEffect, useRef, useState } from 'react'
import { useClerk, useUser } from '@clerk/clerk-react'
import { useTheme, type Theme } from '../hooks/useTheme'
import './userMenu.css'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function UserMenu() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const initial = (email[0] ?? 'U').toUpperCase()

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function close() {
    setOpen(false)
    setThemeOpen(false)
  }

  function pickTheme(next: Theme) {
    setTheme(next)
    close()
  }

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {initial}
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-email" title={email}>
            {email || 'Signed in'}
          </div>

          <div className="user-menu-theme">
            <button
              type="button"
              className="user-menu-item"
              aria-haspopup="menu"
              aria-expanded={themeOpen}
              onClick={() => setThemeOpen((v) => !v)}
            >
              <span>Theme</span>
              <span className="user-menu-caret">‹</span>
            </button>

            {themeOpen && (
              <div className="user-menu-subpanel" role="menu">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`user-menu-sub-item ${theme === t.value ? 'active' : ''}`}
                    onClick={() => pickTheme(t.value)}
                  >
                    <span>{t.label}</span>
                    {theme === t.value && <span className="user-menu-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="user-menu-item" onClick={() => signOut()}>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
