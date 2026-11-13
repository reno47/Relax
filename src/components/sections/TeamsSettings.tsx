import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

interface TeamsSettingsProps {
  onChange: () => void
}

export function TeamsSettings({ onChange }: Readonly<TeamsSettingsProps>) {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const request = useCallback(
    async (method: string, body?: unknown) => {
      const token = await getToken()
      const r = await fetch('/api/teams-settings', {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = (await r.json()) as { configured?: boolean; error?: string }
      if (!r.ok) throw new Error(data.error ?? 'Something went wrong.')
      return Boolean(data.configured)
    },
    [getToken],
  )

  useEffect(() => {
    let active = true
    request('GET')
      .then((c) => active && setConfigured(c))
      .catch(() => undefined)
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [request])

  async function run(method: string, body: unknown, after: (c: boolean) => void) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      after(await request(method, body))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server.')
    } finally {
      setBusy(false)
    }
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    void run('POST', { url: url.trim() }, (c) => {
      setConfigured(c)
      setUrl('')
      setEditing(false)
      setNotice('Connected. Use "Send test" to check a message arrives.')
      onChange()
    })
  }
  const test = () => void run('POST', { test: true }, () => setNotice('Test sent. Check Teams.'))
  const disconnect = () =>
    void run('DELETE', undefined, (c) => {
      setConfigured(c)
      onChange()
    })

  if (loading) return null

  const feedback = (
    <>
      {error && <div className="tfs-error">{error}</div>}
      {notice && <div className="rm-notice">{notice}</div>}
    </>
  )

  if (configured && !editing) {
    return (
      <div>
        <div className="tfs-conn">
          <span className="tfs-conn-dot" aria-hidden="true" />
          <span className="tfs-conn-text">Reminders are sent to <strong>Microsoft Teams</strong></span>
          <div className="tfs-conn-actions">
            <button type="button" className="tfs-link-btn" onClick={test} disabled={busy}>
              Send test
            </button>
            <button type="button" className="tfs-link-btn" onClick={() => setEditing(true)}>
              Change
            </button>
            <button type="button" className="tfs-link-btn danger" onClick={disconnect} disabled={busy}>
              Disconnect
            </button>
          </div>
        </div>
        {feedback}
      </div>
    )
  }

  return (
    <form className="tfs-settings rm-teams" onSubmit={save}>
      <p className="tfs-settings-hint">
        In Teams, open <strong>Workflows</strong> and create a flow from the{' '}
        <strong>Send webhook alerts to a chat</strong> template. Set its <em>Post card</em> step to{' '}
        <strong>Flow bot → Chat with Flow bot</strong>, then paste the webhook URL here. It is stored
        encrypted.
      </p>
      <label className="tfs-field">
        <span>Teams webhook URL</span>
        <input
          type="password"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…powerplatform.com/…/invoke?…"
          autoComplete="off"
        />
      </label>
      {feedback}
      <div className="tfs-settings-actions">
        <button type="submit" className="btn-primary" disabled={busy || !url.trim()}>
          {busy ? 'Saving…' : 'Connect'}
        </button>
        {configured && (
          <button type="button" className="tfs-link-btn" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
