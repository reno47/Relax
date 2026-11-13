import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { Reminder, ReminderInput } from '../../../api/_remindercore'

export type ClientReminder = Omit<Reminder, 'msgId'>

type ListResponse = { reminders?: ClientReminder[]; teamsConfigured?: boolean; error?: string }

export type ReminderAction =
  | { action: 'complete' | 'uncomplete' }
  | { action: 'snooze'; until: number }
  | ({ action: 'edit' } & ReminderInput)

const REFRESH_MS = 60_000

export function useReminders() {
  const { getToken } = useAuth()
  const [reminders, setReminders] = useState<ClientReminder[]>([])
  const [teamsConfigured, setTeamsConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const call = useCallback(
    async (method: string, id?: string, body?: unknown): Promise<boolean> => {
      const token = await getToken()
      try {
        const r = await fetch(`/api/reminders${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        })
        const data = (await r.json()) as ListResponse
        if (!r.ok) {
          setError(data.error ?? 'Something went wrong.')
          return false
        }
        setReminders(data.reminders ?? [])
        setTeamsConfigured(Boolean(data.teamsConfigured))
        setError(null)
        return true
      } catch {
        setError('Could not reach the server.')
        return false
      }
    },
    [getToken],
  )

  useEffect(() => {
    let active = true
    call('GET').finally(() => active && setLoading(false))
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void call('GET')
    }, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [call])

  return {
    reminders,
    teamsConfigured,
    loading,
    error,
    clearError: () => setError(null),
    refresh: () => call('GET'),
    add: (input: ReminderInput) => call('POST', undefined, input),
    update: (id: string, action: ReminderAction) => call('PATCH', id, action),
    remove: (id: string) => call('DELETE', id),
  }
}
