import { useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { ConfirmDialog } from './sections/ConfirmDialog'
import { useLocalStorage } from '../hooks/useLocalStorage'
import './sampleBanner.css'

const DISMISS_KEY = 'dashboard.onboardingDismissed'

const EMPTY_STATE: Record<string, unknown> = {
  'dashboard.tfs.boards': [],
  'dashboard.tfs.workitems': [],
  'dashboard.portals.items': [],
  'dashboard.infra.sections': [],
  'dashboard.github.sections': [],
  'dashboard.notes.sections': [],
}

export function SampleBanner() {
  const { getToken } = useAuth()
  const [dismissed, setDismissed] = useLocalStorage<boolean>(DISMISS_KEY, false)
  const [confirming, setConfirming] = useState(false)

  if (dismissed) return null

  function dismiss() {
    setDismissed(true)
  }

  async function clearAll() {
    for (const [k, v] of Object.entries(EMPTY_STATE)) localStorage.setItem(k, JSON.stringify(v))
    localStorage.setItem('dashboard.calendar.categories', '[]')
    localStorage.setItem('dashboard.calendar.marks', '{}')
    setDismissed(true)
    try {
      const token = await getToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
      await Promise.allSettled([
        fetch('/api/state', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...EMPTY_STATE, [DISMISS_KEY]: true }),
        }),
        fetch('/api/calendar', {
          method: 'POST',
          headers,
          body: JSON.stringify({ categories: [], marks: {} }),
        }),
      ])
    } catch {
      
    }
    location.reload()
  }

  return (
    <>
      <div className="sample-banner">
        <span className="sample-banner-text">
          👋 This is <strong>sample content</strong> to show how things work. Edit or delete anything —
          or clear it all to start fresh.
        </span>
        <div className="sample-banner-actions">
          <button type="button" className="sample-clear" onClick={() => setConfirming(true)}>
            Clear sample data
          </button>
          <button type="button" className="sample-dismiss" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Clear all content?"
          message={
            <>
              This permanently deletes <strong>all content on every tab</strong> (GitHub, TFS, Infra,
              Portals, Notes, Calendar). This can’t be undone.
            </>
          }
          confirmLabel="Clear everything"
          onConfirm={clearAll}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
