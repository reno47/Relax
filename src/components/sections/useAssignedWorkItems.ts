import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { AssignedItem, IterationOption } from './tfsUtils'

type AssignedData = { items: AssignedItem[]; iterations: IterationOption[] }

const REFRESH_MS = 5 * 60 * 1000

export function useAssignedWorkItems(enabled: boolean) {
  const { getToken } = useAuth()
  const [data, setData] = useState<AssignedData>({ items: [], iterations: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const r = await fetch('/api/tfs-assigned', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const body = await r.json()
      if (!r.ok) {
        setError(body.error ?? 'Could not load assigned work items.')
        return
      }
      setData({ items: body.items ?? [], iterations: body.iterations ?? [] })
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }, [enabled, getToken])

  useEffect(() => {
    if (!enabled) {
      setData({ items: [], iterations: [] })
      return
    }
    refresh()
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [enabled, refresh])

  return { items: data.items, iterations: data.iterations, loading, error, refresh }
}
