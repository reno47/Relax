import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { Contributions, Range } from './types'
import { rangeToDates } from './range'

export type UseGithubContributionsResult = {
  data: Contributions | null
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useGithubContributions(enabled: boolean, range: Range): UseGithubContributionsResult {
  const { getToken } = useAuth()
  const [data, setData] = useState<Contributions | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const { from, to } = rangeToDates(range)
      const r = await fetch(`/api/github-contributions?from=${from}&to=${to}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const body = await r.json()
      if (!r.ok) {
        setError(body.error ?? 'Could not load GitHub contributions.')
        return
      }
      setData(body as Contributions)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }, [enabled, getToken, range])

  useEffect(() => {
    if (!enabled) {
      setData(null)
      return
    }
    void refresh()
  }, [enabled, refresh])

  return { data, loading, error, refresh }
}
