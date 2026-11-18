import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { subscribe } from '../lib/syncStore'
import {
  REMINDERS_CHANGED,
  TODOS_CHANGED,
  type BadgeItem,
  type BadgeReminder,
} from '../lib/badgeEvents'

const TODOS_KEY = 'dashboard.todos'
const REFRESH_MS = 60_000

function countOpen(list: unknown): number {
  return Array.isArray(list) ? (list as BadgeItem[]).filter((t) => !t?.completedAt).length : 0
}

function readOpenTodos(): number {
  try {
    return countOpen(JSON.parse(localStorage.getItem(TODOS_KEY) ?? '[]'))
  } catch {
    return 0
  }
}

function useOpenTodoCount(): number {
  const [count, setCount] = useState(readOpenTodos)
  useEffect(() => {
    const onChange = (e: Event) => setCount(countOpen((e as CustomEvent<BadgeItem[]>).detail))
    window.addEventListener(TODOS_CHANGED, onChange)
    const unsub = subscribe(TODOS_KEY, (v) => setCount(countOpen(v)))
    return () => {
      window.removeEventListener(TODOS_CHANGED, onChange)
      unsub()
    }
  }, [])
  return count
}

function useReminderList(): BadgeReminder[] {
  const { getToken } = useAuth()
  const [list, setList] = useState<BadgeReminder[]>([])
  useEffect(() => {
    const load = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const token = await getToken()
        const r = await fetch('/api/reminders', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        if (r.ok) setList(((await r.json()) as { reminders?: BadgeReminder[] }).reminders ?? [])
      } catch {
        // Badge is best-effort; keep the last known value.
      }
    }
    const onChange = (e: Event) => setList((e as CustomEvent<BadgeReminder[]>).detail)
    void load()
    const timer = setInterval(load, REFRESH_MS)
    window.addEventListener(REMINDERS_CHANGED, onChange)
    return () => {
      clearInterval(timer)
      window.removeEventListener(REMINDERS_CHANGED, onChange)
    }
  }, [getToken])
  return list
}

function useNowTick(): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS / 2)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function useReminderBadge(): number {
  const openTodos = useOpenTodoCount()
  const reminders = useReminderList()
  const now = useNowTick()
  const overdue = reminders.filter((r) => !r.completedAt && r.due <= now).length
  return openTodos + overdue
}
