// Lightweight server sync for all `dashboard.*` localStorage keys.
//
// On first use it hydrates from `/api/state` (Vercel KV in prod, a JSON file
// in dev) and writes the values into localStorage, notifying any subscribed
// hooks so the UI updates. On every change it debounce-pushes a snapshot of
// all `dashboard.*` keys back to the server.
//
// Calendar keys (`dashboard.calendar.*`) are intentionally excluded — the
// calendar has its own dedicated `/api/calendar` endpoint.

const ENDPOINT = '/api/state'

type TokenGetter = () => Promise<string | null>
let authTokenGetter: TokenGetter | null = null

// Registered by the app once Clerk is ready, so the plain module can attach
// the signed-in user's token to every API call.
export function setAuthTokenGetter(fn: TokenGetter | null): void {
  authTokenGetter = fn
}

async function authHeaders(base: Record<string, string> = {}): Promise<Record<string, string>> {
  const headers = { ...base }
  try {
    const token = authTokenGetter ? await authTokenGetter() : null
    if (token) headers.Authorization = `Bearer ${token}`
  } catch {
    /* no token — request will be rejected server-side */
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

// Fetch the server snapshot once and apply it to localStorage + subscribers.
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
          /* ignore */
        }
        listeners.get(key)?.forEach((fn) => fn(value))
      }
    } catch {
      /* offline or store not configured — keep using localStorage */
    }
  })()

  return hydratePromise
}

// Debounced push of every synced key currently in localStorage. Waits for the
// initial hydrate so we never overwrite newer server data with stale local data.
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
      /* skip unparseable values */
    }
  }
  authHeaders({ 'Content-Type': 'application/json' })
    .then((headers) =>
      fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(snapshot) }),
    )
    .catch(() => {
      /* ignore network errors — localStorage still holds the data */
    })
}
