import { useEffect, useRef, useState } from 'react'
import { hydrate, schedulePush, subscribe } from '../lib/syncStore'

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

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

  const first = useRef(true)
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      
    }
    if (first.current) {
      first.current = false
      return
    }
    schedulePush()
  }, [key, value])

  return [value, setValue] as const
}
