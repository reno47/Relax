const ENDPOINT = '/api/state'

type TokenGetter = () => Promise<string | null>
let authTokenGetter: TokenGetter | null = null

export function setAuthTokenGetter(fn: TokenGetter | null): void {
  authTokenGetter = fn
}

async function authHeaders(base: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers = { ...base }
  try {
    const token = authTokenGetter ? await authTokenGetter() : null
    if (token) headers.Authorization = `Bearer ${token}`
  } catch {
    
  }
  return headers
}

function isSynced(key: string): boolean {
  return key.startsWith('dashboard.') && !key.startsWith('dashboard.calendar.')
}

const listeners = new Map<string, Set<(value: unknown) => void>>()
let hydratePromise: Promise<void> | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined

export function subscribe(key: string, fn: (value: unknown) => void): () => void {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(fn)
  return () => {
    set!.delete(fn)
  }
}

export function hydrate(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    try {
      const headers = await authHeaders()
      const r = await fetch(ENDPOINT, { headers })
      if (!r.ok) return
      const data = await r.json()
      if (!data || typeof data !== 'object') return
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (!isSynced(key) || value === undefined || value === null) continue
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch {
          
        }
        listeners.get(key)?.forEach((fn) => fn(value))
      }
    } catch {
      
    }
  })()

  return hydratePromise
}

export function schedulePush(): void {
  if (typeof window === 'undefined') return
  hydrate().then(() => {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(pushNow, 700)
  })
}

function pushNow(): void {
  const snapshot: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !isSynced(key)) continue
    try {
      snapshot[key] = JSON.parse(localStorage.getItem(key) as string)
    } catch {
      
    }
  }
  authHeaders({ 'Content-Type': 'application/json' })
    .then((headers) =>
      fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(snapshot) }),
    )
    .catch(() => {
      
    })
}
