import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { MyPrsResult } from '../../../api/_myprscore'

export type UseMyPrsResult = {
  data: MyPrsResult | null
  loading: boolean
  error: string | null
  notConfigured: boolean
  refresh: () => void
}

export function useMyPrs(enabled = true): UseMyPrsResult {
  const { getToken } = useAuth()
  const [data, setData] = useState<MyPrsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const r = await fetch('/api/github-prs', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const body = await r.json()
      setNotConfigured(r.status === 501)
      if (!r.ok) {
        if (r.status !== 501) setError(body.error ?? 'Could not load your pull requests.')
        return
      }
      setData(body as MyPrsResult)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled, refresh])

  return { data, loading, error, notConfigured, refresh }
}
