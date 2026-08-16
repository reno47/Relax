import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

interface TfsSettingsProps {
  onConfiguredChange: (configured: boolean) => void
}

type Status = { configured: boolean; org: string | null; area: string | null }

export function TfsSettings({ onConfiguredChange }: Readonly<TfsSettingsProps>) {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<Status>({ configured: false, org: null, area: null })
  const [editing, setEditing] = useState(false)
  const [org, setOrg] = useState('')
  const [area, setArea] = useState('')
  const [pat, setPat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authHeaders = useCallback(async () => {
    const token = await getToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }, [getToken])

  const apply = useCallback(
    (next: Status) => {
      setStatus(next)
      onConfiguredChange(next.configured)
    },
    [onConfiguredChange],
  )

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const r = await fetch('/api/tfs-settings', { headers: await authHeaders() })
        const data = (await r.json()) as Status
        if (active) apply(data)
      } catch {
        
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [authHeaders, apply])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/tfs-settings', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ org: org.trim(), pat: pat.trim(), area: area.trim() }),
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error ?? 'Could not save.')
        return
      }
      apply({ configured: true, org: data.org ?? org.trim(), area: data.area ?? (area.trim() || null) })
      setPat('')
      setEditing(false)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/tfs-settings', { method: 'DELETE', headers: await authHeaders() })
      if (!r.ok) {
        const data = await r.json()
        setError(data.error ?? 'Could not remove.')
        return
      }
      apply({ configured: false, org: null, area: null })
      setOrg('')
      setArea('')
      setEditing(false)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  if (status.configured && !editing) {
    return (
      <div className="tfs-conn">
        <span className="tfs-conn-dot" aria-hidden="true" />
        <span className="tfs-conn-text">
          Connected to <strong>{status.org}</strong>
          {status.area ? <> · area <strong>{status.area}</strong></> : null}
        </span>
        <div className="tfs-conn-actions">
          <button
            type="button"
            className="tfs-link-btn"
            onClick={() => {
              setOrg(status.org ?? '')
              setArea(status.area ?? '')
              setEditing(true)
            }}
          >
            Change token
          </button>
          <button type="button" className="tfs-link-btn danger" onClick={remove} disabled={saving}>
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="tfs-settings" onSubmit={save}>
      <p className="tfs-settings-hint">
        Connect your own Azure DevOps account to look up work items. Create a PAT with{' '}
        <strong>Work Items (Read)</strong> scope — it is stored encrypted and used only for your
        lookups.
      </p>
      <label className="tfs-field">
        <span>Organization</span>
        <input
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          placeholder="your-org (from dev.azure.com/your-org)"
          autoComplete="off"
        />
      </label>
      <label className="tfs-field">
        <span>Personal Access Token</span>
        <input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="Paste your PAT"
          autoComplete="off"
        />
      </label>
      <label className="tfs-field">
        <span>Area path (optional)</span>
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="e.g. Project\\Area — limits assigned items to this area and below"
          autoComplete="off"
        />
      </label>
      {error && <div className="tfs-error">{error}</div>}
      <div className="tfs-settings-actions">
        <button type="submit" className="btn-primary" disabled={saving || !org.trim() || !pat.trim()}>
          {saving ? 'Saving…' : 'Connect'}
        </button>
        {status.configured && (
          <button type="button" className="tfs-link-btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
