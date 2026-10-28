import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { GithubStatus } from './types'

type GithubSettingsProps = {
  onStatusChange: (status: GithubStatus) => void
}

export function GithubSettings({ onStatusChange }: Readonly<GithubSettingsProps>) {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<GithubStatus>({ configured: false, org: null, login: null })
  const [editing, setEditing] = useState(false)
  const [org, setOrg] = useState('')
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
    (next: GithubStatus) => {
      setStatus(next)
      onStatusChange(next)
    },
    [onStatusChange],
  )

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const r = await fetch('/api/github-settings', { headers: await authHeaders() })
        const data = (await r.json()) as GithubStatus
        if (active) apply(data)
      } catch {
        /* ignore */
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
      const r = await fetch('/api/github-settings', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ pat: pat.trim(), org: org.trim() }),
      })
      const data = await r.json()
      if (!r.ok) {
        setError(data.error ?? 'Could not save.')
        return
      }
      apply({ configured: true, org: data.org ?? (org.trim() || null), login: data.login ?? null })
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
      const r = await fetch('/api/github-settings', { method: 'DELETE', headers: await authHeaders() })
      if (!r.ok) {
        const data = await r.json()
        setError(data.error ?? 'Could not remove.')
        return
      }
      apply({ configured: false, org: null, login: null })
      setOrg('')
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
      <div className="gh-conn">
        <span className="gh-conn-dot" aria-hidden="true" />
        <span className="gh-conn-text">
          Connected as <strong>{status.login ?? 'GitHub'}</strong>
          {status.org ? <> · org <strong>{status.org}</strong></> : null}
        </span>
        <div className="gh-conn-actions">
          <button
            type="button"
            className="gh-link-btn"
            onClick={() => {
              setOrg(status.org ?? '')
              setEditing(true)
            }}
          >
            Change token
          </button>
          <button type="button" className="gh-link-btn danger" onClick={remove} disabled={saving}>
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="gh-settings" onSubmit={save}>
      <p className="gh-settings-hint">
        Connect GitHub to see your contributions. Create a <strong>fine-grained personal access
        token</strong> owned by your Philips org, with <strong>All repositories</strong> access and
        read-only permissions for <strong>Pull requests</strong> and <strong>Metadata</strong>
        {' '}(approve SSO if prompted). It is stored encrypted and used only for your own data.
      </p>
      <label className="gh-field">
        <span>Organization</span>
        <input
          value={org}
          onChange={(e) => setOrg(e.target.value)}
          placeholder="philips org slug (optional — limits PRs to this org)"
          autoComplete="off"
        />
      </label>
      <label className="gh-field">
        <span>Personal Access Token</span>
        <input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="github_pat_…"
          autoComplete="off"
        />
      </label>
      {error && <div className="gh-error">{error}</div>}
      <div className="gh-settings-actions">
        <button type="submit" className="btn-primary" disabled={saving || !pat.trim()}>
          {saving ? 'Saving…' : 'Connect'}
        </button>
        {status.configured && (
          <button type="button" className="gh-link-btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
