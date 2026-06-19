import { useEffect, useRef, useState } from 'react'
import { hydrate, schedulePush, subscribe } from '../lib/syncStore'

// localStorage-backed state that also syncs to the server (`/api/state`) so
// the data is available across sessions and devices when hosted on Vercel.
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  // Hydrate from the server once, and adopt server updates for this key.
  useEffect(() => {
    let active = true
    const unsub = subscribe(key, (v) => {
      if (active) setValue(v as T)
    })
    hydrate()
    return () => {
      active = false
      unsub()
    }
  }, [key])

  // Persist locally on every change and push to the server (debounced).
  const first = useRef(true)
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* ignore quota / serialization errors */
    }
    if (first.current) {
      first.current = false
      return
    }
    schedulePush()
  }, [key, value])

  return [value, setValue] as const
}
